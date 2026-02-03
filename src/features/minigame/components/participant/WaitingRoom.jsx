import React from 'react'

export default function WaitingRoom({ event, participants, currentParticipant }) {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-900 flex flex-col safe-area-inset">
      {/* ヘッダー */}
      <div className="p-5 text-center border-b border-gray-800 flex-shrink-0">
        <h1 className="text-2xl font-bold text-white">{event.name}</h1>
        <div className="text-gray-400 text-base mt-2">
          {currentParticipant?.name}さんとして参加中
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        {/* 待機アニメーション */}
        <div className="mb-8 flex-shrink-0">
          <div className="relative">
            <div className="w-28 h-28 rounded-full border-4 border-gray-700 border-t-white animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl">⏳</span>
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-white mb-3 flex-shrink-0">待機中...</h2>
        <p className="text-gray-400 text-center text-lg mb-8 flex-shrink-0">
          管理者がゲームを開始するまでお待ちください
        </p>

        {/* 参加者カウント */}
        <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md">
          <div className="text-center mb-5">
            <span className="text-5xl font-bold text-white">{participants.length}</span>
            <span className="text-gray-400 text-xl ml-2">人参加中</span>
          </div>

          {/* 参加者リスト（スクロール対応） */}
          <div className="max-h-48 overflow-y-auto">
            <div className="flex flex-wrap gap-3 justify-center">
              {participants.map((p) => (
                <span
                  key={p.id}
                  className={`px-4 py-2.5 rounded-full text-base font-medium ${
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
    </div>
  )
}
