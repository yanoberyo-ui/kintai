import React, { useState, useEffect } from 'react'
import { getTodayAttendance, clockIn, clockOut, reClockIn } from '../utils/attendance'
import { sendSlackNotification } from '../utils/slack'
import { getTodayTodoList } from '../utils/todo'
import { supabase } from '../utils/supabase'
import { getAIFeedback } from '../utils/ranking'

export default function AttendanceCard({ user, isDark }) {
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

  const handleClockIn = async () => {
    try {
      setLoading(true)
      const result = await clockIn(user.id)
      await loadAttendance()

      // ユーザー情報を取得（最新のデータを確実に取得）
      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single()

      // TODOリストを取得
      const todoList = await getTodayTodoList(user.id)
      const todoItems = todoList?.todo_items || []

      // Slack通知を送信
      await sendSlackNotification(
        'clock_in',
        { id: user.id, name: userData?.name || user.email },
        result,
        todoItems
      )

      // 誕生日チェック
      await checkBirthdays()
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
    setLoadingFeedback(true)
    setAiFeedback(null)

    try {
      // AIフィードバックを取得
      const feedback = await getAIFeedback(user.id, userProfile?.name || user.email)
      setAiFeedback(feedback)
    } catch (error) {
      console.error('Error getting AI feedback:', error)
      // エラーが出てもモーダルは表示する
    } finally {
      setLoadingFeedback(false)
    }
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

      // TODOリストを取得
      const todoList = await getTodayTodoList(user.id)
      const todoItems = todoList?.todo_items || []

      // Slack通知を送信（TODOリスト付き）
      await sendSlackNotification(
        'clock_out',
        { id: user.id, name: userData?.name || user.email },
        result,
        todoItems
      )

      setBreakMinutes('')
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

      // TODOリストを取得
      const todoList = await getTodayTodoList(user.id)
      const todoItems = todoList?.todo_items || []

      // Slack通知を送信
      await sendSlackNotification(
        'clock_in',
        { id: user.id, name: userData?.name || user.email },
        result,
        todoItems
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

    // 日本時間（JST）で今日の日付を取得
    const jstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
    const today = jstNow.toISOString().split('T')[0]
    
    const clockInTime = attendance.clock_in.includes('T') 
      ? attendance.clock_in.split('T')[1] 
      : attendance.clock_in
    const start = new Date(`${today}T${clockInTime}`)
    
    let end
    if (attendance.clock_out) {
      const clockOutTime = attendance.clock_out.includes('T')
        ? attendance.clock_out.split('T')[1]
        : attendance.clock_out
      end = new Date(`${today}T${clockOutTime}`)
    } else {
      end = jstNow
    }
    
    const diff = Math.floor((end - start) / 1000 / 60) // 分

    const hours = Math.floor(diff / 60)
    const minutes = diff % 60

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

      {/* 休憩時間入力モーダル */}
      {showBreakModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-2xl p-8 max-w-lg w-full ${
            isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white'
          }`}>
            <h3 className={`text-2xl font-semibold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              お疲れ様でした！
            </h3>

            {/* AIフィードバック表示エリア */}
            {loadingFeedback && (
              <div className={`mb-6 p-4 rounded-xl ${
                isDark ? 'bg-gray-800' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent"></div>
                  <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                    今日の頑張りを分析中...
                  </p>
                </div>
              </div>
            )}

            {aiFeedback && !loadingFeedback && (
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
                <div className={`text-sm font-semibold mb-3 ${
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
                <div className={`text-xs mb-3 space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
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
            )}

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