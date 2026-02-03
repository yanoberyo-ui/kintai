import React, { useMemo } from 'react'
import Timer from './Timer'

export default function GameRound({ eventId, event, participant, seating, currentRound }) {
  // 自分のテーブルを探す
  const myTable = useMemo(() => {
    for (const table of seating) {
      const found = table.participants.find(p => p.id === participant.id)
      if (found) {
        return {
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

  if (!myTable) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🔄</div>
          <p className="text-gray-400">席を割り当て中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* ヘッダー */}
      <div className="p-4 text-center border-b border-gray-800">
        <div className="text-gray-400 text-sm">ラウンド {currentRound}</div>
        <h1 className="text-lg font-bold text-white">{event.name}</h1>
      </div>

      {/* タイマー */}
      <Timer eventId={eventId} />

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* テーブル番号（大きく表示） */}
        <div className="mb-8">
          <div className="text-gray-400 text-center mb-2">あなたのテーブル</div>
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <span className="text-6xl font-bold text-white">{myTable.tableNumber}</span>
          </div>
        </div>

        {/* 同席メンバー */}
        <div className="w-full max-w-sm">
          <div className="text-gray-400 text-center mb-3">同席メンバー</div>
          <div className="bg-gray-800 rounded-2xl p-4">
            {otherMembers.length === 0 ? (
              <div className="text-gray-500 text-center py-2">
                あなただけです
              </div>
            ) : (
              <div className="space-y-2">
                {otherMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-700"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-500 flex items-center justify-center text-white font-bold">
                      {member.name.charAt(0)}
                    </div>
                    <span className="text-white font-medium">{member.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ミッションエリア（MG-005で実装予定） */}
        <div className="w-full max-w-sm mt-6">
          <div className="bg-gray-800/50 border-2 border-dashed border-gray-700 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">🎯</div>
            <div className="text-gray-500 text-sm">
              ミッション機能は後日追加予定
            </div>
          </div>
        </div>
      </div>

      {/* フッター（参加者情報） */}
      <div className="p-4 border-t border-gray-800 text-center">
        <span className="text-gray-500 text-sm">{participant.name}さんとして参加中</span>
      </div>
    </div>
  )
}
