import React, { useState } from 'react'
import { supabase } from '../../../utils/supabase'
import { getTodayDate } from '../../../utils/date'

export default function AttendanceManagement({
  isDark,
  users,
  selectedYear,
  selectedMonth,
  selectedDepartment,
  departments
}) {
  const [attendanceViewMode, setAttendanceViewMode] = useState('summary')
  const [attendances, setAttendances] = useState([])
  const [dailyAttendances, setDailyAttendances] = useState([])
  const [editingAttendance, setEditingAttendance] = useState(null)
  const [selectedUser, setSelectedUser] = useState('all')
  const [selectedDate, setSelectedDate] = useState('all')
  const [expandedSessions, setExpandedSessions] = useState(new Set())
  const [showAddAttendanceModal, setShowAddAttendanceModal] = useState(false)
  const [newAttendance, setNewAttendance] = useState({
    user_id: '',
    date: getTodayDate(),
    clock_in: '09:00',
    clock_out: '18:00',
    break_minutes_used: 60,
    work_type: 'office'
  })

  React.useEffect(() => {
    if (attendanceViewMode === 'summary') {
      loadAttendances()
    } else {
      loadDailyAttendances()
    }
  }, [selectedYear, selectedMonth, attendanceViewMode])

  const loadAttendances = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

      const [
        { data: attendanceData, error: attendanceError },
        { data: todoData }
      ] = await Promise.all([
        supabase
          .from('attendances')
          .select(`*, user:users (id, name, department)`)
          .gte('date', startDate)
          .lte('date', endDate)
          .not('clock_in', 'is', null),
        supabase
          .from('todo_lists')
          .select(`*, todo_items (is_completed)`)
          .gte('date', startDate)
          .lte('date', endDate)
      ])

      if (attendanceError) throw attendanceError

      const userStats = {}
      attendanceData?.forEach(record => {
        if (!record.user || !record.user.id || !record.clock_in) return
        const userId = record.user.id
        if (!userStats[userId]) {
          userStats[userId] = {
            name: record.user.name,
            department: record.user.department,
            attendanceDays: 0, remoteDays: 0, officeDays: 0,
            totalWorkMinutes: 0, todoTotal: 0, todoCompleted: 0
          }
        }
        userStats[userId].attendanceDays++
        if (record.work_type === 'remote') userStats[userId].remoteDays++
        else if (record.work_type === 'office') userStats[userId].officeDays++
        userStats[userId].totalWorkMinutes += record.total_work_minutes || 0
      })

      todoData?.forEach(list => {
        const userId = list.user_id
        if (userStats[userId]) {
          const items = list.todo_items || []
          userStats[userId].todoTotal += items.length
          userStats[userId].todoCompleted += items.filter(item => item.is_completed).length
        }
      })

      const attendanceArray = Object.values(userStats).map(user => ({
        ...user,
        avgWorkMinutes: user.attendanceDays > 0 ? Math.round(user.totalWorkMinutes / user.attendanceDays) : 0,
        todoRate: user.todoTotal > 0 ? Math.round((user.todoCompleted / user.todoTotal) * 100) : 0
      }))

      setAttendances(attendanceArray)
    } catch (error) {
      console.error('Error loading attendances:', error)
      setAttendances([])
    }
  }

  const loadDailyAttendances = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('attendances')
        .select(`*, user:users (id, name, department)`)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('user_id', { ascending: true })

      if (error) throw error

      const formattedData = data?.map(record => {
        let workMinutes = 0
        let calculatedMinutes = 0
        if (record.clock_in && record.clock_out) {
          const clockIn = new Date(record.clock_in)
          const clockOut = new Date(record.clock_out)
          if (!isNaN(clockIn.getTime()) && !isNaN(clockOut.getTime()) && clockOut > clockIn) {
            calculatedMinutes = Math.floor((clockOut - clockIn) / 60000) - (record.break_minutes_used || 0)
          }
        }
        workMinutes = record.total_work_minutes || 0
        if (workMinutes === 0 && calculatedMinutes > 0) {
          workMinutes = Math.max(0, calculatedMinutes)
        }
        return { ...record, calculatedWorkMinutes: Math.max(0, workMinutes) }
      }) || []

      setDailyAttendances(formattedData)
    } catch (error) {
      console.error('Error loading daily attendances:', error)
      setDailyAttendances([])
    }
  }

  const formatTimeForInput = (isoString) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000)
    const hours = jstDate.getUTCHours().toString().padStart(2, '0')
    const minutes = jstDate.getUTCMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const getBreakSessions = (record) => {
    if (!record.break_sessions || record.break_sessions.length === 0) return []
    return record.break_sessions
      .filter(session => session.start)
      .map(session => ({
        start: formatTimeForInput(session.start),
        end: session.end ? formatTimeForInput(session.end) : null
      }))
  }

  const toggleSessionExpansion = (attendanceId) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(attendanceId)) newSet.delete(attendanceId)
      else newSet.add(attendanceId)
      return newSet
    })
  }

  const handleUpdateAttendance = async (attendanceId, updates) => {
    try {
      const updateData = {}
      if (updates.clock_in !== undefined) {
        const record = dailyAttendances.find(a => a.id === attendanceId)
        if (record && updates.clock_in) {
          const jstDate = new Date(`${record.date}T${updates.clock_in}:00+09:00`)
          updateData.clock_in = jstDate.toISOString()
        } else if (updates.clock_in === '') {
          updateData.clock_in = null
        }
      }
      if (updates.clock_out !== undefined) {
        const record = dailyAttendances.find(a => a.id === attendanceId)
        if (record && updates.clock_out) {
          const jstDate = new Date(`${record.date}T${updates.clock_out}:00+09:00`)
          updateData.clock_out = jstDate.toISOString()
        } else if (updates.clock_out === '') {
          updateData.clock_out = null
        }
      }
      if (updates.break_minutes_used !== undefined) {
        updateData.break_minutes_used = parseInt(updates.break_minutes_used) || 0
      }
      if (updates.work_type !== undefined) {
        updateData.work_type = updates.work_type
      }

      const record = dailyAttendances.find(a => a.id === attendanceId)
      if (record) {
        const clockIn = updateData.clock_in ? new Date(updateData.clock_in) : (record.clock_in ? new Date(record.clock_in) : null)
        const clockOut = updateData.clock_out ? new Date(updateData.clock_out) : (record.clock_out ? new Date(record.clock_out) : null)
        const breakMinutes = updateData.break_minutes_used !== undefined ? updateData.break_minutes_used : (record.break_minutes_used || 0)
        if (clockIn && clockOut && !isNaN(clockIn.getTime()) && !isNaN(clockOut.getTime())) {
          const totalMinutes = Math.floor((clockOut - clockIn) / 60000)
          updateData.total_work_minutes = Math.max(0, totalMinutes - breakMinutes)
        }
      }

      const { error } = await supabase.from('attendances').update(updateData).eq('id', attendanceId)
      if (error) throw error
      await loadDailyAttendances()
      setEditingAttendance(null)
      alert('勤怠データを更新しました')
    } catch (error) {
      console.error('Error updating attendance:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const handleDeleteAttendance = async (attendanceId) => {
    if (!window.confirm('この勤怠データを削除しますか？')) return
    try {
      const { error } = await supabase.from('attendances').delete().eq('id', attendanceId)
      if (error) throw error
      await loadDailyAttendances()
      alert('勤怠データを削除しました')
    } catch (error) {
      console.error('Error deleting attendance:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const handleCreateAttendance = async () => {
    try {
      if (!newAttendance.user_id) { alert('ユーザーを選択してください'); return }
      if (!newAttendance.date) { alert('日付を入力してください'); return }
      if (!newAttendance.clock_in) { alert('出勤時刻を入力してください'); return }

      const { data: existing } = await supabase
        .from('attendances').select('id')
        .eq('user_id', newAttendance.user_id).eq('date', newAttendance.date).single()
      if (existing) { alert('この日付にはすでに勤怠データが存在します。編集機能を使用してください。'); return }

      const clockInDate = new Date(`${newAttendance.date}T${newAttendance.clock_in}:00+09:00`)
      const clockOutDate = newAttendance.clock_out
        ? new Date(`${newAttendance.date}T${newAttendance.clock_out}:00+09:00`)
        : null

      let totalWorkMinutes = 0
      if (clockOutDate) {
        const totalMinutes = Math.floor((clockOutDate - clockInDate) / 60000)
        totalWorkMinutes = Math.max(0, totalMinutes - (newAttendance.break_minutes_used || 0))
      }

      const { error } = await supabase.from('attendances').insert({
        user_id: newAttendance.user_id,
        date: newAttendance.date,
        clock_in: clockInDate.toISOString(),
        clock_out: clockOutDate ? clockOutDate.toISOString() : null,
        break_minutes_used: newAttendance.break_minutes_used || 0,
        total_work_minutes: totalWorkMinutes,
        work_type: newAttendance.work_type || null
      })
      if (error) throw error

      await loadDailyAttendances()
      setShowAddAttendanceModal(false)
      setNewAttendance({ user_id: '', date: getTodayDate(), clock_in: '09:00', clock_out: '18:00', break_minutes_used: 60, work_type: 'office' })
      alert('勤怠データを追加しました')
    } catch (error) {
      console.error('Error creating attendance:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* ビュー切り替えとフィルター */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className={`inline-flex rounded-xl p-1 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <button
            onClick={() => setAttendanceViewMode('summary')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              attendanceViewMode === 'summary'
                ? isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            月次サマリー
          </button>
          <button
            onClick={() => setAttendanceViewMode('daily')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              attendanceViewMode === 'daily'
                ? isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            日別詳細
          </button>
        </div>

        {attendanceViewMode === 'daily' && (
          <>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`px-3 py-2 text-sm rounded-xl transition-colors ${
                isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'
              } focus:outline-none`}
            >
              <option value="all">全日程</option>
              {[...new Set(dailyAttendances.map(a => a.date))].sort((a, b) => b.localeCompare(a)).map(date => (
                <option key={date} value={date}>
                  {new Date(date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                </option>
              ))}
            </select>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className={`px-3 py-2 text-sm rounded-xl transition-colors ${
                isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'
              } focus:outline-none`}
            >
              <option value="all">全員</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* 月次サマリービュー */}
      {attendanceViewMode === 'summary' && (
        <div className={`rounded-2xl border overflow-hidden ${
          isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm md:text-base">
              <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
                <tr>
                  {['名前', 'ユニット', '出勤', 'リモート', '出社', '合計', '平均', 'TODO'].map(h => (
                    <th key={h} className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
                {attendances
                  .filter(user => selectedDepartment === 'all' || user.department === selectedDepartment)
                  .map((user, index) => (
                  <tr key={index} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{user.name}</td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{user.department}</td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{user.attendanceDays}日</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>{user.remoteDays || 0}日</span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'}`}>{user.officeDays || 0}日</span>
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {Math.floor(user.totalWorkMinutes / 60)}:{String(user.totalWorkMinutes % 60).padStart(2, '0')}
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {Math.floor(user.avgWorkMinutes / 60)}:{String(user.avgWorkMinutes % 60).padStart(2, '0')}
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {user.todoTotal > 0 ? `${user.todoRate}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {attendances.length === 0 && (
              <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <p>出勤データがありません</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 日別詳細ビュー */}
      {attendanceViewMode === 'daily' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddAttendanceModal(true)}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors flex items-center gap-2 ${
                isDark
                  ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              <span>+</span> 勤怠データを追加
            </button>
          </div>

          {(() => {
            const filteredData = dailyAttendances
              .filter(record => selectedDate === 'all' || record.date === selectedDate)
              .filter(record => selectedUser === 'all' || record.user_id === selectedUser)
              .filter(record => selectedDepartment === 'all' || record.user?.department === selectedDepartment)

            const groupedByDate = filteredData.reduce((acc, record) => {
              if (!acc[record.date]) acc[record.date] = []
              acc[record.date].push(record)
              return acc
            }, {})

            const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a))

            if (sortedDates.length === 0) {
              return (
                <div className={`rounded-2xl border p-12 text-center ${
                  isDark ? 'border-gray-800 bg-gray-900/50 text-gray-500' : 'border-gray-200 bg-white text-gray-400'
                }`}>
                  <p>出勤データがありません</p>
                </div>
              )
            }

            return sortedDates.map(date => (
              <div key={date} className={`rounded-2xl border overflow-hidden ${
                isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
              }`}>
                <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'bg-gray-800/70' : 'bg-gray-100'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📅</span>
                    <div>
                      <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {new Date(date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                      </div>
                      <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        出勤者: {groupedByDate[date].length}名
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedDate(selectedDate === date ? 'all' : date)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      selectedDate === date
                        ? isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                        : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {selectedDate === date ? '選択中' : '選択'}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className={isDark ? 'bg-gray-800/30' : 'bg-gray-50'}>
                      <tr>
                        {['名前', '出勤', '退勤', '中抜け', '休憩', '稼働時間', 'タイプ', '操作'].map(h => (
                          <th key={h} className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${h === '中抜け' ? 'text-center' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
                      {groupedByDate[date].map((record) => (
                        <tr key={record.id} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                          <td className={`px-3 py-3 whitespace-nowrap text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {record.user?.name || '不明'}
                          </td>
                          {editingAttendance === record.id ? (
                            <>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <input type="time" defaultValue={formatTimeForInput(record.clock_in)} id={`clock_in_${record.id}`}
                                  className={`w-24 px-2 py-1 text-sm rounded ${isDark ? 'bg-gray-800 text-white border border-gray-600' : 'bg-white text-gray-900 border border-gray-300'}`} />
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <input type="time" defaultValue={formatTimeForInput(record.clock_out)} id={`clock_out_${record.id}`}
                                  className={`w-24 px-2 py-1 text-sm rounded ${isDark ? 'bg-gray-800 text-white border border-gray-600' : 'bg-white text-gray-900 border border-gray-300'}`} />
                              </td>
                              <td className={`px-3 py-3 whitespace-nowrap text-center text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {(() => { const bs = getBreakSessions(record); return bs.length === 0 ? '-' : `${bs.length}回` })()}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <input type="number" defaultValue={record.break_minutes_used || 0} id={`break_${record.id}`} min="0"
                                  className={`w-16 px-2 py-1 text-sm rounded ${isDark ? 'bg-gray-800 text-white border border-gray-600' : 'bg-white text-gray-900 border border-gray-300'}`} />
                                <span className={`ml-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>分</span>
                              </td>
                              <td className={`px-3 py-3 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>--</td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <select defaultValue={record.work_type || ''} id={`work_type_${record.id}`}
                                  className={`px-2 py-1 text-sm rounded ${isDark ? 'bg-gray-800 text-white border border-gray-600' : 'bg-white text-gray-900 border border-gray-300'}`}>
                                  <option value="">未設定</option>
                                  <option value="remote">リモート</option>
                                  <option value="office">出社</option>
                                </select>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex gap-2">
                                  <button onClick={() => {
                                    handleUpdateAttendance(record.id, {
                                      clock_in: document.getElementById(`clock_in_${record.id}`).value,
                                      clock_out: document.getElementById(`clock_out_${record.id}`).value,
                                      break_minutes_used: document.getElementById(`break_${record.id}`).value,
                                      work_type: document.getElementById(`work_type_${record.id}`).value || null
                                    })
                                  }} className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${isDark ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-green-500 text-white hover:bg-green-600'}`}>
                                    保存
                                  </button>
                                  <button onClick={() => setEditingAttendance(null)}
                                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                                    キャンセル
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className={`px-3 py-3 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{formatTimeForInput(record.clock_in) || '-'}</td>
                              <td className={`px-3 py-3 whitespace-nowrap text-sm ${!record.clock_out ? 'text-orange-500 font-medium' : isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                                {formatTimeForInput(record.clock_out) || '未退勤'}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-center">
                                {(() => {
                                  const breakSessions = getBreakSessions(record)
                                  if (breakSessions.length === 0) return <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>-</span>
                                  const isExpanded = expandedSessions.has(record.id)
                                  if (isExpanded) {
                                    return (
                                      <div className="space-y-1">
                                        <div className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                          {breakSessions.map((session, idx) => (
                                            <div key={idx} className="py-0.5">{session.start}-{session.end || '中抜け中'}</div>
                                          ))}
                                        </div>
                                        <button onClick={() => toggleSessionExpansion(record.id)}
                                          className={`text-xs underline ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}>
                                          閉じる
                                        </button>
                                      </div>
                                    )
                                  }
                                  const firstBreak = breakSessions[0]
                                  const lastBreak = breakSessions[breakSessions.length - 1]
                                  const displayText = breakSessions.length === 1
                                    ? `${firstBreak.start}-${firstBreak.end || '中抜け中'}`
                                    : `${firstBreak.start}-${firstBreak.end || '中抜け中'} ... ${lastBreak.start}-${lastBreak.end || '中抜け中'}`
                                  return (
                                    <div className="flex items-center justify-center gap-1">
                                      <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{displayText}</span>
                                      {breakSessions.length > 1 && (
                                        <button onClick={() => toggleSessionExpansion(record.id)}
                                          className={`text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>...</button>
                                      )}
                                    </div>
                                  )
                                })()}
                              </td>
                              <td className={`px-3 py-3 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{record.break_minutes_used || 0}分</td>
                              <td className={`px-3 py-3 whitespace-nowrap text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {Math.floor(record.calculatedWorkMinutes / 60)}:{String(record.calculatedWorkMinutes % 60).padStart(2, '0')}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {record.work_type === 'remote' ? (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>リモート</span>
                                ) : record.work_type === 'office' ? (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'}`}>出社</span>
                                ) : (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>未設定</span>
                                )}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex gap-2">
                                  <button onClick={() => setEditingAttendance(record.id)}
                                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${isDark ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
                                    編集
                                  </button>
                                  <button onClick={() => handleDeleteAttendance(record.id)}
                                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${isDark ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                                    削除
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          })()}
        </div>
      )}

      {/* 勤怠データ追加モーダル */}
      {showAddAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddAttendanceModal(false)} />
          <div className={`relative w-full max-w-md rounded-2xl shadow-xl ${isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>勤怠データを追加</h3>
                <button onClick={() => setShowAddAttendanceModal(false)}
                  className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  ✕
                </button>
              </div>
              <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                出勤・退勤を押し忘れた方のデータを手動で追加できます
              </p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  ユーザー <span className="text-red-500">*</span>
                </label>
                <select value={newAttendance.user_id} onChange={(e) => setNewAttendance({ ...newAttendance, user_id: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl transition-colors ${isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'} focus:outline-none focus:ring-2 focus:ring-green-500/20`}>
                  <option value="">ユーザーを選択...</option>
                  {users.map(user => (<option key={user.id} value={user.id}>{user.name} ({user.department || '部署未設定'})</option>))}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>日付 <span className="text-red-500">*</span></label>
                <input type="date" value={newAttendance.date} onChange={(e) => setNewAttendance({ ...newAttendance, date: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl transition-colors ${isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'} focus:outline-none focus:ring-2 focus:ring-green-500/20`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>出勤時刻 <span className="text-red-500">*</span></label>
                  <input type="time" value={newAttendance.clock_in} onChange={(e) => setNewAttendance({ ...newAttendance, clock_in: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl transition-colors ${isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'} focus:outline-none focus:ring-2 focus:ring-green-500/20`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>退勤時刻</label>
                  <input type="time" value={newAttendance.clock_out} onChange={(e) => setNewAttendance({ ...newAttendance, clock_out: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl transition-colors ${isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'} focus:outline-none focus:ring-2 focus:ring-green-500/20`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>休憩時間（分）</label>
                  <input type="number" min="0" value={newAttendance.break_minutes_used}
                    onChange={(e) => setNewAttendance({ ...newAttendance, break_minutes_used: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 rounded-xl transition-colors ${isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'} focus:outline-none focus:ring-2 focus:ring-green-500/20`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>勤務タイプ</label>
                  <select value={newAttendance.work_type} onChange={(e) => setNewAttendance({ ...newAttendance, work_type: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl transition-colors ${isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'} focus:outline-none focus:ring-2 focus:ring-green-500/20`}>
                    <option value="">未設定</option>
                    <option value="office">出社</option>
                    <option value="remote">リモート</option>
                  </select>
                </div>
              </div>
              {newAttendance.clock_in && newAttendance.clock_out && (
                <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                  <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>稼働時間プレビュー</div>
                  <div className={`text-lg font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    {(() => {
                      const clockIn = new Date(`2000-01-01T${newAttendance.clock_in}`)
                      const clockOut = new Date(`2000-01-01T${newAttendance.clock_out}`)
                      const totalMinutes = Math.floor((clockOut - clockIn) / 60000) - (newAttendance.break_minutes_used || 0)
                      const hours = Math.floor(totalMinutes / 60)
                      const mins = totalMinutes % 60
                      return totalMinutes > 0 ? `${hours}時間${mins}分` : '0時間'
                    })()}
                  </div>
                </div>
              )}
            </div>
            <div className={`px-6 py-4 border-t flex justify-end gap-3 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <button onClick={() => setShowAddAttendanceModal(false)}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                キャンセル
              </button>
              <button onClick={handleCreateAttendance}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${isDark ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-green-500 text-white hover:bg-green-600'}`}>
                追加する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
