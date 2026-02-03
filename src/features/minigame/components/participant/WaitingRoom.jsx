import React from 'react'

export default function WaitingRoom({ event, participants, currentParticipant }) {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* ヘッダー */}
      <div className="p-6 text-center border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">{event.name}</h1>
        <div className="text-gray-400 text-sm mt-1">
          {currentParticipant?.name}さんとして参加中
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* 待機アニメーション */}
        <div className="mb-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-gray-700 border-t-white animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl">⏳</span>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">待機中...</h2>
        <p className="text-gray-400 text-center mb-8">
          管理者がゲームを開始するまでお待ちください
        </p>

        {/* 参加者カウント */}
        <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm">
          <div className="text-center mb-4">
            <span className="text-4xl font-bold text-white">{participants.length}</span>
            <span className="text-gray-400 ml-2">人参加中</span>
          </div>

          {/* 参加者リスト */}
          <div className="flex flex-wrap gap-2 justify-center">
            {participants.map((p) => (
              <span
                key={p.id}
                className={`px-3 py-1.5 rounded-full text-sm ${
                  p.id === currentParticipant?.id
                    ? 'bg-white text-gray-900 font-bold'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {p.name}
                {p.id === currentParticipant?.id && ' (あなた)'}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
