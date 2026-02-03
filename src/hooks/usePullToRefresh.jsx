import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Pull-to-refresh機能を提供するカスタムフック
 * @param {Function} onRefresh - リフレッシュ時に呼ばれる非同期関数
 * @param {Object} options - オプション設定
 * @param {number} options.threshold - 引っ張り距離の閾値（デフォルト: 80px）
 * @param {number} options.maxPull - 最大引っ張り距離（デフォルト: 120px）
 * @returns {Object} { containerRef, pullDistance, isRefreshing, isPulling }
 */
export function usePullToRefresh(onRefresh, options = {}) {
  const { threshold = 80, maxPull = 120 } = options

  const containerRef = useRef(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)

  const startY = useRef(0)
  const currentY = useRef(0)

  const handleTouchStart = useCallback((e) => {
    // スクロールが一番上の時のみ有効
    const container = containerRef.current
    if (!container || container.scrollTop > 0) return

    startY.current = e.touches[0].clientY
    setIsPulling(true)
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (!isPulling || isRefreshing) return

    const container = containerRef.current
    if (!container || container.scrollTop > 0) {
      setPullDistance(0)
      return
    }

    currentY.current = e.touches[0].clientY
    const diff = currentY.current - startY.current

    if (diff > 0) {
      // 引っ張り距離に応じて抵抗を加える（自然な感触）
      const resistance = 0.5
      const distance = Math.min(diff * resistance, maxPull)
      setPullDistance(distance)

      // ネイティブスクロールを防止
      if (distance > 10) {
        e.preventDefault()
      }
    }
  }, [isPulling, isRefreshing, maxPull])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return

    setIsPulling(false)

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } catch (error) {
        console.error('Pull-to-refresh error:', error)
      } finally {
        setIsRefreshing(false)
      }
    }

    setPullDistance(0)
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh])

  // イベントリスナーの設定
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return {
    containerRef,
    pullDistance,
    isRefreshing,
    isPulling
  }
}

/**
 * Pull-to-refreshインジケーターコンポーネント
 */
export function PullToRefreshIndicator({ pullDistance, isRefreshing, threshold = 80 }) {
  const progress = Math.min(pullDistance / threshold, 1)
  const rotation = progress * 360

  if (pullDistance === 0 && !isRefreshing) return null

  return (
    <div
      className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none z-10"
      style={{
        transform: `translateY(${pullDistance - 40}px)`,
        opacity: Math.min(pullDistance / 40, 1)
      }}
    >
      <div className={`w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center shadow-lg ${
        isRefreshing ? 'animate-spin' : ''
      }`}>
        {isRefreshing ? (
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 text-white transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
      </div>
    </div>
  )
}
