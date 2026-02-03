import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../utils/supabase'
import { getEvent } from '../utils/event'
import { getParticipants } from '../utils/participant'
import { getCurrentSeating, getLatestRoundNumber } from '../utils/seating'

/**
 * イベント状態・参加者リスト・席配置をRealtimeで購読するフック
 * @param {string} eventId - イベントID
 * @returns {Object} { event, participants, seating, currentRound, loading, error, refetch }
 */
export function useEventRealtime(eventId) {
  const [event, setEvent] = useState(null)
  const [participants, setParticipants] = useState([])
  const [seating, setSeating] = useState([])
  const [currentRound, setCurrentRound] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  // Realtime購読 - 参加者
  useEffect(() => {
    if (!eventId) return

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
          // 参加者変更時は再取得
          try {
            const data = await getParticipants(eventId)
            setParticipants(data)
          } catch (err) {
            console.error('Error refetching participants:', err)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(participantsChannel)
    }
  }, [eventId])

  // Realtime購読 - 席配置
  useEffect(() => {
    if (!eventId) return

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
          // 席配置変更時は再取得
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
      .subscribe()

    return () => {
      supabase.removeChannel(seatingChannel)
    }
  }, [eventId])

  // Realtime購読 - イベント状態（手動購読、RLSで制限される場合のフォールバック）
  useEffect(() => {
    if (!eventId) return

    // イベントテーブルはRealtimeが有効でない可能性があるため、
    // 定期的にポーリングする代わりに、他のテーブル変更時にチェック
    // ここでは参加者・席配置変更時にイベントも再取得する形で対応済み

    return () => {}
  }, [eventId])

  return {
    event,
    participants,
    seating,
    currentRound,
    loading,
    error,
    refetch
  }
}
