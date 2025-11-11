import { useState, useEffect } from 'react'
import { getTodayAttendance, clockIn, clockOut } from '../utils/attendance'
import { sendSlackNotification } from '../utils/slack'
import { getTodayTodoList } from '../utils/todo'

export default function AttendanceCard({ user, isDark }) {
  const [attendance, setAttendance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showBreakModal, setShowBreakModal] = useState(false)
  const [breakMinutes, setBreakMinutes] = useState('')

  useEffect(() => {
    loadAttendance()
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

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

  const handleClockIn = async () => {
    try {
      setLoading(true)
      const result = await clockIn(user.id)
      await loadAttendance()

      // TODOリストを取得
      const todoList = await getTodayTodoList(user.id)
      const todoItems = todoList?.todo_items || []

      // Slack通知を送信
      await sendSlackNotification(
        'clock_in',
        { id: user.id, name: user.name || user.email },
        result,
        todoItems
      )
    } catch (error) {
      console.error('Error clocking in:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClockOut = () => {
    setShowBreakModal(true)
  }

  const confirmClockOut = async () => {
    const minutes = parseInt(breakMinutes) || 0

    try {
      setLoading(true)
      setShowBreakModal(false)
      const result = await clockOut(user.id, minutes)
      await loadAttendance()

      // TODOリストを取得
      const todoList = await getTodayTodoList(user.id)
      const todoItems = todoList?.todo_items || []

      // Slack通知を送信（TODOリスト付き）
      await sendSlackNotification(
        'clock_out',
        { id: user.id, name: user.name || user.email },
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

  const getStatus = () => {
    if (!attendance || !attendance.clock_in) return 'not_started'
    if (attendance.clock_out) return 'completed'
    return 'working'
  }

  const getWorkDuration = () => {
    if (!attendance?.clock_in) return '0:00'

    const start = new Date(attendance.clock_in)
    const end = attendance.clock_out ? new Date(attendance.clock_out) : currentTime
    const diff = Math.floor((end - start) / 1000 / 60) // 分

    const hours = Math.floor(diff / 60)
    const minutes = diff % 60

    return `${hours}:${minutes.toString().padStart(2, '0')}`
  }

  const formatTime = (dateString) => {
    if (!dateString) return '--:--'
    const date = new Date(dateString)
    return `${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`
  }

  const status = getStatus()

  return (
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
          )}
        </div>
      </div>

      {/* 休憩時間入力モーダル */}
      {showBreakModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 ${
            isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white'
          }`}>
            <h3 className={`text-2xl font-semibold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              退勤確認
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
  )
}
