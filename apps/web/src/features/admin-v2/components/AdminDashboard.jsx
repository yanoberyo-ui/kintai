import React, { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'
import DashboardOverview from './DashboardOverview'
import AttendanceManagement from './AttendanceManagement'
import SalaryManagement from './SalaryManagement'
import UserManagement from './UserManagement'
import TodoAchievement from './TodoAchievement'
import ActivityTracker from './ActivityTracker'
import ExpenseManagement from './ExpenseManagement'
import AdminChat from './AdminChat'
import ContractManagement from '../../contracts/components/ContractManagement'

const TABS = [
  { value: 'dashboard', label: '概要', icon: '📈', shortLabel: '概要' },
  { value: 'attendance', label: '出勤管理', icon: '📊', shortLabel: '出勤' },
  { value: 'salary', label: '給料管理', icon: '💰', shortLabel: '給料' },
  { value: 'users', label: 'ユーザー', icon: '👥', shortLabel: 'ユーザー' },
  { value: 'todo_achievement', label: 'TODO', icon: '✅', shortLabel: 'TODO' },
  { value: 'activity', label: 'アクティビティ', icon: '📡', shortLabel: '状況' },
  { value: 'expenses', label: '経費管理', icon: '🧾', shortLabel: '経費' },
  { value: 'chat', label: 'チャット', icon: '💬', shortLabel: 'チャット' },
  { value: 'contracts', label: '契約管理', icon: '📝', shortLabel: '契約' },
]

export default function AdminDashboard({ isDark, user }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [users, setUsers] = useState([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState('all')

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadUsers()
    }
  }, [currentUser])

  const loadCurrentUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single()
        setCurrentUser(data)
        if (data?.role !== 'admin') alert('管理者権限が必要です')
      }
    } catch (error) {
      console.error('Error loading current user:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: true })
      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>読み込み中...</div>
      </div>
    )
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>アクセスが拒否されました</div>
          <div className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>このページは管理者のみアクセス可能です</div>
        </div>
      </div>
    )
  }

  const showYearMonth = ['dashboard', 'attendance', 'salary', 'todo_achievement'].includes(activeTab)
  const showDepartmentFilter = ['dashboard', 'attendance'].includes(activeTab)

  return (
    <div className="max-w-7xl mx-auto pb-20 h-[calc(100dvh-14rem)] md:h-[calc(100dvh-8rem)] overflow-y-auto">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>管理者ダッシュボード</h1>
        <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>総合管理画面</p>
      </div>

      {/* タブ */}
      <div className={`mb-6 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {TABS.map(({ value, label, icon, shortLabel }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-3 font-medium transition-all duration-200 relative whitespace-nowrap text-sm md:text-base ${
                activeTab === value
                  ? isDark ? 'text-white' : 'text-gray-900'
                  : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="text-base md:text-lg">{icon}</span>
              <span className="hidden md:inline">{label}</span>
              <span className="md:hidden">{shortLabel}</span>
              {activeTab === value && (
                <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-gray-900'}`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 年月選択 */}
      {showYearMonth && (
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className={`px-3 py-2 text-sm md:text-base rounded-xl transition-colors flex-1 min-w-[100px] ${
                isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'
              } focus:outline-none`}>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}年</option>
              ))}
            </select>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className={`px-3 py-2 text-sm md:text-base rounded-xl transition-colors flex-1 min-w-[80px] ${
                isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'
              } focus:outline-none`}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>{month}月</option>
              ))}
            </select>
            {showDepartmentFilter && (
              <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)}
                className={`px-3 py-2 text-sm md:text-base rounded-xl transition-colors flex-1 min-w-[120px] ${
                  isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'
                } focus:outline-none`}>
                <option value="all">全ユニット</option>
                {departments.map(dept => (<option key={dept} value={dept}>{dept}</option>))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* コンテンツ */}
      {activeTab === 'dashboard' && (
        <DashboardOverview
          isDark={isDark}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedDepartment={selectedDepartment}
          departments={departments}
          onSetDepartments={setDepartments}
        />
      )}
      {activeTab === 'attendance' && (
        <AttendanceManagement
          isDark={isDark}
          users={users}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedDepartment={selectedDepartment}
          departments={departments}
        />
      )}
      {activeTab === 'salary' && (
        <SalaryManagement
          isDark={isDark}
          users={users}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
        />
      )}
      {activeTab === 'users' && (
        <UserManagement
          isDark={isDark}
          users={users}
          onReloadUsers={loadUsers}
        />
      )}
      {activeTab === 'todo_achievement' && (
        <TodoAchievement
          isDark={isDark}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
        />
      )}
      {activeTab === 'activity' && (
        <ActivityTracker isDark={isDark} />
      )}
      {activeTab === 'expenses' && (
        <ExpenseManagement isDark={isDark} />
      )}
      {activeTab === 'chat' && (
        <AdminChat isDark={isDark} user={currentUser} />
      )}
      {activeTab === 'contracts' && (
        <ContractManagement isDark={isDark} users={users} />
      )}
    </div>
  )
}
