import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { supabase } from '../../../utils/supabase'

export default function RankingPage({ isDark, user }) {
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef(null)
  const fullscreenRef = useRef(null)
  const cacheRef = useRef({})

  useEffect(() => {
    if (user) {
      loadRankings()
    }
  }, [user, selectedYear, selectedMonth])

  const loadRankings = async () => {
    try {
      const cacheKey = `${selectedYear}-${selectedMonth}`

      // キャッシュがあり、5分以内なら使用
      if (cacheRef.current[cacheKey]) {
        const { data, timestamp } = cacheRef.current[cacheKey]
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setRankings(data)
          setLoading(false)
          return
        }
      }

      setLoading(true)

      // Supabase Edge Functionを呼び出してスプレッドシートから直接取得
      const { data, error } = await supabase.functions.invoke('get-unit-rankings', {
        body: { month: selectedMonth }
      })

      if (error) throw error

      if (data && data.success && data.data) {
        // 上位4位まで取得
        const rankingArray = data.data.slice(0, 4).map(unit => ({
          department: unit.department,
          achievementRate: unit.achievementRate,
          totalTasks: 0,
          completedTasks: 0
        }))

        setRankings(rankingArray)

        // キャッシュに保存
        cacheRef.current[cacheKey] = {
          data: rankingArray,
          timestamp: Date.now()
        }
      } else {
        setRankings([])
      }
    } catch (error) {
      console.error('Error loading rankings:', error)
      setRankings([])
    } finally {
      setLoading(false)
    }
  }

  // ブラウザのFullscreen APIを使用
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        // 全画面モードに入る
        if (fullscreenRef.current) {
          await fullscreenRef.current.requestFullscreen()
        }
      } else {
        // 全画面モードを解除
        await document.exitFullscreen()
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }

  // 全画面状態の変化を監視
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // スケルトンローディング - プレーンなスケルトンをシャッフル
  const [shuffleOrder, setShuffleOrder] = useState([0, 1, 2, 3])
  const cardRefs = useRef({})
  const positions = useRef({})

  useEffect(() => {
    if (loading) {
      // ローディング中だけシャッフルを繰り返す
      const shuffleInterval = setInterval(() => {
        setShuffleOrder(prev => {
          const newOrder = [...prev]
          // ランダムに2つの位置を入れ替え
          const i = Math.floor(Math.random() * 4)
          const j = Math.floor(Math.random() * 4)
          ;[newOrder[i], newOrder[j]] = [newOrder[j], newOrder[i]]
          return newOrder
        })
      }, 1500) // 1.5秒ごとにシャッフル

      return () => clearInterval(shuffleInterval)
    } else {
      // ローディング終了時は元の順序に戻す
      setShuffleOrder([0, 1, 2, 3])
      cardRefs.current = {}
      positions.current = {}
    }
  }, [loading])

  // FLIP animation: 位置変更時に滑らかにアニメーション
  useLayoutEffect(() => {
    if (!loading) return

    const cards = cardRefs.current
    const prevPositions = positions.current

    // 変更後の各カードの位置を取得
    const newPositions = {}
    Object.keys(cards).forEach(id => {
      const card = cards[id]
      if (card) {
        const rect = card.getBoundingClientRect()
        newPositions[id] = { top: rect.top }
      }
    })

    // 初回は位置を保存するだけ
    if (Object.keys(prevPositions).length === 0) {
      positions.current = newPositions
      return
    }

    // 各カードをFLIPアニメーション
    Object.keys(cards).forEach(id => {
      const card = cards[id]
      if (!card || !prevPositions[id] || !newPositions[id]) return

      const deltaY = prevPositions[id].top - newPositions[id].top

      if (deltaY === 0) return

      // Invert: 変更前の位置に瞬時に戻す
      card.style.transform = `translateY(${deltaY}px)`
      card.style.transition = 'none'

      // Play: アニメーションで元に戻す
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          card.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
          card.style.transform = 'translateY(0)'
        })
      })
    })

    // 新しい位置を保存
    positions.current = newPositions
  }, [shuffleOrder, loading])

  const SkeletonCard = ({ id }) => {
    return (
      <div
        ref={el => {
          if (el) {
            cardRefs.current[id] = el
          }
        }}
      >
        <div className={`relative p-6 md:p-8 rounded-2xl backdrop-blur-xl bg-gradient-to-br ${
          isDark ? 'from-gray-800/50 to-gray-900/50' : 'from-gray-100 to-gray-50'
        } border-2 ${
          isDark ? 'border-gray-700' : 'border-gray-300'
        } animate-pulse`}>
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
            {/* アイコンスケルトン */}
            <div className="relative flex-shrink-0">
              <div className={`w-24 h-24 md:w-28 md:h-28 rounded-2xl ${
                isDark ? 'bg-gray-700' : 'bg-gray-300'
              }`} />
            </div>

            {/* コンテンツ */}
            <div className="flex-1 space-y-4 w-full">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* ユニット名スケルトン */}
                <div className={`h-10 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} style={{ width: '60%' }} />
                {/* スコアスケルトン */}
                <div className={`h-16 w-32 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />
              </div>
              {/* プログレスバー */}
              <div className={`h-8 md:h-10 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={fullscreenRef}
      className={`relative min-h-screen transition-all duration-500 overflow-y-auto ${
        isDark
          ? 'bg-gradient-to-br from-gray-950 via-gray-900 to-black'
          : 'bg-gradient-to-br from-gray-50 via-white to-blue-50'
      }`}
    >

      {/* 背景の控えめなパーティクル */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className={`absolute top-20 left-10 w-96 h-96 rounded-full blur-3xl opacity-30 ${
          isDark ? 'bg-yellow-500' : 'bg-yellow-400'
        }`} />
        <div className={`absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl opacity-30 ${
          isDark ? 'bg-purple-500' : 'bg-purple-400'
        }`} />
      </div>

      {/* 全画面モード時の閉じるボタン */}
      {isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="fixed top-8 right-8 z-50 p-4 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold transition-all duration-300 hover:scale-110 active:scale-95 shadow-2xl"
          title="全画面を終了 (Esc)"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div className="max-w-7xl mx-auto px-4 py-12 relative z-10">
        {/* ヘッダー - シンプルで見やすく */}
        <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="text-5xl">🏆</div>
              <h1 className={`text-4xl md:text-5xl font-black tracking-tight ${
                isDark
                  ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400'
                  : 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600'
              }`}>
                ランキング
              </h1>
            </div>
            <p className={`text-base md:text-lg font-medium ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              ユニット別TODO達成率トップ4
            </p>
          </div>

          {/* 全画面ボタン（通常モード時のみ表示） */}
          {!isFullscreen && (
            <button
              onClick={toggleFullscreen}
              className={`px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2 ${
                isDark
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg'
              }`}
              title="ブラウザ全画面表示 (F11)"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
              全画面表示
            </button>
          )}
        </div>

        {/* 期間選択 - シンプルに */}
        <div className={`mb-10 p-6 rounded-2xl backdrop-blur-xl border ${
          isDark
            ? 'bg-gray-900/50 border-gray-700/50'
            : 'bg-white/50 border-gray-200/50'
        }`}>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <label className={`font-semibold ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              📅 期間:
            </label>
            <div className="flex gap-3">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className={`px-4 py-2 rounded-xl font-medium border-2 transition-all hover:scale-105 cursor-pointer ${
                  isDark
                    ? 'bg-gray-900 border-gray-700 text-white hover:border-gray-600'
                    : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                } outline-none focus:ring-2 focus:ring-blue-500`}
              >
                {[2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className={`px-4 py-2 rounded-xl font-medium border-2 transition-all hover:scale-105 cursor-pointer ${
                  isDark
                    ? 'bg-gray-900 border-gray-700 text-white hover:border-gray-600'
                    : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                } outline-none focus:ring-2 focus:ring-blue-500`}
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}月</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ランキング表示 */}
        {loading ? (
          <div className="flex flex-col gap-6">
            {shuffleOrder.map((id) => (
              <SkeletonCard key={id} id={id} />
            ))}
          </div>
        ) : rankings.length === 0 ? (
          <div className={`text-center py-20 text-xl font-bold ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}>
            データがありません
          </div>
        ) : (
          <div className="space-y-6">
            {rankings.map((unit, index) => {
              const isTop3 = index < 3
              const medals = ['🥇', '🥈', '🥉', '4️⃣']

              const rankStyles = {
                0: {
                  bg: isDark
                    ? 'from-yellow-900/40 via-yellow-800/40 to-orange-900/40'
                    : 'from-yellow-100 via-yellow-50 to-orange-100',
                  border: 'border-yellow-500',
                  glow: isDark
                    ? 'shadow-[0_0_60px_rgba(250,204,21,0.6),0_0_100px_rgba(250,204,21,0.4)]'
                    : 'shadow-[0_0_40px_rgba(202,138,4,0.4)]',
                  badgeBg: 'from-yellow-400 via-yellow-500 to-orange-500',
                  textColor: isDark ? 'text-yellow-300' : 'text-yellow-700',
                  barBg: 'from-yellow-400 via-yellow-500 to-orange-600',
                  scale: 'scale-110',
                  rank: '1st'
                },
                1: {
                  bg: isDark
                    ? 'from-gray-700/40 via-gray-600/40 to-gray-700/40'
                    : 'from-gray-100 via-gray-50 to-gray-100',
                  border: 'border-gray-400',
                  glow: isDark
                    ? 'shadow-[0_0_50px_rgba(156,163,175,0.5)]'
                    : 'shadow-[0_0_30px_rgba(107,114,128,0.3)]',
                  badgeBg: 'from-gray-300 via-gray-400 to-gray-500',
                  textColor: isDark ? 'text-gray-300' : 'text-gray-600',
                  barBg: 'from-gray-300 via-gray-400 to-gray-600',
                  scale: 'scale-105',
                  rank: '2nd'
                },
                2: {
                  bg: isDark
                    ? 'from-orange-900/40 via-orange-800/40 to-orange-900/40'
                    : 'from-orange-100 via-orange-50 to-orange-100',
                  border: 'border-orange-500',
                  glow: isDark
                    ? 'shadow-[0_0_50px_rgba(251,146,60,0.5)]'
                    : 'shadow-[0_0_30px_rgba(249,115,22,0.3)]',
                  badgeBg: 'from-orange-400 via-orange-500 to-orange-600',
                  textColor: isDark ? 'text-orange-300' : 'text-orange-700',
                  barBg: 'from-orange-400 via-orange-500 to-orange-700',
                  scale: 'scale-100',
                  rank: '3rd'
                },
                3: {
                  bg: isDark
                    ? 'from-gray-800/30 via-gray-900/30 to-gray-800/30'
                    : 'from-gray-50 via-white to-gray-50',
                  border: 'border-gray-500',
                  glow: 'shadow-xl',
                  badgeBg: 'from-gray-500 via-gray-600 to-gray-700',
                  textColor: isDark ? 'text-gray-400' : 'text-gray-600',
                  barBg: 'from-gray-500 via-gray-600 to-gray-700',
                  scale: 'scale-95',
                  rank: '4th'
                }
              }

              const style = rankStyles[index]

              return (
                <div
                  key={unit.department}
                  className={`group relative transition-all duration-500 hover:scale-[1.02] ${
                    index === 0 ? 'md:scale-105' : index === 1 ? 'md:scale-102' : 'scale-100'
                  }`}
                  style={{
                    animation: `slideIn 0.6s ease-out ${index * 100}ms backwards`
                  }}
                >
                  {/* カードデザイン - 見やすく改善 */}
                  <div className={`relative p-6 md:p-8 rounded-2xl backdrop-blur-xl bg-gradient-to-br ${style.bg} border-3 ${style.border} ${style.glow} transition-all duration-300 hover:-translate-y-1`}>

                    {/* トップ3バッジ */}
                    {isTop3 && (
                      <div className="absolute -top-3 -right-3">
                        <div className={`px-4 py-2 rounded-xl font-bold text-sm ${
                          isDark ? 'bg-yellow-500 text-gray-900' : 'bg-yellow-400 text-white'
                        } shadow-lg`}>
                          TOP {index + 1}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
                      {/* 順位バッジ - 適切なサイズに */}
                      <div className="relative flex-shrink-0">
                        <div className={`relative w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br ${style.badgeBg} flex flex-col items-center justify-center border-4 border-white/30 shadow-xl transform transition-all duration-300 group-hover:scale-110`}
                          style={{
                            boxShadow: isTop3
                              ? `0 0 40px currentColor, inset 0 0 20px rgba(255,255,255,0.3)`
                              : '0 10px 25px rgba(0,0,0,0.3)'
                          }}
                        >
                          {/* 光沢エフェクト */}
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-transparent to-transparent" />

                          <div className="text-4xl md:text-5xl mb-1">
                            {medals[index]}
                          </div>
                          <div className="text-white font-black text-sm md:text-base tracking-wide drop-shadow-md">
                            {style.rank.toUpperCase()}
                          </div>
                        </div>

                        {/* パルスリング */}
                        {isTop3 && (
                          <div className={`absolute inset-0 rounded-2xl border-2 ${style.border} animate-ping-slow opacity-40`} />
                        )}
                      </div>

                      {/* コンテンツ */}
                      <div className="flex-1 space-y-4 w-full">
                        {/* ユニット名とスコア */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <h3 className={`text-2xl md:text-3xl font-black ${style.textColor}`}>
                            {unit.department}
                          </h3>

                          {/* スコア表示 - 見やすいサイズに */}
                          <div className="text-center md:text-right">
                            <div className={`text-5xl md:text-6xl font-black ${style.textColor} transition-all duration-300 group-hover:scale-110`}
                              style={{
                                textShadow: isTop3
                                  ? `0 0 20px currentColor, 0 4px 8px rgba(0,0,0,0.4)`
                                  : '0 2px 4px rgba(0,0,0,0.3)'
                              }}
                            >
                              {unit.achievementRate}
                              <span className="text-3xl md:text-4xl">%</span>
                            </div>
                            <div className={`text-xs font-bold tracking-wider uppercase mt-1 ${
                              isDark ? 'text-white/60' : 'text-gray-500'
                            }`}>
                              SCORE
                            </div>
                          </div>
                        </div>

                        {/* プログレスバー - シンプルで見やすく */}
                        <div className="relative">
                          <div className={`relative h-8 md:h-10 rounded-xl ${
                            isDark ? 'bg-gray-950/70' : 'bg-white/70'
                          } border-2 ${style.border} overflow-hidden shadow-md`}>
                            {/* プログレス本体 */}
                            <div
                              className={`h-full bg-gradient-to-r ${style.barBg} relative transition-all duration-1000 ease-out`}
                              style={{
                                width: `${unit.achievementRate}%`,
                                boxShadow: isTop3 ? `0 0 20px currentColor` : 'none'
                              }}
                            >
                              {/* 光沢エフェクト */}
                              {isTop3 && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-fast" />
                              )}

                              {/* グラデーションオーバーレイ */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-white/20" />

                              {/* パーセンテージ表示 */}
                              {unit.achievementRate > 15 && (
                                <div className="absolute inset-0 flex items-center px-3 text-sm md:text-base font-bold text-white drop-shadow-md">
                                  {unit.achievementRate}%
                                </div>
                              )}
                            </div>

                            {/* 目盛り */}
                            <div className="absolute inset-0 flex items-center">
                              {[25, 50, 75].map(mark => (
                                <div
                                  key={mark}
                                  className={`absolute h-full w-px ${
                                    isDark ? 'bg-white/30' : 'bg-gray-400/30'
                                  }`}
                                  style={{ left: `${mark}%` }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* フッター情報 */}
        <div className={`mt-12 p-6 rounded-2xl backdrop-blur-xl border ${
          isDark
            ? 'bg-blue-900/20 border-blue-800/30'
            : 'bg-blue-50 border-blue-200/50'
        }`}>
          <div className="flex items-start gap-4">
            <div className="text-3xl">💡</div>
            <div className="flex-1">
              <h3 className={`text-lg font-bold mb-2 ${
                isDark ? 'text-blue-300' : 'text-blue-700'
              }`}>
                データソース
              </h3>
              <p className={`text-sm leading-relaxed ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                各ユニットの達成率は<span className="font-semibold">Googleスプレッドシート「報告/MG粗利11月」</span>から自動取得されています。
                データは<span className="font-semibold">5分間キャッシュ</span>され、パフォーマンスを最適化しています。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* カスタムアニメーション */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes shimmer-fast {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes ping-slow {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }

        @keyframes ping-fast {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.5;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes shuffle {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          25% {
            transform: translateY(-10px) scale(1.02);
          }
          50% {
            transform: translateY(5px) scale(0.98);
          }
          75% {
            transform: translateY(-5px) scale(1.01);
          }
        }

        @keyframes wave {
          0% {
            width: 0%;
          }
          50% {
            width: 100%;
          }
          100% {
            width: 0%;
          }
        }

        @keyframes count-up {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          25% {
            transform: translateY(-5px) rotate(5deg);
          }
          75% {
            transform: translateY(-3px) rotate(-5deg);
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .animate-shimmer-fast {
          animation: shimmer-fast 2s linear infinite;
        }

        .animate-ping-slow {
          animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        .animate-ping-fast {
          animation: ping-fast 1s ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }

        .animate-spin-slow {
          animation: spin-slow 4s linear infinite;
        }

        .animate-count-up {
          animation: count-up 1.5s ease-in-out infinite;
        }

        .animate-wave {
          animation: wave 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
