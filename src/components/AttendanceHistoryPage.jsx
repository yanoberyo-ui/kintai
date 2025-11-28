import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

export default function AttendanceHistoryPage({ user, isDark }) {
  const [attendances, setAttendances] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [summary, setSummary] = useState({
    totalDays: 0,
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

    data.forEach(record => {
      if (record.total_work_minutes) {
        totalMinutes += record.total_work_minutes
      }
    })

    const totalHours = Math.floor(totalMinutes / 60)
    const remainingMinutes = totalMinutes % 60
    const averageMinutes = totalDays > 0 ? Math.floor(totalMinutes / totalDays) : 0
    const averageHours = Math.floor(averageMinutes / 60)
    const averageMins = averageMinutes % 60

    setSummary({
      totalDays,
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

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6">
      {/* ヘッダー */}
      <div className={`backdrop-blur-xl rounded-3xl shadow-lg border overflow-hidden transition-colors duration-500 ${
        isDark
          ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
          : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
      }`}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className={`text-3xl font-bold tracking-tight ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              出勤履歴
            </h1>
            
            {/* 月選択 */}
            <div className="flex items-center gap-4">
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

              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-xl ${
              isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'
            }`}>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                出勤日数
              </div>
              <div className={`text-2xl font-bold mt-1 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {summary.totalDays}日
              </div>
            </div>

            <div className={`p-4 rounded-xl ${
              isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'
            }`}>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                総勤務時間
              </div>
              <div className={`text-2xl font-bold mt-1 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {summary.totalHours}:{summary.totalMinutes.toString().padStart(2, '0')}
              </div>
            </div>

            <div className={`p-4 rounded-xl ${
              isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'
            }`}>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                平均勤務時間
              </div>
              <div className={`text-2xl font-bold mt-1 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {summary.averageHours}:{summary.averageMinutes.toString().padStart(2, '0')}
              </div>
            </div>

            <div className={`p-4 rounded-xl ${
              isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'
            }`}>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                総勤務時間（分）
              </div>
              <div className={`text-2xl font-bold mt-1 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {summary.totalHours * 60 + summary.totalMinutes}分
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
        <div className="p-8">
          {loading ? (
            <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              読み込み中...
            </div>
          ) : attendances.length === 0 ? (
            <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              この期間の出勤記録がありません
            </div>
          ) : (
            <div className="space-y-2">
              {attendances.map((attendance) => (
                <div
                  key={attendance.id}
                  className={`p-4 rounded-xl transition-all duration-200 ${
                    isDark
                      ? 'bg-gray-800/50 hover:bg-gray-800'
                      : 'bg-gray-100/50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <div className={`text-lg font-semibold ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {formatDate(attendance.date)}
                      </div>
                      <div className={`text-sm mt-1 ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {formatTime(attendance.clock_in)} - {attendance.clock_out ? formatTime(attendance.clock_out) : '勤務中'}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          勤務時間
                        </div>
                        <div className={`text-xl font-bold mt-1 ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {formatWorkDuration(attendance.total_work_minutes)}
                        </div>
                      </div>

                      {attendance.break_minutes_used > 0 && (
                        <div className="text-right">
                          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            休憩時間
                          </div>
                          <div className={`text-lg font-semibold mt-1 ${
                            isDark ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {formatWorkDuration(attendance.break_minutes_used)}
                          </div>
                        </div>
                      )}

                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

