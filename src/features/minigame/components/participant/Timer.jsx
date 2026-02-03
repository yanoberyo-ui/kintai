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
      <div className="bg-gray-800 p-4 text-center">
        <div className="text-2xl font-mono text-gray-500">--:--</div>
        <div className="text-xs text-gray-600 mt-1">タイマー停止中</div>
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
    <div className={`p-4 text-center transition-colors duration-200 ${bgColor}`}>
      <div className={`text-5xl font-mono font-bold ${textColor} transition-colors`}>
        {formatTime(remainingSeconds)}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {isRunning ? '残り時間' : '一時停止中'}
      </div>
    </div>
  )
}
