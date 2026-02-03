import React, { useState, useEffect } from 'react'
import { getParticipantMissions, assignMissions, completeMission, uncompleteMission } from '../../utils/mission'

export default function MissionList({ eventId, participantId }) {
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    loadMissions()
  }, [eventId, participantId])

  const loadMissions = async () => {
    if (!eventId || !participantId) return
    try {
      setLoading(true)
      // まず配布を試みる（既に配布済みなら取得のみ）
      let data = await getParticipantMissions(eventId, participantId)
      if (data.length === 0) {
        // 未配布の場合は配布
        data = await assignMissions(eventId, participantId)
      }
      setMissions(data)
    } catch (error) {
      console.error('Error loading missions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (mission) => {
    try {
      setUpdating(mission.id)
      if (mission.completed) {
        await uncompleteMission(mission.id)
      } else {
        await completeMission(mission.id)
      }
      // 状態更新
      setMissions(prev =>
        prev.map(m =>
          m.id === mission.id ? { ...m, completed: !m.completed } : m
        )
      )
    } catch (error) {
      console.error('Error toggling mission:', error)
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-2xl p-5">
        <div className="text-gray-500 text-center text-base animate-pulse">
          ミッション読み込み中...
        </div>
      </div>
    )
  }

  if (missions.length === 0) {
    return (
      <div className="bg-gray-800 rounded-2xl p-5">
        <div className="text-gray-500 text-center text-base">
          ミッションがありません
        </div>
      </div>
    )
  }

  const completedCount = missions.filter(m => m.completed).length

  return (
    <div className="bg-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-gray-400 text-base font-medium">
          🎯 ミッション
        </div>
        <div className="text-sm text-gray-500 bg-gray-700 px-3 py-1 rounded-full">
          {completedCount}/{missions.length} 完了
        </div>
      </div>

      <div className="space-y-3">
        {missions.map((mission) => (
          <button
            key={mission.id}
            onClick={() => handleToggle(mission)}
            disabled={updating === mission.id}
            className={`w-full flex items-center gap-4 p-4 min-h-[56px] rounded-xl transition-all duration-200 active:scale-[0.98] ${
              mission.completed
                ? 'bg-green-900/30 text-green-300'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
            } ${updating === mission.id ? 'opacity-50' : ''}`}
          >
            {/* チェックボックス（タップしやすいサイズ） */}
            <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              mission.completed
                ? 'border-green-400 bg-green-400'
                : 'border-gray-500'
            }`}>
              {mission.completed && (
                <svg className="w-4 h-4 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>

            {/* ミッション内容 */}
            <span className={`text-base text-left flex-1 ${mission.completed ? 'line-through opacity-70' : ''}`}>
              {mission.mission?.content}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
