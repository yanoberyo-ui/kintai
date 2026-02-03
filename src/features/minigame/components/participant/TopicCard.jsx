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
        <div className="text-gray-500 text-center animate-pulse">
          読み込み中...
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-2xl p-4">
      <div className="text-gray-400 text-sm font-medium mb-3">
        🃏 お題カード
      </div>

      {/* カード */}
      <div
        className={`relative h-40 perspective-1000 ${isFlipping ? 'animate-flip' : ''}`}
        style={{ perspective: '1000px' }}
      >
        <div
          className={`absolute inset-0 rounded-xl transition-transform duration-500 transform-style-preserve-3d ${
            isFlipping ? 'rotate-y-180' : ''
          }`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* カード表面（お題がある場合） */}
          {currentTopic ? (
            <div
              className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 p-4 flex items-center justify-center backface-hidden"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="text-center">
                {currentTopic.topic?.category && (
                  <div className="text-purple-200 text-xs mb-2">
                    {currentTopic.topic.category}
                  </div>
                )}
                <div className="text-white text-lg font-bold">
                  {currentTopic.topic?.content}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="absolute inset-0 rounded-xl bg-gradient-to-br from-gray-700 to-gray-600 p-4 flex items-center justify-center backface-hidden"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="text-center">
                <div className="text-4xl mb-2">🎴</div>
                <div className="text-gray-400 text-sm">
                  お題を引いてください
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ボタン */}
      <button
        onClick={handleDraw}
        disabled={drawing}
        className={`w-full mt-4 py-3 rounded-xl font-medium transition-all duration-200 ${
          drawing
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500'
        }`}
      >
        {drawing ? 'めくり中...' : currentTopic ? '次のお題を引く' : 'お題を引く'}
      </button>

      {/* 引いた枚数 */}
      {currentTopic && (
        <div className="text-center mt-2 text-xs text-gray-500">
          このラウンドで引いたお題
        </div>
      )}
    </div>
  )
}
