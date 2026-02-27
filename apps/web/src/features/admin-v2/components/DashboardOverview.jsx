import React, { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'
import StatCard from './charts/StatCard'
import WorkHoursChart from './charts/WorkHoursChart'
import AttendanceTrendChart from './charts/AttendanceTrendChart'
import RevenueChart from './charts/RevenueChart'

export default function DashboardOverview({ isDark, selectedYear, selectedMonth, selectedDepartment, departments, onSetDepartments }) {
  const [dashboardData, setDashboardData] = useState([])
  const [importingFromSheets, setImportingFromSheets] = useState(false)
  const [todayAttendanceCount, setTodayAttendanceCount] = useState(0)
  const [totalEmployees, setTotalEmployees] = useState(0)

  useEffect(() => {
    loadDashboard()
    loadTodayStats()
  }, [selectedYear, selectedMonth])

  const loadTodayStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const [{ count: todayCount }, { count: empCount }] = await Promise.all([
        supabase.from('attendances').select('*', { count: 'exact', head: true })
          .eq('date', today).not('clock_in', 'is', null),
        supabase.from('users').select('*', { count: 'exact', head: true })
          .not('tags', 'cs', '{"deactivated"}')
      ])
      setTodayAttendanceCount(todayCount || 0)
      setTotalEmployees(empCount || 0)
    } catch (error) {
      console.error('Error loading today stats:', error)
    }
  }

  const importRevenueFromSheets = async () => {
    setImportingFromSheets(true)
    try {
      const { data, error } = await supabase.functions.invoke('import-revenue', {
        body: { year: selectedYear, month: selectedMonth }
      })
      if (error) throw error
      if (data.error) throw new Error(data.error)
      alert(`スプレッドシートからのインポートが完了しました（${data.imported}件）`)
      loadDashboard()
    } catch (error) {
      console.error('Error importing from sheets:', error)
      alert(`インポートエラー: ${error.message}`)
    } finally {
      setImportingFromSheets(false)
    }
  }

  const loadDashboard = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

      // Auto-import check
      const { data: recentRevenue } = await supabase
        .from('revenues').select('updated_at')
        .eq('year', selectedYear).eq('month', selectedMonth)
        .order('updated_at', { ascending: false }).limit(1).single()

      const shouldAutoImport = !recentRevenue || (new Date() - new Date(recentRevenue.updated_at)) > 12 * 60 * 60 * 1000
      if (shouldAutoImport && !importingFromSheets) {
        try { await supabase.functions.invoke('import-revenue', { body: { year: selectedYear, month: selectedMonth } }) } catch (e) {}
      }

      const [
        { data: attendanceData, error: attendanceError },
        { data: revenueData },
        { data: todoData }
      ] = await Promise.all([
        supabase.from('attendances').select(`*, user:users (id, name, department)`)
          .gte('date', startDate).lte('date', endDate).not('clock_in', 'is', null),
        supabase.from('revenues').select('*').eq('year', selectedYear).eq('month', selectedMonth),
        supabase.from('todo_lists').select(`*, user:users (id, name, department), todo_items (is_completed)`)
          .gte('date', startDate).lte('date', endDate)
      ])

      if (attendanceError) throw attendanceError

      const allDepartments = [...new Set(attendanceData?.map(a => a.user?.department).filter(Boolean))]
      onSetDepartments(allDepartments)

      const unitSummary = {}
      attendanceData?.forEach(record => {
        if (!record.user || !record.user.id || !record.clock_in) return
        let dept = record.user.department || '未設定'
        if (dept === 'ムードメーカー') dept = 'アドコン'
        if (!unitSummary[dept]) {
          unitSummary[dept] = {
            department: dept, memberCount: new Set(), totalMinutes: 0, totalRevenue: 0,
            todoTotal: 0, todoCompleted: 0, remoteDays: 0, officeDays: 0, totalDays: 0
          }
        }
        unitSummary[dept].memberCount.add(record.user.id)
        unitSummary[dept].totalDays++
        if (record.work_type === 'remote') unitSummary[dept].remoteDays++
        else if (record.work_type === 'office') unitSummary[dept].officeDays++
        unitSummary[dept].totalMinutes += record.total_work_minutes || 0
      })

      revenueData?.forEach(revenue => {
        let dept = revenue.department
        if (dept === 'ムードメーカー') dept = 'アドコン'
        if (unitSummary[dept]) unitSummary[dept].totalRevenue += parseFloat(revenue.gross_profit) || 0
      })

      todoData?.forEach(list => {
        let dept = list.user.department || '未設定'
        if (dept === 'ムードメーカー') dept = 'アドコン'
        if (unitSummary[dept]) {
          const items = list.todo_items || []
          unitSummary[dept].todoTotal += items.length
          unitSummary[dept].todoCompleted += items.filter(item => item.is_completed).length
        }
      })

      const dashboardArray = Object.values(unitSummary).map(unit => ({
        department: unit.department,
        memberCount: unit.memberCount.size,
        totalHours: Math.floor(unit.totalMinutes / 60),
        totalMinutes: unit.totalMinutes % 60,
        totalMinutesRaw: unit.totalMinutes,
        totalRevenue: unit.totalRevenue,
        profitPerHour: unit.totalMinutes > 0 ? unit.totalRevenue / (unit.totalMinutes / 60) : 0,
        todoRate: unit.todoTotal > 0 ? Math.round((unit.todoCompleted / unit.todoTotal) * 100) : 0,
        remoteDays: unit.remoteDays, officeDays: unit.officeDays, totalDays: unit.totalDays,
        remoteRate: unit.totalDays > 0 ? Math.round((unit.remoteDays / unit.totalDays) * 100) : 0
      }))

      setDashboardData(dashboardArray)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    }
  }

  const handleUpdateRevenue = async (department, year, month, value) => {
    try {
      const numValue = parseFloat(value) || 0
      const { data: existing } = await supabase.from('revenues').select('id')
        .eq('department', department).eq('year', year).eq('month', month).single()
      if (existing) {
        const { error } = await supabase.from('revenues').update({ gross_profit: numValue }).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('revenues').insert({ department, year, month, gross_profit: numValue })
        if (error) throw error
      }
      loadDashboard()
    } catch (error) {
      console.error('Error updating revenue:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const filteredData = dashboardData.filter(unit => selectedDepartment === 'all' || unit.department === selectedDepartment)

  // KPI calculations
  const totalWorkHours = filteredData.reduce((sum, u) => sum + u.totalHours + u.totalMinutes / 60, 0)
  const totalMembers = filteredData.reduce((sum, u) => sum + u.memberCount, 0)
  const avgHoursPerPerson = totalMembers > 0 ? (totalWorkHours / totalMembers).toFixed(1) : 0
  const totalRevenue = filteredData.reduce((sum, u) => sum + u.totalRevenue, 0)
  const profitPerHour = totalWorkHours > 0 ? Math.round(totalRevenue / totalWorkHours) : 0

  // Chart data
  const workHoursChartData = filteredData.map(d => ({ department: d.department, hours: d.totalHours + d.totalMinutes / 60 }))
  const revenueChartData = filteredData.map(d => ({ department: d.department, revenue: d.totalRevenue }))

  return (
    <div className="space-y-6">
      {/* Import button */}
      <button onClick={importRevenueFromSheets} disabled={importingFromSheets}
        className={`w-full md:w-auto px-4 py-2 text-sm md:text-base rounded-xl transition-colors ${
          isDark ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}>
        {importingFromSheets ? 'インポート中...' : 'シートから粗利をインポート'}
      </button>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard isDark={isDark} icon="👥" label="今日の出勤者" value={`${todayAttendanceCount}/${totalEmployees}`} subValue="名" />
        <StatCard isDark={isDark} icon="⏱" label="今月の総稼働時間" value={`${Math.round(totalWorkHours)}`} subValue="時間" />
        <StatCard isDark={isDark} icon="📊" label="平均稼働時間/人" value={`${avgHoursPerPerson}`} subValue="時間" />
        <StatCard isDark={isDark} icon="💹" label="時間採算" value={profitPerHour > 0 ? `¥${profitPerHour.toLocaleString()}` : '-'} subValue="/h" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`rounded-2xl border p-4 ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
          <h3 className={`text-sm font-medium mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>部署別稼働時間</h3>
          <WorkHoursChart data={workHoursChartData} isDark={isDark} />
        </div>
        <div className={`rounded-2xl border p-4 ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
          <h3 className={`text-sm font-medium mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>部署別売上</h3>
          <RevenueChart data={revenueChartData} isDark={isDark} />
        </div>
      </div>

      {/* Unit detail table */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm md:text-base">
            <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
              <tr>
                {['ユニット', 'メンバー', '稼働時間', '合計粗利', '時間採算', 'TODO'].map(h => (
                  <th key={h} className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
              {filteredData.map((unit, index) => (
                <tr key={index} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                  <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{unit.department}</td>
                  <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{unit.memberCount}</td>
                  <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                    {unit.totalHours}:{String(unit.totalMinutes).padStart(2, '0')}
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 md:gap-2">
                      <span className={`text-xs md:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>¥</span>
                      <input type="number" value={unit.totalRevenue}
                        onChange={(e) => handleUpdateRevenue(unit.department, selectedYear, selectedMonth, e.target.value)}
                        className={`w-20 md:w-32 px-1 md:px-2 py-1 text-xs md:text-sm rounded font-medium ${
                          isDark ? 'bg-gray-800 text-green-400 border border-gray-700' : 'bg-white text-green-600 border border-gray-300'
                        } focus:outline-none focus:ring-1 md:focus:ring-2 focus:ring-green-500`} />
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                    <span className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-bold ${
                      unit.profitPerHour >= 5000 ? 'bg-green-100 text-green-800' :
                      unit.profitPerHour >= 3000 ? 'bg-yellow-100 text-yellow-800' :
                      unit.profitPerHour > 0 ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {unit.profitPerHour > 0 ? `¥${Math.round(unit.profitPerHour).toLocaleString()}/h` : '-'}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                    <span className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs font-bold ${
                      unit.todoRate === 100 ? 'bg-green-100 text-green-800' :
                      unit.todoRate >= 80 ? 'bg-yellow-100 text-yellow-800' :
                      unit.todoRate >= 50 ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {unit.todoRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dashboardData.length === 0 && (
            <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}><p>データがありません</p></div>
          )}
        </div>
      </div>
    </div>
  )
}
