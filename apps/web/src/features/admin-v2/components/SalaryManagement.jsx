import React, { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'

export default function SalaryManagement({ isDark, users, selectedYear, selectedMonth }) {
  const [salaries, setSalaries] = useState([])

  useEffect(() => {
    loadSalaries()
  }, [selectedYear, selectedMonth])

  const loadSalaries = async () => {
    try {
      const { data, error } = await supabase
        .from('salaries')
        .select(`*, user:users (id, name, department)`)
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

  const handleCreateSalary = async (userId) => {
    try {
      const { data: existing } = await supabase
        .from('salaries').select('id')
        .eq('user_id', userId).eq('year', selectedYear).eq('month', selectedMonth).single()
      if (existing) { alert('このユーザーの給料レコードは既に存在します'); return }

      const { error } = await supabase.from('salaries').insert({
        user_id: userId, year: selectedYear, month: selectedMonth,
        base_salary: 0, overtime_pay: 0, bonuses: 0, deductions: 0, total_salary: 0, payment_status: 'pending'
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
      const salary = salaries.find(s => s.id === salaryId)
      if (salary) {
        const baseSalary = field === 'base_salary' ? numValue : salary.base_salary
        const overtimePay = field === 'overtime_pay' ? numValue : salary.overtime_pay
        const bonuses = field === 'bonuses' ? numValue : salary.bonuses
        const deductions = field === 'deductions' ? numValue : salary.deductions
        updates.total_salary = baseSalary + overtimePay + bonuses - deductions
      }
      const { error } = await supabase.from('salaries').update(updates).eq('id', salaryId)
      if (error) throw error
      loadSalaries()
    } catch (error) {
      console.error('Error updating salary:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const handleUpdatePaymentStatus = async (salaryId, status) => {
    try {
      const { error } = await supabase.from('salaries').update({ payment_status: status }).eq('id', salaryId)
      if (error) throw error
      loadSalaries()
    } catch (error) {
      console.error('Error updating payment status:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* 給料レコード作成ボタン */}
      <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>給料レコード作成</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {selectedYear}年{selectedMonth}月の給料レコードを作成
            </div>
          </div>
          <button
            onClick={() => {
              const userId = prompt('ユーザーIDを入力してください（全員作成する場合は空欄）')
              if (userId === null) return
              if (userId === '') { users.forEach(user => handleCreateSalary(user.id)) }
              else { handleCreateSalary(userId) }
            }}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            + 作成
          </button>
        </div>
      </div>

      {/* 給料一覧 */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
              <tr>
                {['社員', '基本給', '残業代', '手当', '控除', '総支給額', '支払状況'].map(h => (
                  <th key={h} className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
              {salaries.map((salary) => (
                <tr key={salary.id} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                    <div className="font-medium">{salary.user.name}</div>
                  </td>
                  {['base_salary', 'overtime_pay', 'bonuses', 'deductions'].map(field => (
                    <td key={field} className="px-6 py-4 whitespace-nowrap">
                      <input type="number" value={salary[field]}
                        onChange={(e) => handleUpdateSalary(salary.id, field, e.target.value)}
                        className={`w-24 px-2 py-1 text-sm rounded ${isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'}`} />
                    </td>
                  ))}
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ¥{salary.total_salary.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleUpdatePaymentStatus(salary.id, salary.payment_status === 'paid' ? 'pending' : 'paid')}
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
  )
}
