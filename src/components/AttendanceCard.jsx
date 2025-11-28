import React, { useState, useEffect } from 'react'
import { getTodayAttendance, clockIn, clockOut, reClockIn } from '../utils/attendance'
import { sendSlackNotification } from '../utils/slack'
import { getTodayTodoList } from '../utils/todo'
import { supabase } from '../utils/supabase'
import { getAIFeedback } from '../utils/ranking'
import { getStreaks } from '../utils/streaks'

export default function AttendanceCard({ user, isDark, onStreakUpdate }) {
  const [attendance, setAttendance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showBreakModal, setShowBreakModal] = useState(false)
  const [breakMinutes, setBreakMinutes] = useState('')
  const [showBirthdayPopup, setShowBirthdayPopup] = useState(false)
  const [birthdayData, setBirthdayData] = useState({ isCurrentUser: false, members: [] })
  const [showConfetti, setShowConfetti] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  const [aiFeedback, setAiFeedback] = useState(null)
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [showStreakNotification, setShowStreakNotification] = useState(false)
  const [streakNotificationType, setStreakNotificationType] = useState(null) // 'clockin' or 'clockout'
  const [streakValue, setStreakValue] = useState(0)
  const [showOvertimeAlert, setShowOvertimeAlert] = useState(false)
  const [overtimeAlertShown, setOvertimeAlertShown] = useState(false)
  const [showAIFeedbackPopup, setShowAIFeedbackPopup] = useState(false)
  const [showWorkTypeModal, setShowWorkTypeModal] = useState(false)

  useEffect(() => {
    loadAttendance()
    loadUserProfile()
    
    // 日本時間で現在時刻を更新
    const updateJSTTime = () => {
      const jstTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
      setCurrentTime(jstTime)
    }
    
    updateJSTTime()
    const timer = setInterval(updateJSTTime, 1000)

    return () => clearInterval(timer)
  }, [user])

  // 15時間超過チェック
  useEffect(() => {
    if (!attendance?.clock_in || attendance?.clock_out || overtimeAlertShown) return

    const checkOvertime = () => {
      const jstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
      const today = jstNow.toISOString().split('T')[0]
      
      const clockInTime = attendance.clock_in.includes('T') 
        ? attendance.clock_in.split('T')[1] 
        : attendance.clock_in
      const start = new Date(`${today}T${clockInTime}`)
      
      const diffMinutes = Math.floor((jstNow - start) / 1000 / 60)
      const diffHours = diffMinutes / 60

      // 15時間（900分）を超えたらアラート表示
      if (diffHours >= 15) {
        setShowOvertimeAlert(true)
        setOvertimeAlertShown(true) // 一度表示したら再表示しない
      }
    }

    // 1分ごとにチェック
    const overtimeTimer = setInterval(checkOvertime, 60000)
    checkOvertime() // 初回実行

    return () => clearInterval(overtimeTimer)
  }, [attendance, overtimeAlertShown])

  const loadAttendance = async () => {
    try {
      const data = await getTodayAttendance(user.id)
      setAttendance(data)
    } catch (error) {
      console.error('Error loading attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (error) throw error
      setUserProfile(data)
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  const handleClockIn = () => {
    // 出勤タイプ選択モーダルを表示
    setShowWorkTypeModal(true)
  }

  const confirmClockIn = async (workType) => {
    try {
      setLoading(true)
      setShowWorkTypeModal(false)
      const result = await clockIn(user.id, workType)
      await loadAttendance()

      // ユーザー情報を取得（最新のデータを確実に取得）
      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single()

      // 通常のTODOリストを取得
      const todoList = await getTodayTodoList(user.id)
      const normalTodos = todoList?.todo_items || []

      // 定常TODOリストを取得
      const today = new Date().toISOString().split('T')[0]
      const { data: routineTodos, error: routineError } = await supabase
        .from('routine_todos')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })

      if (routineError) throw routineError

      // 定常TODOの完了状態を取得
      const { data: completions, error: completionsError } = await supabase
        .from('routine_todo_completions')
        .select('routine_todo_id')
        .eq('user_id', user.id)
        .eq('completed_date', today)

      if (completionsError) throw completionsError

      const completionSet = new Set(completions?.map(c => c.routine_todo_id) || [])

      // 定常TODOを通常のTODO形式に変換
      const routineTodoItems = (routineTodos || []).map(todo => ({
        content: todo.content,
        is_completed: completionSet.has(todo.id),
        indent_level: todo.indent_level || 0
      }))

      // 通常のTODOと定常TODOを結合
      const allTodoItems = [...normalTodos, ...routineTodoItems]

      // Slack通知を送信
      await sendSlackNotification(
        'clock_in',
        { id: user.id, name: userData?.name || user.email },
        result,
        allTodoItems
      )

      // 誕生日チェック
      await checkBirthdays()

      // ストリーク通知を表示
      const streaks = await getStreaks(user.id)
      if (streaks.attendanceStreak > 0) {
        setStreakValue(streaks.attendanceStreak)
        setStreakNotificationType('clockin')
        setShowStreakNotification(true)
        setTimeout(() => setShowStreakNotification(false), 3500)
      }
      
      // ヘッダーのストリークバッジを更新
      if (onStreakUpdate) {
        onStreakUpdate(streaks)
      }
    } catch (error) {
      console.error('Error clocking in:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkBirthdays = async () => {
    try {
      // 日本時間で今日の日付を取得
      const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
      
      // 全メンバー取得
      const { data: members, error } = await supabase
        .from('users')
        .select('*')
      
      if (error) throw error

      const todayBirthdays = []
      let isCurrentUserBirthday = false

      members.forEach(member => {
        if (!member.birthday) return

        const birthday = new Date(member.birthday)
        const birthdayThisYear = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate())

        if (birthdayThisYear.toDateString() === today.toDateString()) {
          if (member.id === user.id) {
            isCurrentUserBirthday = true
          } else {
            todayBirthdays.push(member)
          }
        }
      })

      // 誕生日がある場合のみポップアップ表示
      if (isCurrentUserBirthday || todayBirthdays.length > 0) {
        setBirthdayData({ isCurrentUser: isCurrentUserBirthday, members: todayBirthdays })
        setShowBirthdayPopup(true)
        
        // 本人の誕生日の場合はクラッカーも表示
        if (isCurrentUserBirthday) {
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 4000)
        }
      }
    } catch (error) {
      console.error('Error checking birthdays:', error)
    }
  }

  const handleClockOut = async () => {
    setShowBreakModal(true)
  }

  const confirmClockOut = async () => {
    const minutes = parseInt(breakMinutes) || 0

    try {
      setLoading(true)
      setShowBreakModal(false)
      const result = await clockOut(user.id, minutes)
      await loadAttendance()

      // ユーザー情報を取得（最新のデータを確実に取得）
      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single()

      // 通常のTODOリストを取得
      const todoList = await getTodayTodoList(user.id)
      const normalTodos = todoList?.todo_items || []

      // 定常TODOリストを取得
      const today = new Date().toISOString().split('T')[0]
      const { data: routineTodos, error: routineError } = await supabase
        .from('routine_todos')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })

      if (routineError) throw routineError

      // 定常TODOの完了状態を取得
      const { data: completions, error: completionsError } = await supabase
        .from('routine_todo_completions')
        .select('routine_todo_id')
        .eq('user_id', user.id)
        .eq('completed_date', today)

      if (completionsError) throw completionsError

      const completionSet = new Set(completions?.map(c => c.routine_todo_id) || [])

      // 定常TODOを通常のTODO形式に変換
      const routineTodoItems = (routineTodos || []).map(todo => ({
        content: todo.content,
        is_completed: completionSet.has(todo.id),
        indent_level: todo.indent_level || 0
      }))

      // 通常のTODOと定常TODOを結合
      const allTodoItems = [...normalTodos, ...routineTodoItems]

      // Slack通知を送信（TODOリスト付き）
      await sendSlackNotification(
        'clock_out',
        { id: user.id, name: userData?.name || user.email },
        result,
        allTodoItems
      )

      setBreakMinutes('')

      // ストリーク通知を表示（TODO達成）
      const streaks = await getStreaks(user.id)
      if (streaks.todoStreak > 0) {
        setStreakValue(streaks.todoStreak)
        setStreakNotificationType('clockout')
        setShowStreakNotification(true)
        setTimeout(() => setShowStreakNotification(false), 3500)
      }

      // ヘッダーのストリークバッジを更新
      if (onStreakUpdate) {
        onStreakUpdate(streaks)
      }

      // AIフィードバックを取得して表示
      setLoadingFeedback(true)
      try {
        const feedback = await getAIFeedback(user.id, userProfile?.name || user.email)
        setAiFeedback(feedback)
        setShowAIFeedbackPopup(true)

        // 上位3位以内なら紙吹雪を表示
        if (feedback?.stats?.rank && feedback.stats.rank <= 3) {
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 4000)
        }
      } catch (error) {
        console.error('Error getting AI feedback:', error)
      } finally {
        setLoadingFeedback(false)
      }
    } catch (error) {
      console.error('Error clocking out:', error)
    } finally {
      setLoading(false)
    }
  }

  const cancelClockOut = () => {
    setShowBreakModal(false)
    setBreakMinutes('')
  }

  const handleReClockIn = async () => {
    try {
      setLoading(true)
      const result = await reClockIn(user.id)
      await loadAttendance()

      // ユーザー情報を取得
      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single()

      // 通常のTODOリストを取得
      const todoList = await getTodayTodoList(user.id)
      const normalTodos = todoList?.todo_items || []

      // 定常TODOリストを取得
      const today = new Date().toISOString().split('T')[0]
      const { data: routineTodos, error: routineError } = await supabase
        .from('routine_todos')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })

      if (routineError) throw routineError

      // 定常TODOの完了状態を取得
      const { data: completions, error: completionsError } = await supabase
        .from('routine_todo_completions')
        .select('routine_todo_id')
        .eq('user_id', user.id)
        .eq('completed_date', today)

      if (completionsError) throw completionsError

      const completionSet = new Set(completions?.map(c => c.routine_todo_id) || [])

      // 定常TODOを通常のTODO形式に変換
      const routineTodoItems = (routineTodos || []).map(todo => ({
        content: todo.content,
        is_completed: completionSet.has(todo.id),
        indent_level: todo.indent_level || 0
      }))

      // 通常のTODOと定常TODOを結合
      const allTodoItems = [...normalTodos, ...routineTodoItems]

      // Slack通知を送信
      await sendSlackNotification(
        'clock_in',
        { id: user.id, name: userData?.name || user.email },
        result,
        allTodoItems
      )
    } catch (error) {
      console.error('Error re-clocking in:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatus = () => {
    if (!attendance || !attendance.clock_in) return 'not_started'
    if (attendance.clock_out) return 'completed'
    return 'working'
  }

  const getWorkDuration = () => {
    if (!attendance?.clock_in) return '0:00'

    // 退勤済みの場合は、total_work_minutesを使用
    if (attendance.clock_out) {
      const totalMinutes = attendance.total_work_minutes || 0
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      return `${hours}:${minutes.toString().padStart(2, '0')}`
    }

    // 勤務中の場合は、現在時刻までの時間を計算
    // 再出勤の場合は、last_clock_out（再出勤時刻）から現在時刻まで
    let startTime
    if (attendance.last_clock_out) {
      // 再出勤後の場合は、再出勤時刻から現在時刻まで
      const lastClockOutTime = attendance.last_clock_out.includes('T')
        ? attendance.last_clock_out.split('T')[1]
        : attendance.last_clock_out
      const jstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
      const today = jstNow.toISOString().split('T')[0]
      startTime = new Date(`${today}T${lastClockOutTime}`)
    } else {
      // 通常の場合は、最初の出勤時刻から現在時刻まで
      const clockInTime = attendance.clock_in.includes('T') 
        ? attendance.clock_in.split('T')[1] 
        : attendance.clock_in
      const jstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
      const today = jstNow.toISOString().split('T')[0]
      startTime = new Date(`${today}T${clockInTime}`)
    }
    
    const jstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
    const currentSessionMinutes = Math.floor((jstNow - startTime) / 1000 / 60) // 分
    
    // 前回の勤務時間に今回のセッションの時間を加算
    const previousWorkMinutes = attendance.total_work_minutes || 0
    const totalMinutes = previousWorkMinutes + currentSessionMinutes

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    return `${hours}:${minutes.toString().padStart(2, '0')}`
  }

  const formatTime = (dateString) => {
    if (!dateString) return '--:--'
    
    // UTC時刻を日本時間に変換
    const utcDate = new Date(dateString)
    const jstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000))
    
    const hours = jstDate.getUTCHours()
    const minutes = jstDate.getUTCMinutes()
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  const status = getStatus()

  return (
    <>
      {/* クラッカーアニメーション（本人の誕生日） */}
      {showConfetti && <ConfettiAnimation />}

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
              {birthdayData.isCurrentUser ? (
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
                    {birthdayData.members.map((member, index) => (
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

      {/* ストリーク通知アニメーション */}
      {showStreakNotification && (
        <div className="fixed top-8 right-8 z-50 pointer-events-none animate-slide-in-right">
          <div
            className={`rounded-2xl shadow-2xl border p-6 flex items-center gap-4 ${
              isDark
                ? 'bg-gray-900/95 border-gray-800/50 backdrop-blur-xl'
                : 'bg-white/95 border-gray-200/50 backdrop-blur-xl'
            }`}
            style={{
              animation: 'slideInRight 0.5s ease-out, pulse 0.3s ease-in-out 0.5s 2'
            }}
          >
            <div className="text-5xl animate-bounce">
              {streakNotificationType === 'clockin' ? '🔥' : '🎯'}
            </div>
            <div>
              <div className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {streakNotificationType === 'clockin' ? '連続出勤' : 'TODO達成'}
              </div>
              <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {streakValue}日目！
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AIフィードバックポップアップ */}
      {showAIFeedbackPopup && aiFeedback && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowAIFeedbackPopup(false)}
        >
          <div
            className={`max-w-lg w-full rounded-3xl shadow-2xl border p-8 ${
              isDark
                ? 'bg-gray-900/95 border-gray-800/50'
                : 'bg-white/95 border-gray-200/50'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">
                {aiFeedback.stats.rank === 1 ? '🥇' : aiFeedback.stats.rank === 2 ? '🥈' : aiFeedback.stats.rank === 3 ? '🥉' : '🎯'}
              </div>
              <h2 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                お疲れ様でした！
              </h2>
            </div>

            <div className={`mb-6 p-5 rounded-xl ${
              aiFeedback.stats.rank === 1
                ? isDark
                  ? 'bg-gradient-to-br from-yellow-600/20 via-yellow-500/10 to-amber-600/20 border border-yellow-500/30'
                  : 'bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100 border border-yellow-300/50'
                : aiFeedback.stats.rank === 2
                ? isDark
                  ? 'bg-gradient-to-br from-gray-500/20 via-slate-400/10 to-gray-600/20 border border-gray-400/30'
                  : 'bg-gradient-to-br from-gray-100 via-slate-50 to-gray-200 border border-gray-300/50'
                : aiFeedback.stats.rank === 3
                ? isDark
                  ? 'bg-gradient-to-br from-orange-700/20 via-amber-600/10 to-orange-800/20 border border-orange-600/30'
                  : 'bg-gradient-to-br from-orange-100 via-amber-50 to-orange-200 border border-orange-300/50'
                : isDark
                ? 'bg-gray-800 border border-gray-700'
                : 'bg-gray-50 border border-gray-200'
            }`}>
              {/* ランキング情報 */}
              <div className={`text-lg font-bold mb-3 ${
                aiFeedback.stats.rank <= 3
                  ? aiFeedback.stats.rank === 1
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : aiFeedback.stats.rank === 2
                    ? 'text-gray-600 dark:text-gray-300'
                    : 'text-orange-600 dark:text-orange-400'
                  : isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                今日の頑張り度: {aiFeedback.stats.rank}位 / {aiFeedback.stats.totalMembers}人中
              </div>

              {/* タスク統計 */}
              <div className={`text-sm mb-4 space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <div>タスク: {aiFeedback.stats.completedTasks} / {aiFeedback.stats.taskCount}個完了</div>
                <div>達成率: {aiFeedback.stats.completionRate}%</div>
              </div>

              {/* AIメッセージ */}
              <p className={`text-base leading-relaxed whitespace-pre-wrap ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {aiFeedback.message}
              </p>
            </div>

            <button
              onClick={() => setShowAIFeedbackPopup(false)}
              className={`w-full px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                isDark
                  ? 'bg-white text-gray-900 hover:bg-gray-100'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 残業アラート */}
      {showOvertimeAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowOvertimeAlert(false)}
        >
          <div
            className={`max-w-md w-full rounded-3xl shadow-2xl border p-8 ${
              isDark
                ? 'bg-gray-900/95 border-red-900/50'
                : 'bg-white/95 border-red-200/50'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className={`text-3xl font-bold mb-4 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                長時間労働アラート
              </h2>
              <p className={`text-lg mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                勤務時間が15時間を超えています
              </p>
              <p className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                健康のため、早めに退勤することをおすすめします
              </p>
              <button
                onClick={() => setShowOvertimeAlert(false)}
                className={`mt-6 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isDark
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                確認しました
              </button>
            </div>
          </div>
        </div>
      )}
    
    <div className={`backdrop-blur-xl rounded-3xl shadow-lg border p-8 transition-colors duration-500 ${
      isDark
        ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
        : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
    }`}>
      <div className="text-center space-y-6">
        {/* ステータスバッジ */}
        <div>
          <span
            className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
              status === 'not_started'
                ? isDark
                  ? 'bg-gray-800 text-gray-400'
                  : 'bg-gray-100 text-gray-600'
                : status === 'working'
                ? isDark
                  ? 'bg-white text-gray-900'
                  : 'bg-gray-900 text-white'
                : isDark
                  ? 'bg-gray-800 text-gray-400'
                  : 'bg-gray-100 text-gray-600'
            }`}
          >
            {status === 'not_started'
              ? '未出勤'
              : status === 'working'
              ? '出勤中'
              : '退勤済み'}
          </span>
        </div>

        {/* 時刻表示 */}
        {status !== 'not_started' && (
          <div className="space-y-2">
            <p className={`text-sm font-light ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {formatTime(attendance.clock_in)} -{' '}
              {status === 'completed' ? formatTime(attendance.clock_out) : '現在'}
            </p>
            <p className={`text-5xl font-light tracking-tight ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {getWorkDuration()}
            </p>
            <p className={`text-sm font-light ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              勤務時間
            </p>
          </div>
        )}

        {/* アクションボタン */}
        <div className="pt-4">
          {status === 'not_started' && (
            <button
              onClick={handleClockIn}
              disabled={loading}
              className={`w-full font-medium py-4 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg ${
                isDark
                  ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-white/20'
                  : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-900/20'
              }`}
            >
              🌅 出勤する
            </button>
          )}

          {status === 'working' && (
            <button
              onClick={handleClockOut}
              disabled={loading}
              className={`w-full font-medium py-4 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg ${
                isDark
                  ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-white/20'
                  : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-900/20'
              }`}
            >
              🌆 退勤する
            </button>
          )}

          {status === 'completed' && (
            <div className="space-y-4">
              <div className={`rounded-xl p-6 space-y-2 ${
                isDark ? 'bg-gray-800' : 'bg-gray-50'
              }`}>
                <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  本日の勤務は終了しました
                </p>
                <p className={`text-sm font-light ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  お疲れ様でした！
                </p>
              </div>

              {/* 再出勤ボタン */}
              <button
                onClick={handleReClockIn}
                disabled={loading}
                className={`w-full font-medium py-4 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg ${
                  isDark
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'
                    : 'bg-blue-500 text-white hover:bg-blue-600 shadow-blue-500/20'
                }`}
              >
                🔄 再出勤する
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 勤務タイプ選択モーダル */}
      {showWorkTypeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in">
          <div className={`rounded-2xl shadow-2xl p-8 max-w-md w-full animate-scale-in ${
            isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white'
          }`}>
            <h3 className={`text-2xl font-semibold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              出勤タイプを選択
            </h3>

            <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              今日の勤務タイプを選択してください
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => confirmClockIn('remote')}
                disabled={loading}
                className={`w-full font-medium py-4 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg ${
                  isDark
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'
                    : 'bg-blue-500 text-white hover:bg-blue-600 shadow-blue-500/20'
                }`}
              >
                🏠 リモート
              </button>
              <button
                onClick={() => confirmClockIn('office')}
                disabled={loading}
                className={`w-full font-medium py-4 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg ${
                  isDark
                    ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-600/20'
                    : 'bg-green-500 text-white hover:bg-green-600 shadow-green-500/20'
                }`}
              >
                🏢 出社
              </button>
            </div>

            <button
              onClick={() => setShowWorkTypeModal(false)}
              disabled={loading}
              className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                isDark
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 休憩時間入力モーダル */}
      {showBreakModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className={`rounded-2xl shadow-2xl p-8 max-w-md w-full animate-scale-in ${
            isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white'
          }`}>
            <h3 className={`text-2xl font-semibold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              お疲れ様でした！
            </h3>

            <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              今日の休憩時間を入力してください
            </p>

            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                休憩時間（分）
              </label>
              <input
                type="number"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
                placeholder="60"
                min="0"
                className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white focus:ring-white/20'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900/20'
                }`}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={cancelClockOut}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={confirmClockOut}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors shadow-lg ${
                  isDark
                    ? 'bg-white text-gray-900 hover:bg-gray-100'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                退勤する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

// クラッカーアニメーションコンポーネント
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