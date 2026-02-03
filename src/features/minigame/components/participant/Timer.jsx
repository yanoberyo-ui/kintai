import React, { useEffect, useState } from 'react'
import { useTimerRealtime } from '../../hooks/useTimerRealtime'

export default function Timer({ eventId }) {
  const { remainingSeconds, isRunning } = useTimerRealtime(eventId)
  const [flash, setFlash] = useState(false)

  // 残り10秒以下でフラッシュ演出
  useEffect(() => {
    if (remainingSeconds <= 10 && remainingSeconds > 0 && isRunning) {
      setFlash(true)
      const timer = setTimeout(() => setFlash(false), 200)
      return () => clearTimeout(timer)
    }
  }, [remainingSeconds, isRunning])

  // 時間フォーマット（mm:ss）
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // タイマーがない or 0の場合
  if (remainingSeconds === 0 && !isRunning) {
    return (
      <div className="bg-gray-800 py-6 px-4 text-center flex-shrink-0">
        <div className="text-4xl font-mono text-gray-500">--:--</div>
        <div className="text-sm text-gray-600 mt-2">タイマー停止中</div>
      </div>
    )
  }

  // 色の決定
  let textColor = 'text-white'
  let bgColor = 'bg-gray-800'

  if (remainingSeconds <= 10) {
    textColor = 'text-red-400'
    bgColor = flash ? 'bg-red-900' : 'bg-gray-800'
  } else if (remainingSeconds <= 60) {
    textColor = 'text-yellow-400'
  }

  return (
    <div className={`py-6 px-4 text-center transition-colors duration-200 flex-shrink-0 ${bgColor}`}>
      {/* 大きなタイマー表示（横向きでも見やすいサイズ） */}
      <div className={`text-6xl sm:text-7xl landscape:text-5xl font-mono font-bold ${textColor} transition-colors tabular-nums`}>
        {formatTime(remainingSeconds)}
      </div>
      <div className="text-sm text-gray-500 mt-2">
        {isRunning ? '残り時間' : '⏸ 一時停止中'}
      </div>
      {/* 残り1分以下で警告テキスト */}
      {remainingSeconds <= 60 && remainingSeconds > 0 && (
        <div className={`text-sm mt-1 font-medium ${remainingSeconds <= 10 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
          {remainingSeconds <= 10 ? '⚠️ まもなく終了！' : '残り1分を切りました'}
        </div>
      )}
    </div>
  )
}
