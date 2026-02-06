import React, { useState, useEffect, useCallback } from 'react'
import { getEvents } from '../utils/event'
import { getParticipantCount, checkInWithUser, getParticipantByUserId, getAllUsers, setMinigameAdmin } from '../utils/participant'
import EventCreate from './admin/EventCreate'
import EventControl from './admin/EventControl'
import GameRound from './participant/GameRound'
import WaitingRoom from './participant/WaitingRoom'
import { useEventRealtime } from '../hooks/useEventRealtime'
import { usePullToRefresh, PullToRefreshIndicator } from '../hooks/usePullToRefresh.jsx'

export default function MinigamePage({ user, isDark }) {
  const [events, setEvents] = useState([])
  const [participantCounts, setParticipantCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAdminSettings, setShowAdminSettings] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [adminLoading, setAdminLoading] = useState(false)

  // 選択中のイベント
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [viewMode, setViewMode] = useState(null) // 'participate' | 'manage'

  const isAdmin = user?.is_minigame_admin

  const loadEvents = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  // Pull-to-refresh for event list
  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh(loadEvents)

  // 管理者設定を開く
  const handleOpenAdminSettings = async () => {
    try {
      setAdminLoading(true)
      const users = await getAllUsers()
      setAllUsers(users)
      setShowAdminSettings(true)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setAdminLoading(false)
    }
  }

  // 管理者権限トグル
  const handleToggleAdmin = async (userId, currentStatus) => {
    try {
      await setMinigameAdmin(userId, !currentStatus)
      setAllUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, is_minigame_admin: !currentStatus } : u)
      )
    } catch (error) {
      console.error('Error toggling admin:', error)
      alert('管理者権限の変更に失敗しました')
    }
  }

  // イベント参加
  const handleJoin = async (eventId) => {
    try {
      // ログインユーザーで参加登録
      await checkInWithUser(eventId, user.id, user.name || user.email.split('@')[0])
      setSelectedEventId(eventId)
      setViewMode('participate')
    } catch (error) {
      console.error('Error joining event:', error)
      alert('参加に失敗しました')
    }
  }

  // イベント管理
  const handleManage = (eventId) => {
    setSelectedEventId(eventId)
    setViewMode('manage')
  }

  // 戻る
  const handleBack = () => {
    setSelectedEventId(null)
    setViewMode(null)
    loadEvents() // リスト更新
  }

  // イベント作成完了
  const handleEventCreated = (event) => {
    setShowCreateModal(false)
    loadEvents()
  }

  // 管理画面表示
  if (selectedEventId && viewMode === 'manage') {
    return (
      <EventControl
        eventId={selectedEventId}
        isDark={isDark}
        onBack={handleBack}
      />
    )
  }

  // 参加者画面表示
  if (selectedEventId && viewMode === 'participate') {
    return (
      <ParticipantView
        eventId={selectedEventId}
        user={user}
        isDark={isDark}
        onBack={handleBack}
      />
    )
  }

  // イベント一覧
  return (
    <div
      ref={containerRef}
      className="max-w-4xl mx-auto h-[calc(100dvh-14rem)] md:h-[calc(100dvh-8rem)] overflow-y-auto relative"
      style={{
        transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
        transition: pullDistance === 0 ? 'transform 0.2s ease-out' : undefined
      }}
    >
      {/* Pull-to-refresh indicator */}
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
      />

      {/* ヘッダー */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ゲーム
          </h1>
          <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            シャッフルランチ・懇親会イベント
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAdminSettings}
              disabled={adminLoading}
              className={`p-3 rounded-xl font-medium transition-all duration-200 ${
                isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title="管理者設定"
            >
              ⚙️
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                isDark
                  ? 'bg-white text-gray-900 hover:bg-gray-100'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              + 新規イベント
            </button>
          </div>
        )}
      </div>

      {/* イベント一覧 */}
      {loading ? (
        <div className={`animate-pulse ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          読み込み中...
        </div>
      ) : events.length === 0 ? (
        <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <div className="text-4xl mb-4">🎮</div>
          <p>開催中のイベントがありません</p>
          {isAdmin && (
            <p className="text-sm mt-2">「新規イベント」からイベントを作成してください</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              participantCount={participantCounts[event.id] || 0}
              isAdmin={isAdmin}
              isDark={isDark}
              onJoin={() => handleJoin(event.id)}
              onManage={() => handleManage(event.id)}
            />
          ))}
        </div>
      )}

      {/* 作成モーダル */}
      {showCreateModal && (
        <EventCreate
          isDark={isDark}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleEventCreated}
        />
      )}

      {/* 管理者設定モーダル */}
      {showAdminSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAdminSettings(false)}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className={`relative w-full max-w-md max-h-[70vh] rounded-2xl shadow-2xl border overflow-hidden flex flex-col ${
              isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`p-5 border-b flex items-center justify-between flex-shrink-0 ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ゲーム管理者設定
              </h2>
              <button
                onClick={() => setShowAdminSettings(false)}
                className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {allUsers.map(u => (
                <div
                  key={u.id}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    isDark ? 'bg-gray-800' : 'bg-gray-100'
                  }`}
                >
                  <div>
                    <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {u.name || u.email?.split('@')[0]}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {u.email}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleAdmin(u.id, u.is_minigame_admin)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      u.is_minigame_admin
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : isDark
                        ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                    }`}
                  >
                    {u.is_minigame_admin ? '管理者' : 'OFF'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// イベントカードコンポーネント
function EventCard({ event, participantCount, isAdmin, isDark, onJoin, onManage }) {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'waiting':
        return (
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            isDark ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
          }`}>
            募集中
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

  const canJoin = event.status === 'waiting' || event.status === 'active'

  return (
    <div className={`backdrop-blur-xl rounded-2xl shadow-lg border p-5 ${
      isDark
        ? 'bg-gray-900/80 border-gray-800/50'
        : 'bg-white/80 border-gray-200/50'
    }`}>
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
            参加者: {participantCount}人
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex items-center gap-2 ml-4">
          {canJoin && (
            <button
              onClick={onJoin}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                isDark
                  ? 'bg-white text-gray-900 hover:bg-gray-100'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              参加
            </button>
          )}
          {isAdmin && (
            <button
              onClick={onManage}
              className={`px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              管理
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// 接続状態インジケーター
function ConnectionStatusIndicator({ status, isDark }) {
  if (status === 'connected') return null

  const statusConfig = {
    connecting: { text: '接続中...', color: 'text-yellow-500', icon: '🔄' },
    disconnected: { text: 'オフライン', color: 'text-orange-500', icon: '📡' },
    error: { text: '接続エラー', color: 'text-red-500', icon: '⚠️' }
  }

  const config = statusConfig[status] || statusConfig.error

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg ${
      isDark ? 'bg-gray-800' : 'bg-white'
    }`}>
      <span className={`text-sm font-medium ${config.color}`}>
        {config.icon} {config.text}
      </span>
    </div>
  )
}

// 参加者ビューコンポーネント
function ParticipantView({ eventId, user, isDark, onBack }) {
  const { event, participants, seating, currentRound, loading, connectionStatus, refetch } = useEventRealtime(eventId)
  const [participant, setParticipant] = useState(null)
  const [checkingParticipant, setCheckingParticipant] = useState(true)

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    await refetch()
    await checkParticipant()
  }, [refetch])

  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh(handleRefresh)

  const checkParticipant = useCallback(async () => {
    try {
      const p = await getParticipantByUserId(eventId, user.id)
      setParticipant(p)
    } catch (error) {
      console.error('Error checking participant:', error)
    } finally {
      setCheckingParticipant(false)
    }
  }, [eventId, user.id])

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

  if (loading || checkingParticipant) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        読み込み中...
      </div>
    )
  }

  if (!event) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        <p>イベントが見つかりません</p>
        <button
          onClick={onBack}
          className={`mt-4 px-4 py-2 rounded-xl ${
            isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900'
          }`}
        >
          戻る
        </button>
      </div>
    )
  }

  // 終了済み
  if (event.status === 'finished') {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          イベント終了
        </h2>
        <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          ご参加ありがとうございました！
        </p>
        <button
          onClick={onBack}
          className={`px-6 py-3 rounded-xl font-medium ${
            isDark
              ? 'bg-white text-gray-900 hover:bg-gray-100'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          イベント一覧に戻る
        </button>
      </div>
    )
  }

  // 待機中
  if (event.status === 'waiting') {
    return (
      <div
        ref={containerRef}
        className="-mx-8 -mt-24 h-dvh overflow-y-auto relative"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: pullDistance === 0 ? 'transform 0.2s ease-out' : undefined
        }}
      >
        <ConnectionStatusIndicator status={connectionStatus} isDark={isDark} />
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

        <WaitingRoom
          event={event}
          participants={participants}
          currentParticipant={participant}
          onBack={onBack}
        />
      </div>
    )
  }

  // ゲーム中
  if (event.status === 'active') {
    return (
      <div className="fixed inset-0 z-30 bg-gray-900">
        <ConnectionStatusIndicator status={connectionStatus} isDark={isDark} />

        {/* 戻るボタン - 固定位置 */}
        <button
          onClick={onBack}
          className="fixed top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-md bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>
        <GameRound
          eventId={eventId}
          event={event}
          participant={participant}
          seating={seating}
          currentRound={currentRound}
          onRefresh={refetch}
        />
      </div>
    )
  }

  return null
}
