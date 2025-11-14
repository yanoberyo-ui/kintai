import { useState, useEffect, useRef } from 'react'
import { supabase } from '../utils/supabase'

export default function RankingPage({ isDark, user }) {
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (user) {
      loadRankings()
    }
  }, [user, selectedYear, selectedMonth])

  const loadRankings = async () => {
    try {
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

  // CSS疑似全画面モードの切り替え（Safari対応）
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const getRankColor = (rank) => {
    switch(rank) {
      case 0: return 'from-yellow-400 via-yellow-500 to-yellow-600' // 1位: ゴールド
      case 1: return 'from-gray-300 via-gray-400 to-gray-500' // 2位: シルバー
      case 2: return 'from-orange-400 via-orange-500 to-orange-600' // 3位: ブロンズ
      case 3: return 'from-gray-600 to-gray-700' // 4位: ダークグレー（ベニヤ板風）
      default: return 'from-gray-400 to-gray-600'
    }
  }

  const getRankEmoji = (rank) => {
    switch(rank) {
      case 0: return '👑'
      case 1: return '🥈'
      case 2: return '🥉'
      case 3: return '📋'
      default: return '🏆'
    }
  }

  const getRankSize = (rank) => {
    switch(rank) {
      case 0: return 'scale-110' // 1位は大きく
      case 1: return 'scale-105'
      case 2: return 'scale-100'
      case 3: return 'scale-95'
      default: return 'scale-100'
    }
  }

  const getRankStyle = (rank) => {
    switch(rank) {
      case 0: return 'shadow-2xl shadow-yellow-500/50 border-4 border-yellow-400' // 1位: ゴールドの輝き
      case 1: return 'shadow-2xl shadow-gray-400/50 border-4 border-gray-300' // 2位: シルバーの輝き
      case 2: return 'shadow-2xl shadow-orange-500/50 border-4 border-orange-400' // 3位: ブロンズの輝き
      case 3: return 'shadow-md border border-gray-600' // 4位: シンプルな影
      default: return 'shadow-md'
    }
  }

  const getRankBadgeStyle = (rank) => {
    if (rank === 3) {
      // 4位はベニヤ板風
      return 'bg-gradient-to-br from-amber-900 to-amber-950 border-2 border-amber-800'
    }
    // 1〜3位は豪華なグラデーション
    return `bg-gradient-to-br ${getRankColor(rank)}`
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`animate-pulse text-lg ${
          isDark ? 'text-gray-400' : 'text-gray-600'
        }`}>Loading...</div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`min-h-screen transition-all duration-500 ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      } ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] overflow-auto'
          : ''
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className={`text-4xl font-bold mb-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              🏆 ユニット別ランキング
            </h1>
            <p className={`text-lg ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              TODO達成率で競い合おう！
            </p>
          </div>
          
          {/* 全画面ボタン */}
          <button
            onClick={toggleFullscreen}
            className={`px-4 py-2 rounded-xl font-medium transition-all hover:scale-105 ${
              isDark 
                ? 'bg-gray-800 hover:bg-gray-700 text-white' 
                : 'bg-white hover:bg-gray-100 text-gray-900 border-2 border-gray-200'
            }`}
            title={isFullscreen ? '全画面を終了' : '全画面表示'}
          >
            {isFullscreen ? '⬇ 通常表示' : '⬆ 全画面'}
          </button>
        </div>

        {/* 期間選択 */}
        <div className={`mb-8 flex gap-4 items-center p-4 rounded-2xl ${
          isDark ? 'bg-gray-800/50' : 'bg-white'
        }`}>
          <label className={`font-medium ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            期間選択:
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className={`px-4 py-2 rounded-xl border-2 transition-colors ${
              isDark
                ? 'bg-gray-900 border-gray-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            {[2024, 2025, 2026].map(year => (
              <option key={year} value={year}>{year}年</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className={`px-4 py-2 rounded-xl border-2 transition-colors ${
              isDark
                ? 'bg-gray-900 border-gray-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}月</option>
            ))}
          </select>
        </div>

        {/* ランキング表示 - アーケードゲーム風ハイスコア */}
        {rankings.length === 0 ? (
          <div className={`text-center py-12 ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}>
            データがありません
          </div>
        ) : (
          <div className="space-y-6">
            {rankings.map((unit, index) => {
              const isTop3 = index < 3
              
              // ライトモードとダークモードで色を切り替え
              const rankColors = isDark ? {
                0: { border: 'border-yellow-400', glow: 'shadow-[0_0_40px_rgba(250,204,21,0.6)]', bg: 'from-yellow-500/20 to-orange-500/20', text: 'text-yellow-400', barBg: 'from-yellow-400 to-orange-500', cardBg: 'bg-yellow-500/10' },
                1: { border: 'border-gray-300', glow: 'shadow-[0_0_30px_rgba(209,213,219,0.5)]', bg: 'from-gray-400/20 to-gray-500/20', text: 'text-gray-300', barBg: 'from-gray-300 to-gray-500', cardBg: 'bg-gray-400/10' },
                2: { border: 'border-orange-400', glow: 'shadow-[0_0_30px_rgba(251,146,60,0.5)]', bg: 'from-orange-500/20 to-orange-600/20', text: 'text-orange-400', barBg: 'from-orange-400 to-orange-600', cardBg: 'bg-orange-500/10' },
                3: { border: 'border-gray-600', glow: 'shadow-md', bg: 'from-gray-700/20 to-gray-800/20', text: 'text-gray-500', barBg: 'from-gray-600 to-gray-700', cardBg: 'bg-gray-700/10' }
              } : {
                0: { border: 'border-yellow-600', glow: 'shadow-[0_0_20px_rgba(202,138,4,0.4)]', bg: 'from-yellow-100 to-orange-100', text: 'text-yellow-800', barBg: 'from-yellow-500 to-orange-600', cardBg: 'bg-yellow-50' },
                1: { border: 'border-gray-400', glow: 'shadow-[0_0_20px_rgba(156,163,175,0.3)]', bg: 'from-gray-100 to-gray-200', text: 'text-gray-700', barBg: 'from-gray-400 to-gray-600', cardBg: 'bg-gray-50' },
                2: { border: 'border-orange-500', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]', bg: 'from-orange-100 to-orange-200', text: 'text-orange-700', barBg: 'from-orange-500 to-orange-700', cardBg: 'bg-orange-50' },
                3: { border: 'border-gray-500', glow: 'shadow-md', bg: 'from-gray-200 to-gray-300', text: 'text-gray-600', barBg: 'from-gray-500 to-gray-700', cardBg: 'bg-gray-100' }
              }
              
              const colors = rankColors[index]

              return (
                <div
                  key={unit.department}
                  className={`relative transform transition-all duration-700 hover:scale-105 ${
                    index === 0 ? 'scale-110' : index === 1 ? 'scale-105' : index === 2 ? 'scale-100' : 'scale-95 opacity-60'
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors.bg} backdrop-blur-xl border-4 ${colors.border} ${colors.glow} ${
                    isTop3 ? 'animate-neon-pulse' : ''
                  }`}>
                    {/* ピクセルグリッド背景 */}
                    <div className="absolute inset-0 opacity-5" style={{
                      backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, currentColor 2px, currentColor 4px), repeating-linear-gradient(90deg, transparent, transparent 2px, currentColor 2px, currentColor 4px)',
                      backgroundSize: '20px 20px'
                    }} />

                    {/* 走査線エフェクト（トップ3のみ） */}
                    {isTop3 && (
                      <div className="absolute inset-0 opacity-10 animate-scan-line" style={{
                        background: 'linear-gradient(transparent 50%, currentColor 50%)',
                        backgroundSize: '100% 4px'
                      }} />
                    )}

                    {/* スコアボード風レイアウト */}
                    <div className={`relative ${index === 0 ? 'p-8' : index < 3 ? 'p-6' : 'p-4'} flex items-center gap-6`}>
                      {/* 順位バッジ */}
                      <div className="flex-shrink-0">
                        <div className={`relative ${index === 0 ? 'w-28 h-28' : index < 3 ? 'w-20 h-20' : 'w-16 h-16'} rounded-xl bg-gradient-to-br ${colors.barBg} flex items-center justify-center border-4 border-white/20 ${
                          isTop3 ? `shadow-[0_0_20px_currentColor] ${colors.text}` : ''
                        }`}>
                          {isTop3 && <div className="absolute inset-0 rounded-xl animate-ping-slow bg-current opacity-20" />}
                          <div className="text-center relative z-10">
                            <div className={`${index === 0 ? 'text-5xl' : index < 3 ? 'text-3xl' : 'text-2xl'} mb-1`}>
                              {index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📋'}
                            </div>
                            <div className={`text-white font-black pixel-font ${index === 0 ? 'text-xl' : index < 3 ? 'text-sm' : 'text-xs'}`}>
                              {['1ST', '2ND', '3RD', '4TH'][index]}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ユニット名 + スコア表示 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-2">
                          <h3 className={`font-black pixel-font ${colors.text} ${index === 0 ? 'text-2xl md:text-3xl' : index < 3 ? 'text-xl md:text-2xl' : 'text-base md:text-lg'} break-words`} style={{
                            textShadow: isTop3 ? `0 0 20px currentColor` : 'none'
                          }}>
                            {unit.department}
                          </h3>

                          {/* スコア表示（ゲーム風） */}
                          <div className="text-center md:text-right md:ml-4 flex-shrink-0">
                            <div className={`${colors.text} font-black pixel-font ${index === 0 ? 'text-4xl md:text-5xl' : index < 3 ? 'text-3xl md:text-4xl' : 'text-xl md:text-2xl'}`} style={{
                              textShadow: isTop3 ? `0 0 30px currentColor, 0 0 60px currentColor` : 'none'
                            }}>
                              {unit.achievementRate}
                              <span className={index === 0 ? 'text-2xl md:text-3xl' : index < 3 ? 'text-xl md:text-2xl' : 'text-base md:text-lg'}>%</span>
                            </div>
                            {isTop3 && (
                              <div className={`text-xs pixel-font mt-1 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>SCORE</div>
                            )}
                          </div>
                        </div>

                        {/* プログレスバー（ゲージ風） */}
                        <div className={`relative ${index === 0 ? 'h-6' : index < 3 ? 'h-5' : 'h-4'} rounded-full bg-gray-900/50 border-2 ${colors.border} overflow-hidden`}>
                          <div
                            className={`h-full bg-gradient-to-r ${colors.barBg} transition-all duration-1000 relative`}
                            style={{ width: `${unit.achievementRate}%` }}
                          >
                            {isTop3 && (
                              <div className="absolute inset-0 animate-shimmer" style={{
                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                                backgroundSize: '200% 100%'
                              }} />
                            )}
                            {/* ピクセル風のドット */}
                            <div className="absolute inset-0 opacity-30" style={{
                              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 6px)'
                            }} />
                          </div>

                          {/* ゲージの目盛り */}
                          <div className="absolute inset-0 flex items-center">
                            {[25, 50, 75].map(mark => (
                              <div key={mark} className="absolute h-full w-px bg-white/20" style={{ left: `${mark}%` }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* コンボ表示（1位のみ） */}
                    {index === 0 && (
                      <div className={`absolute top-2 right-2 px-3 py-1 rounded-lg animate-bounce-slow ${
                        isDark ? 'bg-yellow-400' : 'bg-yellow-500'
                      }`}>
                        <span className={`text-xs font-black pixel-font ${
                          isDark ? 'text-gray-900' : 'text-white'
                        }`}>★ TOP ★</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 説明 */}
        <div className={`mt-8 p-6 rounded-2xl ${
          isDark ? 'bg-gray-800/30' : 'bg-blue-50'
        }`}>
          <p className={`text-sm ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}>
            💡 各ユニットの達成率はGoogleスプレッドシート「報告/MG粗利11月」から自動的に取得されています。
          </p>
        </div>
      </div>

      {/* カスタムアニメーション */}
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        .pixel-font {
          font-family: 'Press Start 2P', cursive;
          letter-spacing: 0.05em;
        }

        @keyframes neon-glow {
          0%, 100% {
            box-shadow: 0 0 50px rgba(250, 204, 21, 0.5),
                        0 0 100px rgba(250, 204, 21, 0.3),
                        inset 0 0 30px rgba(250, 204, 21, 0.1);
          }
          50% {
            box-shadow: 0 0 70px rgba(250, 204, 21, 0.7),
                        0 0 120px rgba(250, 204, 21, 0.5),
                        inset 0 0 40px rgba(250, 204, 21, 0.2);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 30px rgba(250, 204, 21, 0.8);
          }
          50% {
            box-shadow: 0 0 50px rgba(250, 204, 21, 1);
          }
        }

        @keyframes ping-slow {
          0% {
            transform: scale(1);
            opacity: 0.2;
          }
          100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }

        @keyframes scan-line {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(100%);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        .animate-neon-glow {
          animation: neon-glow 2s ease-in-out infinite;
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .animate-ping-slow {
          animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        .animate-scan-line {
          animation: scan-line 8s linear infinite;
        }

        .animate-shimmer {
          animation: shimmer 2s linear infinite;
        }

        @keyframes neon-pulse {
          0%, 100% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(1.2);
          }
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-5px) scale(1.05);
          }
        }

        .animate-neon-pulse {
          animation: neon-pulse 3s ease-in-out infinite;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
