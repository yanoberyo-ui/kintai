import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useEventRealtime } from '../../hooks/useEventRealtime'
import { getParticipantBySession } from '../../utils/participant'
import CheckInPage from './CheckInPage'
import WaitingRoom from './WaitingRoom'
import GameRound from './GameRound'

// セッションIDの管理
const getSessionId = () => {
  let sessionId = localStorage.getItem('minigame_session_id')
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem('minigame_session_id', sessionId)
  }
  return sessionId
}

export default function MinigameApp() {
  const { eventId } = useParams()
  const sessionId = getSessionId()
  const { event, participants, seating, currentRound, loading, refetch } = useEventRealtime(eventId)
  const [participant, setParticipant] = useState(null)
  const [checkingIn, setCheckingIn] = useState(true)

  // 参加者情報を取得
  const checkParticipant = useCallback(async () => {
    if (!eventId) return
    try {
      const p = await getParticipantBySession(eventId, sessionId)
      setParticipant(p)
    } catch (error) {
      console.error('Error checking participant:', error)
    } finally {
      setCheckingIn(false)
    }
  }, [eventId, sessionId])

  useEffect(() => {
    checkParticipant()
  }, [checkParticipant])

  // participants更新時に自分の情報も更新
  useEffect(() => {
    if (participants.length > 0 && participant) {
      const updated = participants.find(p => p.id === participant.id)
      if (updated) {
        setParticipant(updated)
      }
    }
  }, [participants, participant?.id])

  // チェックイン完了時
  const handleCheckInComplete = (p) => {
    setParticipant(p)
  }

  if (loading || checkingIn) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">読み込み中...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">😢</div>
          <h1 className="text-2xl font-bold text-white mb-2">イベントが見つかりません</h1>
          <p className="text-gray-400">URLを確認してください</p>
        </div>
      </div>
    )
  }

  // イベント終了
  if (event.status === 'finished') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-2">イベント終了</h1>
          <p className="text-gray-400">ご参加ありがとうございました！</p>
        </div>
      </div>
    )
  }

  // 未チェックイン
  if (!participant) {
    return (
      <CheckInPage
        eventId={eventId}
        eventName={event.name}
        sessionId={sessionId}
        onCheckInComplete={handleCheckInComplete}
      />
    )
  }

  // 待機中（イベントがwaiting）
  if (event.status === 'waiting') {
    return (
      <WaitingRoom
        event={event}
        participants={participants}
        currentParticipant={participant}
      />
    )
  }

  // ゲーム中（イベントがactive）
  if (event.status === 'active') {
    return (
      <GameRound
        eventId={eventId}
        event={event}
        participant={participant}
        seating={seating}
        currentRound={currentRound}
      />
    )
  }

  // フォールバック
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="text-gray-400">不明な状態です</div>
    </div>
  )
}
