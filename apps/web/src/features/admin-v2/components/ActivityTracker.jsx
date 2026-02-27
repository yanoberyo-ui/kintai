import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../utils/supabase'

function getStatusInfo(lastActiveAt) {
  if (!lastActiveAt) return { label: 'オフライン', color: 'bg-gray-400', sort: 2 }
  const diff = (Date.now() - new Date(lastActiveAt).getTime()) / 60000
  if (diff < 2) return { label: 'オンライン', color: 'bg-green-500', sort: 0 }
  if (diff < 5) return { label: '離席中', color: 'bg-yellow-500', sort: 1 }
  return { label: 'オフライン', color: 'bg-gray-400', sort: 2 }
}

function formatJST(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

function formatDuration(startStr, endStr) {
  if (!startStr || !endStr) return '-'
  const ms = new Date(endStr).getTime() - new Date(startStr).getTime()
  if (ms < 0) return '-'
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  if (hours > 0) return `${hours}時間${rem}分`
  return `${rem}分`
}

function truncateUA(ua) {
  if (!ua) return '-'
  if (ua.length > 60) return ua.slice(0, 60) + '...'
  return ua
}

export default function ActivityTracker({ isDark }) {
  const [users, setUsers] = useState([])
  const [sessions, setSessions] = useState([])
  const [stats, setStats] = useState({ online: 0, todaySessions: 0, avgDuration: '-' })
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      // Fetch users
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, department, last_active_at, is_online')
        .order('last_active_at', { ascending: false, nullsFirst: false })

      // Fetch recent sessions with user info
      const { data: sessionsData } = await supabase
        .from('user_sessions')
        .select('id, user_id, session_start, session_end, last_heartbeat, user_agent, users(name)')
        .order('session_start', { ascending: false })
        .limit(50)

      const usersList = usersData || []
      const sessionsList = sessionsData || []

      // Sort users: online -> away -> offline
      const sorted = [...usersList].sort((a, b) => {
        const sa = getStatusInfo(a.last_active_at).sort
        const sb = getStatusInfo(b.last_active_at).sort
        return sa - sb
      })
      setUsers(sorted)
      setSessions(sessionsList)

      // Compute stats
      const onlineCount = usersList.filter(u => getStatusInfo(u.last_active_at).sort === 0).length

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayISO = todayStart.toISOString()

      const todaySessions = sessionsList.filter(s => s.session_start && s.session_start >= todayISO)
      const completedToday = todaySessions.filter(s => s.session_end)

      let avgDuration = '-'
      if (completedToday.length > 0) {
        const totalMs = completedToday.reduce((sum, s) => {
          return sum + (new Date(s.session_end).getTime() - new Date(s.session_start).getTime())
        }, 0)
        const avgMs = totalMs / completedToday.length
        const avgMins = Math.floor(avgMs / 60000)
        const hours = Math.floor(avgMins / 60)
        const mins = avgMins % 60
        avgDuration = hours > 0 ? `${hours}時間${mins}分` : `${mins}分`
      }

      setStats({ online: onlineCount, todaySessions: todaySessions.length, avgDuration })
    } catch (err) {
      console.error('ActivityTracker fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const cardClass = `rounded-2xl border p-5 ${
    isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
  }`
  const headingClass = `text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`
  const valueClass = `text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`
  const textClass = isDark ? 'text-gray-300' : 'text-gray-700'
  const subTextClass = isDark ? 'text-gray-500' : 'text-gray-400'
  const thClass = `px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
    isDark ? 'text-gray-400' : 'text-gray-500'
  }`
  const tdClass = `px-4 py-3 text-sm ${textClass}`

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          読み込み中...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cardClass}>
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
              isDark ? 'bg-gray-700/50' : 'bg-gray-100'
            }`}>
              <span className="text-green-500">●</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={headingClass}>現在オンライン</p>
              <p className={valueClass}>{stats.online}</p>
              <p className={`text-xs mt-1 ${subTextClass}`}>人</p>
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
              isDark ? 'bg-gray-700/50' : 'bg-gray-100'
            }`}>
              <span>📊</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={headingClass}>今日のセッション数</p>
              <p className={valueClass}>{stats.todaySessions}</p>
              <p className={`text-xs mt-1 ${subTextClass}`}>セッション</p>
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
              isDark ? 'bg-gray-700/50' : 'bg-gray-100'
            }`}>
              <span>⏱</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={headingClass}>平均セッション時間</p>
              <p className={valueClass}>{stats.avgDuration}</p>
              <p className={`text-xs mt-1 ${subTextClass}`}>今日の完了セッション</p>
            </div>
          </div>
        </div>
      </div>

      {/* Online Users */}
      <div className={cardClass}>
        <h3 className={`${headingClass} mb-4`}>ユーザーステータス</h3>
        <div className="space-y-2">
          {users.length === 0 && (
            <p className={`text-sm ${subTextClass}`}>ユーザーが見つかりません</p>
          )}
          {users.map(user => {
            const status = getStatusInfo(user.last_active_at)
            return (
              <div
                key={user.id}
                className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                  isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${status.color}`} />
                  <span className={`text-sm font-medium ${textClass}`}>{user.name || '-'}</span>
                  {user.department && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {user.department}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${subTextClass}`}>{status.label}</span>
                  <span className={`text-xs ${subTextClass}`}>
                    {user.last_active_at ? formatJST(user.last_active_at) : '-'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Session History */}
      <div className={cardClass}>
        <h3 className={`${headingClass} mb-4`}>セッション履歴</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={isDark ? 'border-b border-gray-700' : 'border-b border-gray-200'}>
                <th className={thClass}>ユーザー</th>
                <th className={thClass}>開始時間</th>
                <th className={thClass}>終了時間</th>
                <th className={thClass}>セッション時間</th>
                <th className={thClass}>ユーザーエージェント</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className={`px-4 py-8 text-center text-sm ${subTextClass}`}>
                    セッションデータがありません
                  </td>
                </tr>
              )}
              {sessions.map(session => (
                <tr key={session.id} className={isDark ? 'hover:bg-gray-700/20' : 'hover:bg-gray-50'}>
                  <td className={tdClass}>{session.users?.name || '-'}</td>
                  <td className={tdClass}>{formatJST(session.session_start)}</td>
                  <td className={tdClass}>
                    {session.session_end ? formatJST(session.session_end) : (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                      }`}>
                        進行中
                      </span>
                    )}
                  </td>
                  <td className={tdClass}>{formatDuration(session.session_start, session.session_end)}</td>
                  <td className={`${tdClass} max-w-xs`}>
                    <span className="truncate block" title={session.user_agent}>
                      {truncateUA(session.user_agent)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
