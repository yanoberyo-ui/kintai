import React, { useState, useEffect, useRef } from 'react'
import { getParticipantMissions, assignMissions, completeMission, uncompleteMission, updateMissionAnswer } from '../../utils/mission'

export default function MissionList({ eventId, participantId, otherMembers = [] }) {
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [savingAnswer, setSavingAnswer] = useState(null)
  const assignedRef = useRef(false)

  useEffect(() => {
    if (!eventId || !participantId) return
    // 未配布 & otherMembersが来たらもう一度トライ
    if (assignedRef.current && missions.length > 0) return
    loadMissions()
  }, [eventId, participantId, otherMembers.length])

  const loadMissions = async () => {
    if (!eventId || !participantId) return
    try {
      if (!assignedRef.current) setLoading(true)
      // まず配布を試みる（既に配布済みなら取得のみ）
      let data = await getParticipantMissions(eventId, participantId)
      if (data.length === 0 && otherMembers.length > 0) {
        // 未配布の場合は配布（同席メンバーを渡す）
        data = await assignMissions(eventId, participantId, otherMembers)
      }
      if (data.length > 0) assignedRef.current = true
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

  // 回答保存
  const handleAnswerBlur = async (missionId, answer) => {
    try {
      setSavingAnswer(missionId)
      await updateMissionAnswer(missionId, answer)
      // 状態更新
      setMissions(prev =>
        prev.map(m =>
          m.id === missionId ? { ...m, answer } : m
        )
      )
    } catch (error) {
      console.error('Error saving answer:', error)
    } finally {
      setSavingAnswer(null)
    }
  }

  // ミッション内容を表示（{name}をターゲット名で置換）
  const getMissionContent = (mission) => {
    let content = mission.mission?.content || ''
    if (mission.target?.name) {
      content = content.replace('{name}', mission.target.name)
    }
    return content
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

      <div className="space-y-4">
        {missions.map((mission) => (
          <div key={mission.id} className="space-y-2">
            {/* ミッションカード */}
            <button
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
                {getMissionContent(mission)}
              </span>
            </button>

            {/* 回答入力欄 */}
            <div className="ml-11">
              <input
                type="text"
                placeholder="回答を入力..."
                defaultValue={mission.answer || ''}
                onBlur={(e) => {
                  const newAnswer = e.target.value.trim()
                  if (newAnswer !== (mission.answer || '')) {
                    handleAnswerBlur(mission.id, newAnswer)
                  }
                }}
                className={`w-full px-3 py-2 rounded-lg bg-gray-700/50 border border-gray-600 text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  savingAnswer === mission.id ? 'opacity-50' : ''
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
