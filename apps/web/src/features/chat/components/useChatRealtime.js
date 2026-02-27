import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../utils/supabase'

/**
 * チャットメッセージのリアルタイム購読を管理するフック
 * @param {string} userId - 現在のユーザーID
 * @param {Function} onNewMessage - 新しいメッセージ受信時のコールバック
 * @returns {Object} { connectionStatus }
 */
export function useChatRealtime(userId, onNewMessage) {
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const channelRef = useRef(null)
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef(null)
  const maxRetries = 5
  const onNewMessageRef = useRef(onNewMessage)

  useEffect(() => {
    onNewMessageRef.current = onNewMessage
  }, [onNewMessage])

  const handleSubscriptionStatus = useCallback((status, err) => {
    if (status === 'SUBSCRIBED') {
      setConnectionStatus('connected')
      retryCountRef.current = 0
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.error('Chat realtime channel error:', err)
      setConnectionStatus('error')
      scheduleRetry()
    } else if (status === 'CLOSED') {
      setConnectionStatus('disconnected')
    }
  }, [])

  const setupSubscription = useCallback(() => {
    if (!userId) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    setConnectionStatus('connecting')

    const channel = supabase
      .channel(`chat_messages_realtime:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          if (onNewMessageRef.current) {
            onNewMessageRef.current(payload.new)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          if (onNewMessageRef.current) {
            onNewMessageRef.current(payload.new, 'UPDATE')
          }
        }
      )
      .subscribe((status, err) => {
        handleSubscriptionStatus(status, err)
      })

    channelRef.current = channel
  }, [userId, handleSubscriptionStatus])

  const scheduleRetry = useCallback(() => {
    if (retryCountRef.current >= maxRetries) {
      console.error('Max retries reached for chat realtime connection')
      setConnectionStatus('error')
      return
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }

    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 16000)
    retryCountRef.current++

    retryTimeoutRef.current = setTimeout(() => {
      setupSubscription()
    }, delay)
  }, [setupSubscription])

  useEffect(() => {
    setupSubscription()

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [setupSubscription])

  // ブラウザオンライン復帰時の再接続
  useEffect(() => {
    const handleOnline = () => {
      setupSubscription()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setupSubscription()
      }
    }

    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [setupSubscription])

  return { connectionStatus }
}
