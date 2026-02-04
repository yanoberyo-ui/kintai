import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../utils/supabase'
import { getTimerState, calculateRemainingSeconds } from '../utils/timer'

/**
 * タイマーをRealtimeで購読するフック
 * 接続切れ時の自動復帰、エラー時のリトライ機能付き
 * @param {string} eventId - イベントID
 * @returns {Object} { remainingSeconds, isRunning, timerState, connectionStatus, refetch }
 */
export function useTimerRealtime(eventId) {
  const [timerState, setTimerState] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  // リトライ管理
  const retryCountRef = useRef(0)
  const maxRetries = 5
  const retryTimeoutRef = useRef(null)
  const channelRef = useRef(null)

  // 初期データ取得
  const refetch = useCallback(async () => {
    if (!eventId) return
    try {
      const state = await getTimerState(eventId)
      setTimerState(state)
      if (state) {
        setIsRunning(state.is_running)
        setRemainingSeconds(calculateRemainingSeconds(state))
      }
      retryCountRef.current = 0
    } catch (error) {
      console.error('Error fetching timer state:', error)
    }
  }, [eventId])

  useEffect(() => {
    refetch()
  }, [refetch])

  // 購読状態ハンドリング
  const handleSubscriptionStatus = useCallback((status, err) => {
    if (status === 'SUBSCRIBED') {
      setConnectionStatus('connected')
      retryCountRef.current = 0
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.error('Timer channel error:', err)
      setConnectionStatus('error')
      scheduleRetry()
    } else if (status === 'CLOSED') {
      setConnectionStatus('disconnected')
      scheduleRetry()
    }
  }, [])

  // リトライスケジュール
  const scheduleRetry = useCallback(() => {
    if (retryCountRef.current >= maxRetries) {
      console.error('Max retries reached for timer realtime connection')
      setConnectionStatus('error')
      return
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }

    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 16000)
    retryCountRef.current++

    console.log(`Timer: Scheduling retry ${retryCountRef.current}/${maxRetries} in ${delay}ms`)

    retryTimeoutRef.current = setTimeout(() => {
      refetch()
      setupSubscription()
    }, delay)
  }, [refetch])

  // 購読セットアップ
  const setupSubscription = useCallback(() => {
    if (!eventId) return

    // 既存のチャンネルをクリーンアップ
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    setConnectionStatus('connecting')

    const channel = supabase
      .channel(`minigame_timer:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'minigame_timer',
          filter: `event_id=eq.${eventId}`
        },
        (payload) => {
          const newState = payload.new
          setTimerState(newState)
          if (newState) {
            setIsRunning(newState.is_running)
            setRemainingSeconds(calculateRemainingSeconds(newState))
          }
        }
      )
      .subscribe((status, err) => {
        handleSubscriptionStatus(status, err)
      })

    channelRef.current = channel
  }, [eventId, handleSubscriptionStatus])

  // Realtime購読
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

  // ポーリング（5秒間隔でバックアップ同期）
  useEffect(() => {
    if (!eventId) return

    const pollInterval = setInterval(() => {
      refetch()
    }, 5000)

    return () => clearInterval(pollInterval)
  }, [eventId, refetch])

  // タイマー実行中は1秒ごとに残り時間を更新
  useEffect(() => {
    if (!isRunning || !timerState) return

    const interval = setInterval(() => {
      const remaining = calculateRemainingSeconds(timerState)
      setRemainingSeconds(remaining)

      // 0になったら停止
      if (remaining <= 0) {
        setIsRunning(false)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, timerState])

  // ブラウザのオンライン/オフライン検知
  useEffect(() => {
    const handleOnline = () => {
      console.log('Timer: Browser online - reconnecting')
      refetch()
      setupSubscription()
    }

    const handleOffline = () => {
      console.log('Timer: Browser offline')
      setConnectionStatus('disconnected')
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Timer: Page visible - checking connection')
        refetch()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refetch, setupSubscription])

  return {
    remainingSeconds,
    isRunning,
    timerState,
    connectionStatus,
    refetch
  }
}
