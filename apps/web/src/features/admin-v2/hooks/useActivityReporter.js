import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../utils/supabase'

export function useActivityReporter(userId) {
  const [sessionId, setSessionId] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!userId) return

    let currentSessionId = null

    const createSession = async () => {
      const { data } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          user_agent: navigator.userAgent
        })
        .select('id')
        .single()

      if (data) {
        currentSessionId = data.id
        setSessionId(data.id)
        await supabase
          .from('users')
          .update({ is_online: true, last_active_at: new Date().toISOString() })
          .eq('id', userId)
      }
    }

    const sendHeartbeat = async () => {
      if (!currentSessionId) return
      await supabase
        .from('user_sessions')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('id', currentSessionId)
      await supabase
        .from('users')
        .update({ last_active_at: new Date().toISOString(), is_online: true })
        .eq('id', userId)
    }

    const endSession = async () => {
      if (!currentSessionId) return
      await supabase
        .from('user_sessions')
        .update({ session_end: new Date().toISOString() })
        .eq('id', currentSessionId)
      await supabase
        .from('users')
        .update({ is_online: false })
        .eq('id', userId)
    }

    createSession()
    intervalRef.current = setInterval(sendHeartbeat, 60000)

    const handleBeforeUnload = () => {
      endSession()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') endSession()
      else createSession()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      endSession()
      clearInterval(intervalRef.current)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [userId])

  return { sessionId }
}
