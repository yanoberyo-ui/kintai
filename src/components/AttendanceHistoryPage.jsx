import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

export default function AttendanceHistoryPage({ user, isDark }) {
  const [attendances, setAttendances] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [summary, setSummary] = useState({
    totalDays: 0,
    remoteDays: 0,
    officeDays: 0,
    totalHours: 0,
    totalMinutes: 0,
    averageHours: 0,
    averageMinutes: 0
  })

  useEffect(() => {
    loadAttendances()
  }, [user, selectedYear, selectedMonth])

  const loadAttendances = async () => {
    try {
      setLoading(true)
      
      // 選択された年月の開始日と終了日を計算
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .not('clock_in', 'is', null)
        .order('date', { ascending: false })

      if (error) throw error

      setAttendances(data || [])
      calculateSummary(data || [])
    } catch (error) {
      console.error('Error loading attendances:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateSummary = (data) => {
    const totalDays = data.length
    let totalMinutes = 0
    let remoteDays = 0
    let officeDays = 0

    data.forEach(record => {
      if (record.total_work_minutes) {
        totalMinutes += record.total_work_minutes
      }
      // work_typeでリモートと出社を分類
      if (record.work_type === 'remote') {
        remoteDays++
      } else if (record.work_type === 'office') {
        officeDays++
      }
    })

    const totalHours = Math.floor(totalMinutes / 60)
    const remainingMinutes = totalMinutes % 60
    const averageMinutes = totalDays > 0 ? Math.floor(totalMinutes / totalDays) : 0
    const averageHours = Math.floor(averageMinutes / 60)
    const averageMins = averageMinutes % 60

    setSummary({
      totalDays,
      remoteDays,
      officeDays,
      totalHours,
      totalMinutes: remainingMinutes,
      averageHours,
      averageMinutes: averageMins
    })
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

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    const weekday = weekdays[date.getDay()]
    
    return `${month}/${day}(${weekday})`
  }

  const formatWorkDuration = (minutes) => {
    if (!minutes && minutes !== 0) return '0:00'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')}`
  }

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear(selectedYear - 1)
      setSelectedMonth(12)
    } else {
      setSelectedMonth(selectedMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear(selectedYear + 1)
      setSelectedMonth(1)
    } else {
      setSelectedMonth(selectedMonth + 1)
    }
  }

  // 中抜けセッションを取得
  const getBreakSessions = (record) => {
    if (!record.break_sessions || record.break_sessions.length === 0) {
      return []
    }
    
    return record.break_sessions
      .filter(session => session.start)
      .map(session => ({
        start: formatTime(session.start),
        end: session.end ? formatTime(session.end) : null
      }))
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-4 md:space-y-6">
      {/* ヘッダー */}
      <div className={`backdrop-blur-xl rounded-3xl shadow-lg border overflow-hidden transition-colors duration-500 ${
        isDark
          ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
          : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
      }`}>
        <div className="p-4 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              出勤履歴
            </h1>
            
            {/* 月選択 */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={goToPreviousMonth}
                className={`p-2 rounded-full transition-all duration-200 hover:scale-110 ${
                  isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                }`}
              >
                <svg className={`w-6 h-6 ${isDark ? 'text-white' : 'text-gray-900'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <h2 className={`text-lg md:text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {selectedYear}年 {monthNames[selectedMonth - 1]}
              </h2>

              <button
                onClick={goToNextMonth}
                className={`p-2 rounded-full transition-all duration-200 hover:scale-110 ${
                  isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                }`}
              >
                <svg className={`w-6 h-6 ${isDark ? 'text-white' : 'text-gray-900'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* サマリー */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            <div className={`p-3 md:p-4 rounded-xl ${
              isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'
            }`}>
              <div className={`text-xs md:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                出勤日数
              </div>
              <div className={`text-xl md:text-2xl font-bold mt-1 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {summary.totalDays}日
              </div>
            </div>

            <div className={`p-3 md:p-4 rounded-xl ${
              isDark ? 'bg-blue-900/20 border border-blue-700/30' : 'bg-blue-50 border border-blue-200'
            }`}>
              <div className={`text-xs md:text-sm flex items-center gap-1 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                🏠 リモート
              </div>
              <div className={`text-xl md:text-2xl font-bold mt-1 ${
                isDark ? 'text-blue-300' : 'text-blue-700'
              }`}>
                {summary.remoteDays}日
              </div>
            </div>

            <div className={`p-3 md:p-4 rounded-xl ${
              isDark ? 'bg-green-900/20 border border-green-700/30' : 'bg-green-50 border border-green-200'
            }`}>
              <div className={`text-xs md:text-sm flex items-center gap-1 ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                🏢 出社
              </div>
              <div className={`text-xl md:text-2xl font-bold mt-1 ${
                isDark ? 'text-green-300' : 'text-green-700'
              }`}>
                {summary.officeDays}日
              </div>
            </div>

            <div className={`p-3 md:p-4 rounded-xl ${
              isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'
            }`}>
              <div className={`text-xs md:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                総勤務時間
              </div>
              <div className={`text-xl md:text-2xl font-bold mt-1 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {summary.totalHours}:{summary.totalMinutes.toString().padStart(2, '0')}
              </div>
            </div>

            <div className={`p-3 md:p-4 rounded-xl ${
              isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'
            }`}>
              <div className={`text-xs md:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                平均勤務時間
              </div>
              <div className={`text-xl md:text-2xl font-bold mt-1 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {summary.averageHours}:{summary.averageMinutes.toString().padStart(2, '0')}
              </div>
            </div>

            <div className={`p-3 md:p-4 rounded-xl ${
              isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'
            }`}>
              <div className={`text-xs md:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                リモート率
              </div>
              <div className={`text-xl md:text-2xl font-bold mt-1 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {summary.totalDays > 0 ? Math.round((summary.remoteDays / summary.totalDays) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 出勤履歴リスト */}
      <div className={`backdrop-blur-xl rounded-3xl shadow-lg border overflow-hidden transition-colors duration-500 ${
        isDark
          ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
          : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
      }`}>
        <div className="p-4 md:p-8">
          {loading ? (
            <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              読み込み中...
            </div>
          ) : attendances.length === 0 ? (
            <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              この期間の出勤記録がありません
            </div>
          ) : (
            <div className="space-y-3 md:space-y-2">
              {attendances.map((attendance) => {
                const breakSessions = getBreakSessions(attendance)
                return (
                  <div
                    key={attendance.id}
                    className={`p-4 md:p-4 rounded-xl transition-all duration-200 ${
                      isDark
                        ? 'bg-gray-800/50 hover:bg-gray-800'
                        : 'bg-gray-100/50 hover:bg-gray-100'
                    }`}
                  >
                    {/* モバイル: 縦並びレイアウト */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
                      {/* 日付とタイプ */}
                      <div className="flex-1">
                        <div className={`text-base md:text-lg font-semibold flex items-center gap-2 flex-wrap ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {formatDate(attendance.date)}
                          {attendance.work_type && (
                            <span className={`text-xs md:text-sm px-2 py-0.5 rounded-full ${
                              attendance.work_type === 'remote'
                                ? isDark
                                  ? 'bg-blue-900/30 text-blue-300'
                                  : 'bg-blue-100 text-blue-700'
                                : isDark
                                ? 'bg-green-900/30 text-green-300'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {attendance.work_type === 'remote' ? '🏠 リモート' : '🏢 出社'}
                            </span>
                          )}
                          <span className={`text-xs md:text-sm px-2 py-0.5 rounded-full ml-auto md:ml-0 ${
                            attendance.clock_out
                              ? isDark
                                ? 'bg-green-900/30 text-green-300'
                                : 'bg-green-100 text-green-800'
                              : isDark
                              ? 'bg-blue-900/30 text-blue-300'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {attendance.clock_out ? '退勤済み' : '勤務中'}
                          </span>
                        </div>
                        
                        {/* 出退勤時刻 */}
                        <div className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {formatTime(attendance.clock_in)} - {attendance.clock_out ? formatTime(attendance.clock_out) : '勤務中'}
                        </div>
                        
                        {/* 中抜け情報（モバイル） */}
                        {breakSessions.length > 0 && (
                          <div className={`text-xs mt-2 md:hidden ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            中抜け: {breakSessions.map((s, i) => (
                              <span key={i}>
                                {i > 0 && ' / '}
                                {s.start}-{s.end || '中抜け中'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 勤務時間と休憩時間（モバイル: 横並び、PC: 横並び） */}
                      <div className="flex items-center gap-4 md:gap-6">
                        <div className="text-left md:text-right">
                          <div className={`text-xs md:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            勤務時間
                          </div>
                          <div className={`text-lg md:text-xl font-bold mt-1 ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>
                            {formatWorkDuration(attendance.total_work_minutes)}
                          </div>
                        </div>

                        {attendance.break_minutes_used > 0 && (
                          <div className="text-left md:text-right">
                            <div className={`text-xs md:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              休憩時間
                            </div>
                            <div className={`text-base md:text-lg font-semibold mt-1 ${
                              isDark ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              {formatWorkDuration(attendance.break_minutes_used)}
                            </div>
                          </div>
                        )}

                        {/* PC: ステータスバッジ */}
                        <div className={`hidden md:block px-3 py-1 rounded-full text-sm font-medium ${
                          attendance.clock_out
                            ? isDark
                              ? 'bg-green-900/30 text-green-300'
                              : 'bg-green-100 text-green-800'
                            : isDark
                            ? 'bg-blue-900/30 text-blue-300'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {attendance.clock_out ? '退勤済み' : '勤務中'}
                        </div>
                      </div>
                    </div>
                    
                    {/* PC: 中抜け情報 */}
                    {breakSessions.length > 0 && (
                      <div className={`hidden md:block text-xs mt-3 pt-3 border-t ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                        中抜け: {breakSessions.map((s, i) => (
                          <span key={i}>
                            {i > 0 && ' / '}
                            {s.start}-{s.end || '中抜け中'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

