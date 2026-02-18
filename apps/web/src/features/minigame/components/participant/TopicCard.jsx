import React, { useState, useEffect } from 'react'
import { drawTopic, getLatestTopic } from '../../utils/topic'

export default function TopicCard({ eventId, tableId, roundNumber }) {
  const [currentTopic, setCurrentTopic] = useState(null)
  const [loading, setLoading] = useState(true)
  const [drawing, setDrawing] = useState(false)
  const [isFlipping, setIsFlipping] = useState(false)

  useEffect(() => {
    loadLatestTopic()
  }, [eventId, tableId, roundNumber])

  const loadLatestTopic = async () => {
    if (!eventId || !tableId || !roundNumber) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const data = await getLatestTopic(eventId, tableId, roundNumber)
      setCurrentTopic(data)
    } catch (error) {
      console.error('Error loading topic:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDraw = async () => {
    try {
      setDrawing(true)
      setIsFlipping(true)

      // カードめくりアニメーション用に少し待機
      await new Promise(resolve => setTimeout(resolve, 300))

      const data = await drawTopic(eventId, tableId, roundNumber)
      setCurrentTopic(data)

      // アニメーション完了を待つ
      setTimeout(() => {
        setIsFlipping(false)
      }, 300)
    } catch (error) {
      console.error('Error drawing topic:', error)
      setIsFlipping(false)
    } finally {
      setDrawing(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-2xl p-6">
        <div className="text-gray-500 text-center text-base animate-pulse">
          読み込み中...
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-2xl p-5">
      <div className="text-gray-400 text-base font-medium mb-4">
        🃏 お題カード
      </div>

      {/* カード */}
      <div
        className={`relative h-44 ${isFlipping ? 'animate-flip' : ''}`}
        style={{ perspective: '1000px' }}
      >
        <div
          className={`absolute inset-0 rounded-2xl transition-transform duration-500 ${
            isFlipping ? 'rotate-y-180' : ''
          }`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* カード表面（お題がある場合） */}
          {currentTopic ? (
            <div
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 p-5 flex items-center justify-center shadow-lg shadow-purple-500/20"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="text-center">
                {currentTopic.topic?.category && (
                  <div className="text-purple-200 text-sm mb-3 bg-purple-500/30 px-3 py-1 rounded-full inline-block">
                    {currentTopic.topic.category}
                  </div>
                )}
                <div className="text-white text-xl font-bold leading-relaxed">
                  {currentTopic.topic?.content}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-600 p-5 flex items-center justify-center"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="text-center">
                <div className="text-5xl mb-3">🎴</div>
                <div className="text-gray-400 text-base">
                  お題を引いてください
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ボタン（タップしやすいサイズ） */}
      <button
        onClick={handleDraw}
        disabled={drawing}
        className={`w-full mt-5 py-4 min-h-[56px] rounded-xl font-bold text-lg transition-all duration-200 active:scale-[0.98] ${
          drawing
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/20'
        }`}
      >
        {drawing ? 'めくり中...' : currentTopic ? '次のお題を引く' : 'お題を引く'}
      </button>

      {/* 引いた枚数 */}
      {currentTopic && (
        <div className="text-center mt-3 text-sm text-gray-500">
          このラウンドで引いたお題
        </div>
      )}
    </div>
  )
}
