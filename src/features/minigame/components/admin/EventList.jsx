import React, { useState, useEffect } from 'react'
import { getEvents, deleteEvent } from '../../utils/event'
import { getParticipantCount } from '../../utils/participant'

export default function EventList({ isDark, onSelectEvent }) {
  const [events, setEvents] = useState([])
  const [participantCounts, setParticipantCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      setLoading(true)
      const data = await getEvents()
      setEvents(data || [])

      // 参加人数を取得
      const counts = {}
      for (const event of data || []) {
        counts[event.id] = await getParticipantCount(event.id)
      }
      setParticipantCounts(counts)
    } catch (error) {
      console.error('Error loading events:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (e, eventId) => {
    e.stopPropagation()
    if (!confirm('このイベントを削除しますか？')) return

    try {
      await deleteEvent(eventId)
      await loadEvents()
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('削除に失敗しました')
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'waiting':
        return (
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            isDark ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
          }`}>
            待機中
          </span>
        )
      case 'active':
        return (
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
          }`}>
            進行中
          </span>
        )
      case 'finished':
        return (
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
          }`}>
            終了
          </span>
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className={`animate-pulse ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        読み込み中...
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        <div className="text-4xl mb-4">🎮</div>
        <p>イベントがありません</p>
        <p className="text-sm mt-2">「新規イベント」からイベントを作成してください</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <button
          key={event.id}
          onClick={() => onSelectEvent(event.id)}
          className={`w-full text-left backdrop-blur-xl rounded-2xl shadow-lg border p-5 transition-all duration-200 hover:scale-[1.02] ${
            isDark
              ? 'bg-gray-900/80 border-gray-800/50 hover:bg-gray-800/80'
              : 'bg-white/80 border-gray-200/50 hover:bg-white/90'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className={`text-lg font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {event.name}
                </h3>
                {getStatusBadge(event.status)}
              </div>
              {event.description && (
                <p className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {event.description}
                </p>
              )}
              <div className={`text-sm mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                参加者: {participantCounts[event.id] || 0}人
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={(e) => handleDelete(e, event.id)}
                className={`p-2 rounded-xl transition-colors ${
                  isDark
                    ? 'hover:bg-red-900/50 text-gray-500 hover:text-red-400'
                    : 'hover:bg-red-50 text-gray-400 hover:text-red-500'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <svg className={`w-5 h-5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
