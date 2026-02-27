import React, { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'

export default function TodoAchievement({ isDark, selectedYear, selectedMonth }) {
  const [todoAchievementData, setTodoAchievementData] = useState([])

  useEffect(() => {
    loadTodoAchievement()
  }, [selectedYear, selectedMonth])

  const loadTodoAchievement = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('todo_lists')
        .select(`*, user:users (id, name), todo_items (is_completed)`)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

      if (error) throw error

      const achievementData = data?.map(list => {
        const items = list.todo_items || []
        const totalTasks = items.length
        const completedTasks = items.filter(item => item.is_completed).length
        const achievementRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
        return { date: list.date, userName: list.user.name, totalTasks, completedTasks, achievementRate }
      }) || []

      setTodoAchievementData(achievementData)
    } catch (error) {
      console.error('Error loading todo achievement:', error)
    }
  }

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
            <tr>
              {['日付', '名前', 'タスク総数', '完了数', '達成率', 'ステータス'].map(h => (
                <th key={h} className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
              ))}
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
          <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}><p>データがありません</p></div>
        )}
      </div>
    </div>
  )
}
