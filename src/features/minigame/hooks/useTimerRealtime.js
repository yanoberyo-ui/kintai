import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../utils/supabase'
import { getTimerState, calculateRemainingSeconds } from '../utils/timer'

/**
 * タイマーをRealtimeで購読するフック
 * @param {string} eventId - イベントID
 * @returns {Object} { remainingSeconds, isRunning, timerState, refetch }
 */
export function useTimerRealtime(eventId) {
  const [timerState, setTimerState] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

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
    } catch (error) {
      console.error('Error fetching timer state:', error)
    }
  }, [eventId])

  useEffect(() => {
    refetch()
  }, [refetch])

  // Realtime購読
  useEffect(() => {
    if (!eventId) return

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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId])

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

  return {
    remainingSeconds,
    isRunning,
    timerState,
    refetch
  }
}
