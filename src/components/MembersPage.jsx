import React, { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { calculateProgress } from '../utils/todo'
import TodoList from './TodoList'

export default function MembersPage({ user, isDark }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberTasks, setMemberTasks] = useState(null)
  const [memberAttendance, setMemberAttendance] = useState(null)
  const [attendanceStatus, setAttendanceStatus] = useState({})
  const [taskProgress, setTaskProgress] = useState({})
  const [taskCounts, setTaskCounts] = useState({})
  const [dailyRankings, setDailyRankings] = useState({}) // 確定ランキング
  const [showModal, setShowModal] = useState(false)
  const [birthdayNotifications, setBirthdayNotifications] = useState({ today: [], tomorrow: [] })
  const [showBirthdayPopup, setShowBirthdayPopup] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [departments, setDepartments] = useState([])
  const [selectedDepartments, setSelectedDepartments] = useState([])
  const [showAllDepartments, setShowAllDepartments] = useState(false)

  useEffect(() => {
    loadCurrentUser()
    loadMembers()
    loadAttendanceStatus()
    loadAllTaskProgress()
    loadDailyRankings()
  }, [])

  useEffect(() => {
    if (members.length > 0 && currentUser) {
      checkBirthdays()
    }
  }, [members, currentUser])

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      setCurrentUser(data)
    }
  }

  const checkBirthdays = () => {
    // attendance.jsと同じ方法で日付を取得
    const now = new Date()
    const today = new Date(now.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayBirthdays = []
    const tomorrowBirthdays = []
    let isCurrentUserBirthday = false

    members.forEach(member => {
      if (!member.birthday) return

      const birthday = new Date(member.birthday)
      const birthdayThisYear = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate())
      const tomorrowDate = new Date(today.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())

      // 今日が誕生日
      if (birthdayThisYear.toDateString() === today.toDateString()) {
        if (member.id === currentUser?.id) {
          isCurrentUserBirthday = true
        } else {
          todayBirthdays.push(member)
        }
      }
      // 明日が誕生日
      else if (birthdayThisYear.toDateString() === tomorrowDate.toDateString()) {
        tomorrowBirthdays.push(member)
      }
    })

    setBirthdayNotifications({ today: todayBirthdays, tomorrow: tomorrowBirthdays })
    
    // ポップアップは自動で表示しない（出勤ボタン押下時に表示）
  }

  useEffect(() => {
    if (selectedMember) {
      loadMemberTasks(selectedMember.id)
      loadMemberAttendance(selectedMember.id)
    }
  }, [selectedMember])

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error
      setMembers(data || [])
      
      // 部署一覧を抽出（重複を除く）
      const uniqueDepartments = [...new Set(data?.map(m => m.department).filter(d => d))]
      setDepartments(uniqueDepartments.sort())
    } catch (error) {
      console.error('Error loading members:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAttendanceStatus = async () => {
    try {
      // attendance.jsと同じ方法で日付を取得
      const now = new Date()
      const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
      const today = jstDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('attendances')
        .select('user_id, status, clock_in, clock_out, date')

      if (error) throw error

      const statusMap = {}
      data?.forEach((record) => {
        const recordDateStr = String(record.date).split('T')[0]

        if (recordDateStr === today) {
          statusMap[record.user_id] = {
            status: record.status,
            clock_in: record.clock_in,
            clock_out: record.clock_out
          }
        }
      })
      setAttendanceStatus(statusMap)
    } catch (error) {
      console.error('Error loading attendance status:', error)
    }
  }

  const loadAllTaskProgress = async () => {
    try {
      // attendance.jsと同じ方法で日付を取得
      const now = new Date()
      const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
      const today = jstDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('todo_lists')
        .select(`
          user_id,
          todo_items (is_completed)
        `)
        .eq('date', today)

      if (error) throw error

      const progressMap = {}
      const countMap = {}
      data?.forEach(list => {
        const taskCount = list.todo_items?.length || 0
        countMap[list.user_id] = taskCount
        
        if (list.todo_items && taskCount > 0) {
          progressMap[list.user_id] = calculateProgress(list.todo_items)
        } else {
          progressMap[list.user_id] = 0
        }
      })
      setTaskProgress(progressMap)
      setTaskCounts(countMap)
    } catch (error) {
      console.error('Error loading task progress:', error)
    }
  }

  const loadDailyRankings = async () => {
    try {
      // 日本時間で今日の日付を取得
      const now = new Date()
      const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000))
      const today = jstDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('daily_rankings')
        .select('*')
        .eq('date', today)

      if (error) throw error

      // user_idをキーにしたマップに変換
      const rankingsMap = {}
      data?.forEach(ranking => {
        rankingsMap[ranking.user_id] = ranking
      })
      setDailyRankings(rankingsMap)
    } catch (error) {
      console.error('Error loading daily rankings:', error)
    }
  }

  const loadMemberTasks = async (userId) => {
    try {
      // attendance.jsと同じ方法で日付を取得
      const now = new Date()
      const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
      const today = jstDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('todo_lists')
        .select(`
          *,
          todo_items (*)
        `)
        .eq('user_id', userId)
        .eq('date', today)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setMemberTasks(data)
    } catch (error) {
      console.error('Error loading member tasks:', error)
      setMemberTasks(null)
    }
  }

  const loadMemberAttendance = async (userId) => {
    try {
      // attendance.jsと同じ方法で日付を取得
      const now = new Date()
      const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
      const today = jstDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setMemberAttendance(data)
    } catch (error) {
      console.error('Error loading member attendance:', error)
      setMemberAttendance(null)
    }
  }

  const handleMemberClick = (member) => {
    setSelectedMember(member)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedMember(null)
    setMemberTasks(null)
    setMemberAttendance(null)
  }

  const toggleDepartment = (dept) => {
    setSelectedDepartments(prev => 
      prev.includes(dept)
        ? prev.filter(d => d !== dept)
        : [...prev, dept]
    )
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className={`animate-pulse ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          読み込み中...
        </div>
      </div>
    )
  }

  return (
    <>
      {/* クラッカーアニメーション（本人の誕生日） */}
      {showBirthdayPopup && isCurrentUserBirthday && <ConfettiAnimation />}

      {/* 誕生日ポップアップ */}
      {showBirthdayPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowBirthdayPopup(false)}
        >
          <div
            className={`max-w-md w-full rounded-3xl shadow-2xl border p-8 ${
              isDark
                ? 'bg-gray-900/95 border-gray-800/50'
                : 'bg-white/95 border-gray-200/50'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              {isCurrentUserBirthday ? (
                <>
                  <h2 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    誕生日おめでとうございます！
                  </h2>
                  <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    素敵な一年になりますように
                  </p>
                </>
              ) : (
                <>
                  <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    今日は
                    {birthdayNotifications.today.map((member, index) => (
                      <span key={member.id}>
                        {index > 0 && '、'}
                        <span className="text-blue-500">{member.name || member.email.split('@')[0]}</span>
                        さん
                      </span>
                    ))}
                    のお誕生日です！
                  </h2>
                  <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    お祝いしましょう！
                  </p>
                </>
              )}
              <button
                onClick={() => setShowBirthdayPopup(false)}
                className={`mt-6 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isDark
                    ? 'bg-white text-gray-900 hover:bg-gray-100'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
      {/* ページタイトルと部署フィルタ */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            メンバー
          </h1>
          <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            チームメンバーと今日のタスクを確認
          </p>
        </div>

        {/* 部署フィルタ */}
        {departments.length > 0 && (
          <div className={`backdrop-blur-xl rounded-2xl shadow-lg border p-4 ${
            isDark
              ? 'bg-gray-900/80 border-gray-800/50'
              : 'bg-white/80 border-gray-200/50'
          }`}>
            <div className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              部署で絞り込み
            </div>
            <div className="flex flex-wrap gap-2">
              {/* 最初の3つを表示 */}
              {departments.slice(0, 3).map((dept) => (
                <button
                  key={dept}
                  onClick={() => toggleDepartment(dept)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    selectedDepartments.includes(dept)
                      ? isDark
                        ? 'bg-white text-gray-900'
                        : 'bg-gray-900 text-white'
                      : isDark
                      ? 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
                      : 'bg-gray-100/50 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center ${
                    selectedDepartments.includes(dept)
                      ? isDark
                        ? 'border-gray-900 bg-gray-900'
                        : 'border-white bg-white'
                      : isDark
                      ? 'border-gray-600'
                      : 'border-gray-400'
                  }`}>
                    {selectedDepartments.includes(dept) && (
                      <svg className={`w-2.5 h-2.5 ${isDark ? 'text-white' : 'text-gray-900'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>{dept}</span>
                </button>
              ))}
              
              {/* 残りの部署を展開表示 */}
              {showAllDepartments && departments.slice(3).map((dept) => (
                <button
                  key={dept}
                  onClick={() => toggleDepartment(dept)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    selectedDepartments.includes(dept)
                      ? isDark
                        ? 'bg-white text-gray-900'
                        : 'bg-gray-900 text-white'
                      : isDark
                      ? 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
                      : 'bg-gray-100/50 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center ${
                    selectedDepartments.includes(dept)
                      ? isDark
                        ? 'border-gray-900 bg-gray-900'
                        : 'border-white bg-white'
                      : isDark
                      ? 'border-gray-600'
                      : 'border-gray-400'
                  }`}>
                    {selectedDepartments.includes(dept) && (
                      <svg className={`w-2.5 h-2.5 ${isDark ? 'text-white' : 'text-gray-900'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>{dept}</span>
                </button>
              ))}
              
              {/* 展開ボタン（3つより多い場合のみ表示） */}
              {departments.length > 3 && (
                <button
                  onClick={() => setShowAllDepartments(!showAllDepartments)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isDark
                      ? 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
                      : 'bg-gray-100/50 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  {showAllDepartments ? '閉じる' : `...他${departments.length - 3}件`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 明日の誕生日通知 */}
      {birthdayNotifications.tomorrow.length > 0 && (
        <div className={`mb-6 backdrop-blur-xl rounded-3xl shadow-lg border p-6 transition-colors duration-500 ${
          isDark
            ? 'bg-gradient-to-r from-purple-900/80 to-pink-900/80 shadow-black/50 border-purple-800/50'
            : 'bg-gradient-to-r from-purple-100/80 to-pink-100/80 shadow-purple-200/50 border-purple-200/50'
        }`}>
          <div className="flex items-center gap-4">
            <div className="text-4xl">🎂</div>
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                明日は
                {birthdayNotifications.tomorrow.map((member, index) => (
                  <span key={member.id}>
                    {index > 0 && '、'}
                    <span className={isDark ? 'text-purple-300' : 'text-purple-700'}>
                      {member.name || member.email.split('@')[0]}
                    </span>
                    さん
                  </span>
                ))}
                のお誕生日です！
              </h3>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                準備をお忘れなく
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ギャラリービュー */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {(() => {
          // フィルタリングとソート
          const sortedMembers = members
            .filter(member => 
              selectedDepartments.length === 0 || 
              selectedDepartments.includes(member.department)
            )
            .sort((a, b) => {
            // 1. 出勤状態の優先順位: 出勤中 > 休憩中 > 退勤済 > 未出勤
            const statusA = attendanceStatus[a.id]
            const statusB = attendanceStatus[b.id]

            const getPriority = (status) => {
              if (!status) return 3 // 未出勤
              if (status.clock_out) return 2 // 退勤済
              if (status.status === 'working') return 0 // 出勤中
              if (status.status === 'break') return 1 // 休憩中
              return 3
            }

            const priorityA = getPriority(statusA)
            const priorityB = getPriority(statusB)

            // 出勤状態が異なる場合は出勤状態で並び替え
            if (priorityA !== priorityB) {
              return priorityA - priorityB
            }

            // 2. 出勤状態が同じ場合は頑張り度スコアで並び替え（高い順）
            const progressA = taskProgress[a.id] ?? 0
            const progressB = taskProgress[b.id] ?? 0
            const countA = taskCounts[a.id] ?? 0
            const countB = taskCounts[b.id] ?? 0

            // 頑張り度スコア = 完了したタスク数 + 達成率ボーナス
            const completedA = Math.round(countA * (progressA / 100))
            const completedB = Math.round(countB * (progressB / 100))
            const scoreA = completedA + (progressA / 100)
            const scoreB = completedB + (progressB / 100)

            return scoreB - scoreA
          })
          
          // 現在時刻が19:00以降かチェック
          const now = new Date()
          const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000))
          const currentHour = jstDate.getHours()
          const isAfter19 = currentHour >= 19

          // 出勤中のメンバーを取得して頑張り度でソート
          let workingMembers

          if (isAfter19 && Object.keys(dailyRankings).length > 0) {
            // 19:00以降は確定ランキングを使用
            workingMembers = sortedMembers
              .filter(member => {
                const status = attendanceStatus[member.id]
                return status && !status.clock_out && status.status === 'working'
              })
              .map(member => {
                const ranking = dailyRankings[member.id]
                const score = ranking?.score ?? 0
                return { member, score, rank: ranking?.rank }
              })
              .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)) // rankで昇順ソート
          } else {
            // 19:00前はリアルタイム計算
            workingMembers = sortedMembers
              .filter(member => {
                const status = attendanceStatus[member.id]
                return status && !status.clock_out && status.status === 'working'
              })
              .map(member => {
                const progress = taskProgress[member.id] ?? 0
                const count = taskCounts[member.id] ?? 0
                // 頑張り度スコア = タスク数 × (達成率 / 100)
                // 完了したタスク数を評価
                const completedTasks = Math.round(count * (progress / 100))
                const score = completedTasks + (progress / 100) // 完了数 + 達成率のボーナス
                return { member, score }
              })
              .sort((a, b) => b.score - a.score)
          }

          // メダルマッピング（トップ3：金銀銅）
          const getMedal = (member) => {
            const index = workingMembers.findIndex(item => item.member.id === member.id)
            if (index === 0) return { emoji: '🥇', rank: 1 } // Gold
            if (index === 1) return { emoji: '🥈', rank: 2 } // Silver
            if (index === 2) return { emoji: '🥉', rank: 3 } // Bronze
            return null
          }
          
          return sortedMembers.map((member) => {
          const progress = taskProgress[member.id] ?? 0
          const medal = getMedal(member)
          return (
            <button
              key={member.id}
              onClick={() => handleMemberClick(member)}
              className={`backdrop-blur-xl rounded-3xl shadow-lg border p-6 transition-all duration-200 hover:scale-105 ${
                medal?.rank === 1
                  ? isDark
                    ? 'bg-gradient-to-br from-yellow-600/30 via-yellow-500/20 to-amber-600/30 shadow-yellow-900/50 border-yellow-500/50 hover:shadow-yellow-500/50 hover:scale-110 ring-2 ring-yellow-500/30 animate-pulse'
                    : 'bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100 shadow-yellow-200/70 border-yellow-300/70 hover:shadow-yellow-300/80 hover:scale-110 ring-2 ring-yellow-400/40 animate-pulse'
                  : medal?.rank === 2
                  ? isDark
                    ? 'bg-gradient-to-br from-gray-500/30 via-slate-400/20 to-gray-600/30 shadow-gray-900/50 border-gray-400/50 hover:shadow-gray-400/50 hover:scale-110 ring-2 ring-gray-400/30 animate-pulse'
                    : 'bg-gradient-to-br from-gray-100 via-slate-50 to-gray-200 shadow-gray-300/70 border-gray-300/70 hover:shadow-gray-400/80 hover:scale-110 ring-2 ring-gray-300/40 animate-pulse'
                  : medal?.rank === 3
                  ? isDark
                    ? 'bg-gradient-to-br from-orange-700/30 via-amber-600/20 to-orange-800/30 shadow-orange-900/50 border-orange-600/50 hover:shadow-orange-600/50 hover:scale-110 ring-2 ring-orange-600/30 animate-pulse'
                    : 'bg-gradient-to-br from-orange-100 via-amber-50 to-orange-200 shadow-orange-300/70 border-orange-300/70 hover:shadow-orange-400/80 hover:scale-110 ring-2 ring-orange-300/40 animate-pulse'
                  : isDark
                  ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50 hover:bg-gray-800/80'
                  : 'bg-white/80 shadow-gray-200/50 border-gray-200/50 hover:bg-white/90'
              }`}
            >
              {/* アバターと進捗サークル */}
              <div className="relative w-24 h-24 mx-auto mb-4">
                {/* 円形プログレスバー */}
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                  {/* 背景円 */}
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    stroke={isDark ? '#374151' : '#E5E7EB'}
                    strokeWidth="6"
                    fill="none"
                  />
                  {/* 進捗円 */}
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    stroke={
                      medal?.rank === 1
                        ? (isDark ? '#FCD34D' : '#F59E0B') // Gold
                        : medal?.rank === 2
                        ? (isDark ? '#D1D5DB' : '#6B7280') // Silver
                        : medal?.rank === 3
                        ? (isDark ? '#FB923C' : '#EA580C') // Bronze
                        : (isDark ? '#FFFFFF' : '#111827') // Default
                    }
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                {/* アバター */}
                <div className={`absolute inset-2 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold ${
                  medal?.rank === 1
                    ? 'bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 text-white shadow-lg shadow-yellow-500/50'
                    : medal?.rank === 2
                    ? 'bg-gradient-to-br from-gray-300 via-slate-400 to-gray-500 text-white shadow-lg shadow-gray-400/50'
                    : medal?.rank === 3
                    ? 'bg-gradient-to-br from-orange-400 via-amber-600 to-orange-700 text-white shadow-lg shadow-orange-500/50'
                    : isDark
                    ? 'bg-gradient-to-br from-gray-700 to-gray-600 text-white'
                    : 'bg-gradient-to-br from-gray-800 to-gray-700 text-white'
                }`}>
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    member.email.charAt(0).toUpperCase()
                  )}
                </div>
              </div>

              {/* 進捗パーセント */}
              <div className={`text-xs font-bold mb-2 ${
                medal?.rank === 1
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : medal?.rank === 2
                  ? 'text-gray-600 dark:text-gray-300'
                  : medal?.rank === 3
                  ? 'text-orange-600 dark:text-orange-400'
                  : isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {progress}%
              </div>

              {/* 名前 */}
              <h3 className={`text-lg font-bold mb-1 truncate ${
                medal?.rank === 1
                  ? 'text-yellow-700 dark:text-yellow-300'
                  : medal?.rank === 2
                  ? 'text-gray-700 dark:text-gray-200'
                  : medal?.rank === 3
                  ? 'text-orange-700 dark:text-orange-300'
                  : isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {medal && <span className="mr-1">{medal.emoji}</span>}
                {member.name || member.email.split('@')[0]}
              </h3>

              {/* 部署 */}
              <p className={`text-sm mb-3 truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {member.department || 'なし'}
              </p>

              {/* 出勤ステータス */}
              <div className="flex justify-center">
                {(() => {
                  const attendance = attendanceStatus[member.id]
                  
                  // 勤怠レコードがない場合
                  if (!attendance) {
                    return (
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-200 text-gray-500'
                      }`}>
                        未出勤
                      </div>
                    )
                  }
                  
                  // clock_outがある場合は退勤済
                  if (attendance.clock_out) {
                    return (
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        isDark
                          ? 'bg-blue-900/50 text-blue-300'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        退勤済
                      </div>
                    )
                  }
                  
                  // statusで判定
                  if (attendance.status === 'working') {
                    return (
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        isDark
                          ? 'bg-white text-gray-900'
                          : 'bg-gray-900 text-white'
                      }`}>
                        出勤中
                      </div>
                    )
                  }
                  
                  if (attendance.status === 'break') {
                    return (
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        isDark
                          ? 'bg-gray-300 text-gray-900'
                          : 'bg-gray-500 text-white'
                      }`}>
                        休憩中
                      </div>
                    )
                  }
                  
                  if (attendance.status === 'completed') {
                    return (
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        isDark
                          ? 'bg-blue-900/50 text-blue-300'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        退勤済
                      </div>
                    )
                  }
                  
                  // 不明なステータス
                  return (
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                      isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-300 text-gray-700'
                    }`}>
                      不明({attendance.status})
                    </div>
                  )
                })()}
              </div>
            </button>
          )
        })})()}
      </div>

      {/* モーダル */}
      {showModal && selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className={`max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border ${
              isDark
                ? 'bg-gray-900/95 border-gray-800/50'
                : 'bg-white/95 border-gray-200/50'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div className={`sticky top-0 z-10 backdrop-blur-xl border-b p-6 ${
              isDark ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold text-white ${
                    isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600' : 'bg-gradient-to-br from-gray-800 to-gray-700'
                  }`}>
                    {selectedMember.avatar_url ? (
                      <img src={selectedMember.avatar_url} alt={selectedMember.name} className="w-full h-full object-cover" />
                    ) : (
                      selectedMember.email.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {selectedMember.name || selectedMember.email.split('@')[0]}
                    </h2>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedMember.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className={`p-2 rounded-xl transition-colors ${
                    isDark
                      ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* モーダルコンテンツ */}
            <div className="p-6 space-y-6">
              {/* 勤怠カード */}
              <div className={`backdrop-blur-xl rounded-3xl shadow-lg border p-6 ${
                isDark
                  ? 'bg-gray-800/50 border-gray-700/50'
                  : 'bg-gray-50/50 border-gray-200/50'
              }`}>
                <div className="text-center">
                  <div className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {memberAttendance?.status === 'working' ? '出勤中' :
                     memberAttendance?.status === 'break' ? '休憩中' :
                     memberAttendance?.status === 'completed' ? '退勤済' : '未出勤'}
                  </div>
                  <div className={`text-5xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {(() => {
                      if (!memberAttendance?.clock_in) return '0:00'
                      
                      try {
                        // 日本時間（JST）で現在時刻と今日の日付を取得
                        const jstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
                        const today = jstNow.toISOString().split('T')[0]
                        
                        const clockInTime = memberAttendance.clock_in.includes('T') 
                          ? memberAttendance.clock_in.split('T')[1] 
                          : memberAttendance.clock_in
                        
                        const clockIn = new Date(`${today}T${clockInTime}`)
                        
                        let clockOut
                        if (memberAttendance.clock_out) {
                          const clockOutTime = memberAttendance.clock_out.includes('T')
                            ? memberAttendance.clock_out.split('T')[1]
                            : memberAttendance.clock_out
                          clockOut = new Date(`${today}T${clockOutTime}`)
                        } else {
                          clockOut = jstNow
                        }
                        
                        const diff = Math.floor((clockOut - clockIn) / 1000 / 60) // 分単位で計算
                        if (diff < 0 || isNaN(diff)) return '0:00'
                        
                        const hours = Math.floor(diff / 60)
                        const minutes = diff % 60
                        return `${hours}:${minutes.toString().padStart(2, '0')}`
                      } catch (e) {
                        console.error('Error calculating work time:', e)
                        return '0:00'
                      }
                    })()}
                  </div>
                  <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    勤務時間
                  </div>
                </div>
              </div>

              {/* TODOリスト */}
              <TodoList user={selectedMember} isDark={isDark} currentUser={currentUser} />
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

// クラッカーアニメーションコンポーネント（TodoListから再利用）
function ConfettiAnimation() {
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 2,
    rotation: Math.random() * 360,
    color: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3'][Math.floor(Math.random() * 7)]
  }))

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute w-3 h-3 animate-confetti-fall"
          style={{
            left: `${piece.left}%`,
            top: '-5%',
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${piece.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}