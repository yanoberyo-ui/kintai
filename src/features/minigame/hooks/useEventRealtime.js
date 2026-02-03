import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../utils/supabase'
import { getEvent } from '../utils/event'
import { getParticipants } from '../utils/participant'
import { getCurrentSeating, getLatestRoundNumber } from '../utils/seating'

/**
 * イベント状態・参加者リスト・席配置をRealtimeで購読するフック
 * 接続切れ時の自動復帰、エラー時のリトライ機能付き
 * @param {string} eventId - イベントID
 * @returns {Object} { event, participants, seating, currentRound, loading, error, connectionStatus, refetch }
 */
export function useEventRealtime(eventId) {
  const [event, setEvent] = useState(null)
  const [participants, setParticipants] = useState([])
  const [seating, setSeating] = useState([])
  const [currentRound, setCurrentRound] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('connecting') // 'connecting' | 'connected' | 'disconnected' | 'error'

  // リトライ管理
  const retryCountRef = useRef(0)
  const maxRetries = 5
  const retryTimeoutRef = useRef(null)
  const channelsRef = useRef([])

  // データ取得
  const refetch = useCallback(async () => {
    if (!eventId) return

    try {
      setLoading(true)
      setError(null)

      const [eventData, participantsData, roundNumber] = await Promise.all([
        getEvent(eventId),
        getParticipants(eventId),
        getLatestRoundNumber(eventId)
      ])

      setEvent(eventData)
      setParticipants(participantsData)
      setCurrentRound(roundNumber)

      if (roundNumber > 0) {
        const seatingData = await getCurrentSeating(eventId, roundNumber)
        setSeating(seatingData)
      } else {
        setSeating([])
      }

      // 成功したらリトライカウントをリセット
      retryCountRef.current = 0
    } catch (err) {
      console.error('Error fetching event data:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  // 初期データ取得
  useEffect(() => {
    refetch()
  }, [refetch])

  // チャンネル購読を設定する関数
  const setupSubscriptions = useCallback(() => {
    if (!eventId) return

    // 既存のチャンネルをクリーンアップ
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel)
    })
    channelsRef.current = []

    setConnectionStatus('connecting')

    // 参加者チャンネル
    const participantsChannel = supabase
      .channel(`minigame_participants:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'minigame_participants',
          filter: `event_id=eq.${eventId}`
        },
        async () => {
          try {
            const data = await getParticipants(eventId)
            setParticipants(data)
          } catch (err) {
            console.error('Error refetching participants:', err)
          }
        }
      )
      .subscribe((status, err) => {
        handleSubscriptionStatus('participants', status, err)
      })

    // 席配置チャンネル
    const seatingChannel = supabase
      .channel(`minigame_seating:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'minigame_seating',
          filter: `event_id=eq.${eventId}`
        },
        async () => {
          try {
            const roundNumber = await getLatestRoundNumber(eventId)
            setCurrentRound(roundNumber)
            if (roundNumber > 0) {
              const data = await getCurrentSeating(eventId, roundNumber)
              setSeating(data)
            }
          } catch (err) {
            console.error('Error refetching seating:', err)
          }
        }
      )
      .subscribe((status, err) => {
        handleSubscriptionStatus('seating', status, err)
      })

    // イベントチャンネル（status変更監視）
    const eventChannel = supabase
      .channel(`minigame_events:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'minigame_events',
          filter: `id=eq.${eventId}`
        },
        async () => {
          try {
            const eventData = await getEvent(eventId)
            setEvent(eventData)
          } catch (err) {
            console.error('Error refetching event:', err)
          }
        }
      )
      .subscribe((status, err) => {
        handleSubscriptionStatus('event', status, err)
      })

    channelsRef.current = [participantsChannel, seatingChannel, eventChannel]
  }, [eventId])

  // 購読状態ハンドリング
  const handleSubscriptionStatus = useCallback((channelName, status, err) => {
    if (status === 'SUBSCRIBED') {
      setConnectionStatus('connected')
      retryCountRef.current = 0
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.error(`Channel ${channelName} error:`, err)
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
      console.error('Max retries reached for realtime connection')
      setConnectionStatus('error')
      return
    }

    // 既存のリトライタイマーをクリア
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }

    // 指数バックオフ（1秒, 2秒, 4秒, 8秒, 16秒）
    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 16000)
    retryCountRef.current++

    console.log(`Scheduling retry ${retryCountRef.current}/${maxRetries} in ${delay}ms`)

    retryTimeoutRef.current = setTimeout(() => {
      refetch()
      setupSubscriptions()
    }, delay)
  }, [refetch, setupSubscriptions])

  // 購読のセットアップ
  useEffect(() => {
    setupSubscriptions()

    return () => {
      // クリーンアップ
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel)
      })
    }
  }, [setupSubscriptions])

  // ブラウザのオンライン/オフライン検知
  useEffect(() => {
    const handleOnline = () => {
      console.log('Browser online - reconnecting realtime')
      refetch()
      setupSubscriptions()
    }

    const handleOffline = () => {
      console.log('Browser offline')
      setConnectionStatus('disconnected')
    }

    // ページ可視性変更時の再接続
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page visible - checking connection')
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
  }, [refetch, setupSubscriptions])

  return {
    event,
    participants,
    seating,
    currentRound,
    loading,
    error,
    connectionStatus,
    refetch
  }
}
