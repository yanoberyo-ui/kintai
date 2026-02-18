import React, { useMemo, useCallback } from 'react'
import Timer from './Timer'
import MissionList from './MissionList'
import TopicCard from './TopicCard'
import { usePullToRefresh, PullToRefreshIndicator } from '../../hooks/usePullToRefresh.jsx'

export default function GameRound({ eventId, event, participant, seating, currentRound, onRefresh }) {
  // 自分のテーブルを探す
  const myTable = useMemo(() => {
    for (const table of seating) {
      const found = table.participants.find(p => p.id === participant.id)
      if (found) {
        return {
          tableId: table.table.id,
          tableNumber: table.table.table_number,
          members: table.participants
        }
      }
    }
    return null
  }, [seating, participant.id])

  // 同席メンバー（自分以外）
  const otherMembers = useMemo(() => {
    if (!myTable) return []
    return myTable.members.filter(p => p.id !== participant.id)
  }, [myTable, participant.id])

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (onRefresh) await onRefresh()
  }, [onRefresh])
  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh(handleRefresh)

  // 席が見つからない、または席配置が未確定の場合
  if (!myTable || !seating.isConfirmed) {
    return (
      <div className="h-dvh bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">🔄</div>
          <p className="text-gray-400 text-lg">席を割り当て中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh bg-gray-900 flex flex-col safe-area-inset overflow-hidden">
      {/* ヘッダー */}
      <div className="p-4 text-center border-b border-gray-800 flex-shrink-0">
        <div className="text-gray-400 text-base">ラウンド {currentRound}</div>
        <h1 className="text-xl font-bold text-white">{event.name}</h1>
      </div>

      {/* タイマー（固定表示） */}
      <Timer eventId={eventId} />

      {/* メインコンテンツ（スクロール可能 + pull-to-refresh） */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: pullDistance === 0 ? 'transform 0.2s ease-out' : undefined
        }}
      >
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
        <div className="p-5 pb-8 space-y-6">
          {/* テーブル番号（大きく表示） - 横向きでは小さめに */}
          <div className="text-center">
            <div className="text-gray-400 text-base mb-3">あなたのテーブル</div>
            <div className="w-36 h-36 landscape:w-24 landscape:h-24 mx-auto rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <span className="text-7xl landscape:text-5xl font-bold text-white">{myTable.tableNumber}</span>
            </div>
          </div>

          {/* 同席メンバー */}
          <div className="w-full max-w-md mx-auto">
            <div className="text-gray-400 text-center text-base mb-3">同席メンバー</div>
            <div className="bg-gray-800 rounded-2xl p-4">
              {otherMembers.length === 0 ? (
                <div className="text-gray-500 text-center py-3 text-base">
                  あなただけです
                </div>
              ) : (
                <div className="space-y-3">
                  {otherMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-gray-700"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-600 to-gray-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <span className="text-white font-medium text-lg">{member.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ミッション */}
          <div className="w-full max-w-md mx-auto">
            <MissionList eventId={eventId} participantId={participant.id} otherMembers={otherMembers} />
          </div>

          {/* お題カード */}
          <div className="w-full max-w-md mx-auto">
            <TopicCard eventId={eventId} tableId={myTable.tableId} roundNumber={currentRound} />
          </div>
        </div>
      </div>

      {/* フッター（参加者情報） */}
      <div className="p-4 border-t border-gray-800 text-center flex-shrink-0 bg-gray-900">
        <span className="text-gray-500 text-base">{participant.name}さんとして参加中</span>
      </div>
    </div>
  )
}
