import React, { useState, useCallback } from 'react'
import { useEventRealtime } from '../../hooks/useEventRealtime'
import { useTimerRealtime } from '../../hooks/useTimerRealtime'
import { usePullToRefresh, PullToRefreshIndicator } from '../../hooks/usePullToRefresh.jsx'
import { updateEventStatus } from '../../utils/event'
import { assignSeating, getLatestRoundNumber } from '../../utils/seating'
import { startTimer, pauseTimer, resumeTimer, resetTimer } from '../../utils/timer'

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

export default function EventControl({ eventId, isDark, onBack }) {
  const { event, participants, seating, currentRound, loading, connectionStatus, refetch } = useEventRealtime(eventId)
  const { remainingSeconds, isRunning, connectionStatus: timerConnectionStatus, refetch: timerRefetch } = useTimerRealtime(eventId)
  const [actionLoading, setActionLoading] = useState(false)
  const [timerDuration, setTimerDuration] = useState(5) // 分

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), timerRefetch()])
  }, [refetch, timerRefetch])

  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh(handleRefresh)

  // 参加用URL
  const participantUrl = `${window.location.origin}/minigame/${eventId}`

  // URLをコピー
  const copyUrl = useCallback(() => {
    navigator.clipboard.writeText(participantUrl)
    alert('URLをコピーしました')
  }, [participantUrl])

  // ゲーム開始
  const handleStart = async () => {
    if (participants.length < 2) {
      alert('参加者が2人以上必要です')
      return
    }
    try {
      setActionLoading(true)
      await assignSeating(eventId, 1)
      await updateEventStatus(eventId, 'active')
      await refetch()
    } catch (error) {
      console.error('Error starting game:', error)
      alert('ゲーム開始に失敗しました')
    } finally {
      setActionLoading(false)
    }
  }

  // シャッフル（新ラウンド）
  const handleShuffle = async () => {
    try {
      setActionLoading(true)
      const nextRound = currentRound + 1
      await assignSeating(eventId, nextRound)
      await refetch()
    } catch (error) {
      console.error('Error shuffling:', error)
      alert('シャッフルに失敗しました')
    } finally {
      setActionLoading(false)
    }
  }

  // タイマー開始
  const handleTimerStart = async () => {
    try {
      await startTimer(eventId, timerDuration * 60)
    } catch (error) {
      console.error('Error starting timer:', error)
      alert('タイマー開始に失敗しました')
    }
  }

  // タイマー一時停止/再開
  const handleTimerToggle = async () => {
    try {
      if (isRunning) {
        await pauseTimer(eventId)
      } else {
        await resumeTimer(eventId)
      }
    } catch (error) {
      console.error('Error toggling timer:', error)
    }
  }

  // タイマーリセット
  const handleTimerReset = async () => {
    try {
      await resetTimer(eventId, timerDuration * 60)
    } catch (error) {
      console.error('Error resetting timer:', error)
    }
  }

  // 終了
  const handleFinish = async () => {
    if (!confirm('イベントを終了しますか？')) return
    try {
      setActionLoading(true)
      await updateEventStatus(eventId, 'finished')
      await refetch()
    } catch (error) {
      console.error('Error finishing event:', error)
      alert('終了に失敗しました')
    } finally {
      setActionLoading(false)
    }
  }

  // 時間フォーマット
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // 接続状態を統合（どちらかが切断状態なら表示）
  const overallConnectionStatus = connectionStatus !== 'connected' ? connectionStatus : timerConnectionStatus

  if (loading) {
    return (
      <div className={`animate-pulse ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        読み込み中...
      </div>
    )
  }

  if (!event) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        イベントが見つかりません
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="max-w-4xl mx-auto h-[calc(100dvh-14rem)] md:h-[calc(100dvh-8rem)] overflow-y-auto relative"
      style={{
        transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
        transition: pullDistance === 0 ? 'transform 0.2s ease-out' : undefined
      }}
    >
      {/* 接続状態インジケーター */}
      <ConnectionStatusIndicator status={overallConnectionStatus} isDark={isDark} />

      {/* Pull-to-refresh indicator */}
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* ヘッダー */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className={`flex items-center gap-2 mb-4 px-4 py-2 rounded-xl transition-colors ${
            isDark
              ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>
        <div className="flex items-center gap-4">
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {event.name}
          </h1>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
            event.status === 'waiting'
              ? isDark ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
              : event.status === 'active'
              ? isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
              : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
          }`}>
            {event.status === 'waiting' ? '待機中' : event.status === 'active' ? '進行中' : '終了'}
          </span>
        </div>
      </div>

      {/* 参加用URL */}
      <div className={`backdrop-blur-xl rounded-2xl shadow-lg border p-4 mb-6 ${
        isDark ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'
      }`}>
        <div className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          参加用URL
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={participantUrl}
            readOnly
            className={`flex-1 px-4 py-2 rounded-xl border text-sm ${
              isDark
                ? 'bg-gray-800 border-gray-700 text-gray-300'
                : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
          />
          <button
            onClick={copyUrl}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              isDark
                ? 'bg-white text-gray-900 hover:bg-gray-100'
                : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            コピー
          </button>
        </div>
      </div>

      {/* 操作パネル */}
      <div className={`backdrop-blur-xl rounded-2xl shadow-lg border p-5 md:p-6 mb-6 ${
        isDark ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'
      }`}>
        <h2 className={`text-xl md:text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          操作
        </h2>

        {event.status === 'waiting' && (
          <button
            onClick={handleStart}
            disabled={actionLoading || participants.length < 2}
            className={`w-full py-5 md:py-4 rounded-xl font-bold text-xl md:text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-green-600 text-white hover:bg-green-500'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {actionLoading ? '処理中...' : 'ゲーム開始'}
          </button>
        )}

        {event.status === 'active' && (
          <div className="space-y-5 md:space-y-4">
            {/* タイマー */}
            <div className={`p-5 md:p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className={`text-6xl md:text-4xl font-bold text-center mb-5 md:mb-4 tabular-nums ${
                remainingSeconds <= 60
                  ? 'text-red-500'
                  : isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {formatTime(remainingSeconds)}
              </div>
              <div className="flex items-center justify-center gap-3 mb-4 md:mb-3">
                <input
                  type="number"
                  value={timerDuration}
                  onChange={(e) => setTimerDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  className={`w-24 md:w-20 px-4 md:px-3 py-3 md:py-2 rounded-lg border text-center text-lg md:text-base ${
                    isDark
                      ? 'bg-gray-900 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
                <span className={`text-lg md:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>分</span>
              </div>
              <div className="flex gap-3 md:gap-2">
                <button
                  onClick={handleTimerStart}
                  className={`flex-1 py-4 md:py-2 rounded-lg font-medium text-lg md:text-base ${
                    isDark
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  スタート
                </button>
                <button
                  onClick={handleTimerToggle}
                  className={`flex-1 py-4 md:py-2 rounded-lg font-medium text-lg md:text-base ${
                    isDark
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-gray-300 text-gray-900 hover:bg-gray-400'
                  }`}
                >
                  {isRunning ? '一時停止' : '再開'}
                </button>
                <button
                  onClick={handleTimerReset}
                  className={`flex-1 py-4 md:py-2 rounded-lg font-medium text-lg md:text-base ${
                    isDark
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-gray-300 text-gray-900 hover:bg-gray-400'
                  }`}
                >
                  リセット
                </button>
              </div>
            </div>

            {/* シャッフル */}
            <button
              onClick={handleShuffle}
              disabled={actionLoading}
              className={`w-full py-4 md:py-3 rounded-xl font-medium text-lg md:text-base transition-all duration-200 disabled:opacity-50 ${
                isDark
                  ? 'bg-purple-600 text-white hover:bg-purple-500'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {actionLoading ? '処理中...' : `シャッフル（ラウンド${currentRound + 1}へ）`}
            </button>

            {/* 終了 */}
            <button
              onClick={handleFinish}
              disabled={actionLoading}
              className={`w-full py-4 md:py-3 rounded-xl font-medium text-lg md:text-base transition-all duration-200 disabled:opacity-50 ${
                isDark
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              イベント終了
            </button>
          </div>
        )}

        {event.status === 'finished' && (
          <div className={`text-center py-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            このイベントは終了しました
          </div>
        )}
      </div>

      {/* 参加者一覧 */}
      <div className={`backdrop-blur-xl rounded-2xl shadow-lg border p-5 md:p-6 mb-6 ${
        isDark ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'
      }`}>
        <h2 className={`text-xl md:text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          参加者 ({participants.length}人)
        </h2>
        {participants.length === 0 ? (
          <div className={`text-center py-6 md:py-4 text-lg md:text-base ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            まだ参加者がいません
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 md:gap-2">
            {participants.map((p) => (
              <span
                key={p.id}
                className={`px-4 md:px-3 py-2 md:py-1.5 rounded-full text-base md:text-sm ${
                  isDark
                    ? 'bg-gray-800 text-gray-300'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {p.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 席配置（ゲーム中のみ） */}
      {event.status === 'active' && seating.length > 0 && (
        <div className={`backdrop-blur-xl rounded-2xl shadow-lg border p-5 md:p-6 ${
          isDark ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'
        }`}>
          <h2 className={`text-xl md:text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            現在の席配置（ラウンド{currentRound}）
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {seating.map((table) => (
              <div
                key={table.table.id}
                className={`p-5 md:p-4 rounded-xl ${
                  isDark ? 'bg-gray-800' : 'bg-gray-100'
                }`}
              >
                <div className={`text-lg md:text-base font-bold mb-3 md:mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  テーブル {table.table.table_number}
                </div>
                <div className="space-y-2 md:space-y-1">
                  {table.participants.map((p) => (
                    <div
                      key={p.id}
                      className={`text-base md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
