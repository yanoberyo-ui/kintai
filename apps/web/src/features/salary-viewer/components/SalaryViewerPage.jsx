import { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'
import { GlassCard, PageHeader } from '../../../components/ui'
import SalaryDetailCard from './SalaryDetailCard'

export default function SalaryViewerPage({ isDark, user }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [salary, setSalary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSalary()
  }, [user, selectedYear, selectedMonth])

  const loadSalary = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('salaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setSalary(data || null)
    } catch (error) {
      console.error('Error loading salary:', error)
      setSalary(null)
    } finally {
      setLoading(false)
    }
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <PageHeader
        title="💰 給与明細"
        isDark={isDark}
      />

      {/* Month / Year selector */}
      <GlassCard isDark={isDark}>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className={`flex-1 px-4 py-2.5 rounded-xl border transition-colors outline-none appearance-none ${
              isDark
                ? 'bg-gray-800/50 border-gray-700 text-white'
                : 'bg-gray-50/50 border-gray-200 text-gray-900'
            }`}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className={`flex-1 px-4 py-2.5 rounded-xl border transition-colors outline-none appearance-none ${
              isDark
                ? 'bg-gray-800/50 border-gray-700 text-white'
                : 'bg-gray-50/50 border-gray-200 text-gray-900'
            }`}
          >
            {months.map((m) => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </div>
      </GlassCard>

      {/* Content */}
      {loading ? (
        <GlassCard isDark={isDark}>
          <div className="flex items-center justify-center py-12">
            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${
              isDark ? 'border-white' : 'border-gray-900'
            }`} />
          </div>
        </GlassCard>
      ) : salary ? (
        <SalaryDetailCard salary={salary} isDark={isDark} />
      ) : (
        <GlassCard isDark={isDark}>
          <div className="text-center py-12">
            <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              この月の給与データはまだありません
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
