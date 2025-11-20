import React, { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

export default function AdminPage({ isDark }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard') // dashboard, attendance, salary, users, todo_achievement
  const [users, setUsers] = useState([])
  const [attendances, setAttendances] = useState([])
  const [salaries, setSalaries] = useState([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [dashboardData, setDashboardData] = useState([])
  const [todoAchievementData, setTodoAchievementData] = useState([])
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState('all') // ユニットフィルター
  const [importingFromSheets, setImportingFromSheets] = useState(false)

  useEffect(() => {
    loadCurrentUser()
  }, [])

  // ユーザー一覧は初回のみ読み込み
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadUsers()
    }
  }, [currentUser])

  // タブやyear/month変更時にデータ読み込み
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      if (activeTab === 'dashboard') {
        loadDashboard()
      } else if (activeTab === 'attendance') {
        loadAttendances()
      } else if (activeTab === 'salary') {
        loadSalaries()
      } else if (activeTab === 'todo_achievement') {
        loadTodoAchievement()
      }
    }
  }, [currentUser, activeTab, selectedYear, selectedMonth])

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()
        setCurrentUser(data)
        
        // 管理者でない場合はアクセス拒否
        if (data?.role !== 'admin') {
          alert('管理者権限が必要です')
        }
      }
    } catch (error) {
      console.error('Error loading current user:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const importRevenueFromSheets = async () => {
    setImportingFromSheets(true)
    try {
      const { data, error } = await supabase.functions.invoke('import-revenue', {
        body: {
          year: selectedYear,
          month: selectedMonth
        }
      })

      if (error) throw error

      if (data.error) {
        throw new Error(data.error)
      }

      alert(`スプレッドシートからのインポートが完了しました（${data.imported}件）`)
      loadDashboard() // ダッシュボードを再読み込み
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

      // 粗利データが最新かチェック（最終更新から12時間以上経過していたら自動インポート）
      const { data: recentRevenue } = await supabase
        .from('revenues')
        .select('updated_at')
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      const shouldAutoImport = !recentRevenue ||
        (new Date() - new Date(recentRevenue.updated_at)) > 12 * 60 * 60 * 1000

      if (shouldAutoImport && !importingFromSheets) {
        console.log('Auto-importing revenue data...')
        // 自動インポート（エラーは無視）
        try {
          await supabase.functions.invoke('import-revenue', {
            body: { year: selectedYear, month: selectedMonth }
          })
        } catch (e) {
          console.log('Auto-import failed, using existing data:', e)
        }
      }

      // 3つのクエリを並列実行
      const [
        { data: attendanceData },
        { data: revenueData, error: revenueError },
        { data: todoData }
      ] = await Promise.all([
        // 勤怠データ取得
        supabase
          .from('attendances')
          .select(`
            *,
            user:users (
              id,
              name,
              department
            )
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .eq('status', 'completed'),

        // 粗利データ取得
        supabase
          .from('revenues')
          .select('*')
          .eq('year', selectedYear)
          .eq('month', selectedMonth),

        // TODOデータ取得
        supabase
          .from('todo_lists')
          .select(`
            *,
            user:users (
              id,
              name,
              department
            ),
            todo_items (
              is_completed
            )
          `)
          .gte('date', startDate)
          .lte('date', endDate)
      ])

      // ユニーク部署リストを取得
      const allDepartments = [...new Set(attendanceData?.map(a => a.user.department).filter(Boolean))]
      setDepartments(allDepartments)

      // ユニット（部署）ごとに集計
      const unitSummary = {}

      attendanceData?.forEach(record => {
        let dept = record.user.department || '未設定'
        
        // アドコンとムードメーカーを統合
        if (dept === 'ムードメーカー') {
          dept = 'アドコン'
        }
        if (!unitSummary[dept]) {
          unitSummary[dept] = {
            department: dept,
            memberCount: new Set(),
            totalMinutes: 0,
            totalRevenue: 0,
            todoTotal: 0,
            todoCompleted: 0
          }
        }

        unitSummary[dept].memberCount.add(record.user.id)
        unitSummary[dept].totalMinutes += record.total_work_minutes || 0
      })

      // 粗利を集計
      revenueData?.forEach(revenue => {
        let dept = revenue.department

        // アドコンとムードメーカーを統合
        if (dept === 'ムードメーカー') {
          dept = 'アドコン'
        }
        if (unitSummary[dept]) {
          unitSummary[dept].totalRevenue += parseFloat(revenue.gross_profit) || 0
        }
      })

      // TODOを集計
      todoData?.forEach(list => {
        let dept = list.user.department || '未設定'
        
        // アドコンとムードメーカーを統合
        if (dept === 'ムードメーカー') {
          dept = 'アドコン'
        }
        if (unitSummary[dept]) {
          const items = list.todo_items || []
          unitSummary[dept].todoTotal += items.length
          unitSummary[dept].todoCompleted += items.filter(item => item.is_completed).length
        }
      })

      // 時間あたり採算を計算
      const dashboardArray = Object.values(unitSummary).map(unit => ({
        department: unit.department,
        memberCount: unit.memberCount.size,
        totalHours: Math.floor(unit.totalMinutes / 60),
        totalMinutes: unit.totalMinutes % 60,
        totalRevenue: unit.totalRevenue,
        profitPerHour: unit.totalMinutes > 0 ? unit.totalRevenue / (unit.totalMinutes / 60) : 0,
        todoRate: unit.todoTotal > 0 ? Math.round((unit.todoCompleted / unit.todoTotal) * 100) : 0
      }))

      setDashboardData(dashboardArray)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    }
  }

  const loadAttendances = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

      const [
        { data: attendanceData },
        { data: todoData }
      ] = await Promise.all([
        supabase
          .from('attendances')
          .select(`
            *,
            user:users (
              id,
              name,
              department
            )
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .eq('status', 'completed'),

        supabase
          .from('todo_lists')
          .select(`
            *,
            todo_items (
              is_completed
            )
          `)
          .gte('date', startDate)
          .lte('date', endDate)
      ])

      // ユーザーごとに集計
      const userStats = {}

      attendanceData?.forEach(record => {
        const userId = record.user.id
        if (!userStats[userId]) {
          userStats[userId] = {
            name: record.user.name,
            department: record.user.department,
            attendanceDays: 0,
            totalWorkMinutes: 0,
            todoTotal: 0,
            todoCompleted: 0
          }
        }

        userStats[userId].attendanceDays++
        userStats[userId].totalWorkMinutes += record.total_work_minutes || 0
      })

      // TODO達成率を集計
      todoData?.forEach(list => {
        const userId = list.user_id
        if (userStats[userId]) {
          const items = list.todo_items || []
          userStats[userId].todoTotal += items.length
          userStats[userId].todoCompleted += items.filter(item => item.is_completed).length
        }
      })

      // 平均勤務時間とTODO達成率を計算
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

  const loadSalaries = async () => {
    try {
      const { data, error } = await supabase
        .from('salaries')
        .select(`
          *,
          user:users (
            id,
            name,
            department
          )
        `)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSalaries(data || [])
    } catch (error) {
      console.error('Error loading salaries:', error)
      setSalaries([])
    }
  }

  const loadTodoAchievement = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('todo_lists')
        .select(`
          *,
          user:users (
            id,
            name
          ),
          todo_items (
            is_completed
          )
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

      if (error) throw error

      const achievementData = data?.map(list => {
        const items = list.todo_items || []
        const totalTasks = items.length
        const completedTasks = items.filter(item => item.is_completed).length
        const achievementRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

        return {
          date: list.date,
          userName: list.user.name,
          totalTasks,
          completedTasks,
          achievementRate
        }
      }) || []

      setTodoAchievementData(achievementData)
    } catch (error) {
      console.error('Error loading todo achievement:', error)
    }
  }

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      // ユーザー一覧を再読み込み
      loadUsers()
      alert('権限を更新しました')
    } catch (error) {
      console.error('Error updating user role:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const handleCreateSalary = async (userId) => {
    try {
      // 既存のレコードをチェック
      const { data: existing } = await supabase
        .from('salaries')
        .select('id')
        .eq('user_id', userId)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .single()

      if (existing) {
        alert('このユーザーの給料レコードは既に存在します')
        return
      }

      const { error } = await supabase
        .from('salaries')
        .insert({
          user_id: userId,
          year: selectedYear,
          month: selectedMonth,
          base_salary: 0,
          overtime_pay: 0,
          bonuses: 0,
          deductions: 0,
          total_salary: 0,
          payment_status: 'pending'
        })

      if (error) throw error

      loadSalaries()
    } catch (error) {
      console.error('Error creating salary:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const handleUpdateSalary = async (salaryId, field, value) => {
    try {
      const numValue = parseFloat(value) || 0
      const updates = { [field]: numValue }

      // total_salaryを計算
      const salary = salaries.find(s => s.id === salaryId)
      if (salary) {
        const baseSalary = field === 'base_salary' ? numValue : salary.base_salary
        const overtimePay = field === 'overtime_pay' ? numValue : salary.overtime_pay
        const bonuses = field === 'bonuses' ? numValue : salary.bonuses
        const deductions = field === 'deductions' ? numValue : salary.deductions
        updates.total_salary = baseSalary + overtimePay + bonuses - deductions
      }

      const { error } = await supabase
        .from('salaries')
        .update(updates)
        .eq('id', salaryId)

      if (error) throw error

      loadSalaries()
    } catch (error) {
      console.error('Error updating salary:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const handleUpdatePaymentStatus = async (salaryId, status) => {
    try {
      const { error } = await supabase
        .from('salaries')
        .update({ payment_status: status })
        .eq('id', salaryId)

      if (error) throw error

      loadSalaries()
    } catch (error) {
      console.error('Error updating payment status:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const handleUpdateRevenue = async (department, year, month, value) => {
    try {
      const numValue = parseFloat(value) || 0

      // 既存のレコードをチェック
      const { data: existing } = await supabase
        .from('revenues')
        .select('id')
        .eq('department', department)
        .eq('year', year)
        .eq('month', month)
        .single()

      if (existing) {
        // 更新
        const { error } = await supabase
          .from('revenues')
          .update({ gross_profit: numValue })
          .eq('id', existing.id)

        if (error) throw error
      } else {
        // 新規作成
        const { error } = await supabase
          .from('revenues')
          .insert({
            department,
            year,
            month,
            gross_profit: numValue
          })

        if (error) throw error
      }

      loadDashboard()
    } catch (error) {
      console.error('Error updating revenue:', error)
      alert(`エラー: ${error.message}`)
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          読み込み中...
        </div>
      </div>
    )
  }

  // 管理者権限チェック
  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            アクセスが拒否されました
          </div>
          <div className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            このページは管理者のみアクセス可能です
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto pb-20">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          管理者ダッシュボード
        </h1>
        <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          給料管理と出勤管理
        </p>
      </div>

      {/* タブ */}
      <div className={`mb-6 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { value: 'dashboard', label: 'ダッシュボード', icon: '📈', shortLabel: 'ダッシュボード' },
            { value: 'attendance', label: '出勤管理', icon: '📊', shortLabel: '出勤' },
            { value: 'salary', label: '給料管理', icon: '💰', shortLabel: '給料' },
            { value: 'todo_achievement', label: 'TODO', icon: '✅', shortLabel: 'TODO' },
            { value: 'users', label: 'ユーザー', icon: '👥', shortLabel: 'ユーザー' }
          ].map(({ value, label, icon, shortLabel }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-3 font-medium transition-all duration-200 relative whitespace-nowrap text-sm md:text-base ${
                activeTab === value
                  ? isDark
                    ? 'text-white'
                    : 'text-gray-900'
                  : isDark
                  ? 'text-gray-500 hover:text-gray-300'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="text-base md:text-lg">{icon}</span>
              <span className="hidden md:inline">{label}</span>
              <span className="md:hidden">{shortLabel}</span>
              {activeTab === value && (
                <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-full ${
                  isDark ? 'bg-white' : 'bg-gray-900'
                }`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 年月選択とユニット選択 */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className={`px-3 py-2 text-sm md:text-base rounded-xl transition-colors flex-1 min-w-[100px] ${
              isDark
                ? 'bg-gray-800 text-white border border-gray-700'
                : 'bg-white text-gray-900 border border-gray-300'
            } focus:outline-none`}
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
              <option key={year} value={year}>{year}年</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className={`px-3 py-2 text-sm md:text-base rounded-xl transition-colors flex-1 min-w-[80px] ${
              isDark
                ? 'bg-gray-800 text-white border border-gray-700'
                : 'bg-white text-gray-900 border border-gray-300'
            } focus:outline-none`}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
              <option key={month} value={month}>{month}月</option>
            ))}
          </select>
          {(activeTab === 'dashboard' || activeTab === 'attendance') && (
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className={`px-3 py-2 text-sm md:text-base rounded-xl transition-colors flex-1 min-w-[120px] ${
                isDark
                  ? 'bg-gray-800 text-white border border-gray-700'
                  : 'bg-white text-gray-900 border border-gray-300'
              } focus:outline-none`}
            >
              <option value="all">全ユニット</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          )}
        </div>
        {activeTab === 'dashboard' && (
          <button
            onClick={importRevenueFromSheets}
            disabled={importingFromSheets}
            className={`w-full md:w-auto px-4 py-2 text-sm md:text-base rounded-xl transition-colors ${
              isDark
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {importingFromSheets ? '📥 インポート中...' : '📊 シートから粗利をインポート'}
          </button>
        )}
      </div>

      {/* コンテンツ */}
      {activeTab === 'attendance' && (
        <div className={`rounded-2xl border overflow-hidden ${
          isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm md:text-base">
              <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    名前
                  </th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    ユニット
                  </th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    出勤
                  </th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    合計
                  </th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    平均
                  </th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    TODO
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
                {attendances
                  .filter(user => selectedDepartment === 'all' || user.department === selectedDepartment)
                  .map((user, index) => (
                  <tr key={index} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {user.name}
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {user.department}
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {user.attendanceDays}
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

      {activeTab === 'salary' && (
        <div className="space-y-6">
          {/* 給料レコード作成ボタン */}
          <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  給料レコード作成
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {selectedYear}年{selectedMonth}月の給料レコードを作成
                </div>
              </div>
              <button
                onClick={() => {
                  const userId = prompt('ユーザーIDを入力してください（全員作成する場合は空欄）')
                  if (userId === null) return
                  if (userId === '') {
                    users.forEach(user => handleCreateSalary(user.id))
                  } else {
                    handleCreateSalary(userId)
                  }
                }}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  isDark
                    ? 'bg-white text-gray-900 hover:bg-gray-100'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                + 作成
              </button>
            </div>
          </div>

          {/* 給料一覧 */}
          <div className={`rounded-2xl border overflow-hidden ${
            isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      社員
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      基本給
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      残業代
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      手当
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      控除
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      総支給額
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      支払状況
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
                  {salaries.map((salary) => (
                    <tr key={salary.id} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                        <div className="font-medium">{salary.user.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={salary.base_salary}
                          onChange={(e) => handleUpdateSalary(salary.id, 'base_salary', e.target.value)}
                          className={`w-24 px-2 py-1 text-sm rounded ${
                            isDark
                              ? 'bg-gray-800 text-white border border-gray-700'
                              : 'bg-white text-gray-900 border border-gray-300'
                          }`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={salary.overtime_pay}
                          onChange={(e) => handleUpdateSalary(salary.id, 'overtime_pay', e.target.value)}
                          className={`w-24 px-2 py-1 text-sm rounded ${
                            isDark
                              ? 'bg-gray-800 text-white border border-gray-700'
                              : 'bg-white text-gray-900 border border-gray-300'
                          }`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={salary.bonuses}
                          onChange={(e) => handleUpdateSalary(salary.id, 'bonuses', e.target.value)}
                          className={`w-24 px-2 py-1 text-sm rounded ${
                            isDark
                              ? 'bg-gray-800 text-white border border-gray-700'
                              : 'bg-white text-gray-900 border border-gray-300'
                          }`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={salary.deductions}
                          onChange={(e) => handleUpdateSalary(salary.id, 'deductions', e.target.value)}
                          className={`w-24 px-2 py-1 text-sm rounded ${
                            isDark
                              ? 'bg-gray-800 text-white border border-gray-700'
                              : 'bg-white text-gray-900 border border-gray-300'
                          }`}
                        />
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        ¥{salary.total_salary.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleUpdatePaymentStatus(
                            salary.id,
                            salary.payment_status === 'paid' ? 'pending' : 'paid'
                          )}
                          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                            salary.payment_status === 'paid'
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                          }`}
                        >
                          {salary.payment_status === 'paid' ? '支払済' : '未払い'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {salaries.length === 0 && (
                <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <p>給料データがありません</p>
                  <p className="text-sm mt-2">上の「+ 作成」ボタンから給料レコードを作成してください</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className={`rounded-2xl border overflow-hidden ${
          isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm md:text-base">
              <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>ユニット</th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>メンバー</th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>稼働時間</th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>合計粗利</th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>時間採算</th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>TODO</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
                {dashboardData
                  .filter(unit => selectedDepartment === 'all' || unit.department === selectedDepartment)
                  .map((unit, index) => (
                  <tr key={index} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {unit.department}
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {unit.memberCount}
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {unit.totalHours}:{String(unit.totalMinutes).padStart(2, '0')}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 md:gap-2">
                        <span className={`text-xs md:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>¥</span>
                        <input
                          type="number"
                          value={unit.totalRevenue}
                          onChange={(e) => handleUpdateRevenue(unit.department, selectedYear, selectedMonth, e.target.value)}
                          className={`w-20 md:w-32 px-1 md:px-2 py-1 text-xs md:text-sm rounded font-medium ${
                            isDark
                              ? 'bg-gray-800 text-green-400 border border-gray-700'
                              : 'bg-white text-green-600 border border-gray-300'
                          } focus:outline-none focus:ring-1 md:focus:ring-2 focus:ring-green-500`}
                        />
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
              <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <p>データがありません</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'todo_achievement' && (
        <div className={`rounded-2xl border overflow-hidden ${
          isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>日付</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>名前</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>タスク総数</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>完了数</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>達成率</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>ステータス</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
                {todoAchievementData.map((data, index) => (
                  <tr key={index} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {new Date(data.date).toLocaleDateString('ja-JP')}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{data.userName}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{data.totalTasks}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{data.completedTasks}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        data.achievementRate === 100 ? 'bg-green-100 text-green-800' :
                        data.achievementRate >= 80 ? 'bg-yellow-100 text-yellow-800' :
                        data.achievementRate >= 50 ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {data.achievementRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xl">
                      {data.achievementRate >= 80 ? '🎉' : data.achievementRate >= 50 ? '👍' : '📝'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {todoAchievementData.length === 0 && (
              <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <p>データがありません</p>
              </div>
            )}
          </div>
        </div>
      )}


      {activeTab === 'users' && (
        <div className={`rounded-2xl border overflow-hidden ${
          isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    社員情報
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    メールアドレス
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    部署
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    権限
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    登録日
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
                {users.map((user) => (
                  <tr key={user.id} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      <div className="font-medium">{user.name}</div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {user.email}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {user.department || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => {
                          if (window.confirm(`${user.name}さんを${user.role === 'admin' ? '一般ユーザー' : '管理者'}に変更しますか？`)) {
                            handleUpdateUserRole(user.id, user.role === 'admin' ? 'user' : 'admin')
                          }
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {user.role === 'admin' ? '🛡️ 管理者' : '👤 一般'}
                      </button>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {new Date(user.created_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => {
                          if (window.confirm(`${user.name}さんを${user.role === 'admin' ? '一般ユーザー' : '管理者'}に変更しますか？`)) {
                            handleUpdateUserRole(user.id, user.role === 'admin' ? 'user' : 'admin')
                          }
                        }}
                        className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                          isDark
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {user.role === 'admin' ? '👤 一般に変更' : '🛡️ 管理者に変更'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <p>ユーザーデータがありません</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
