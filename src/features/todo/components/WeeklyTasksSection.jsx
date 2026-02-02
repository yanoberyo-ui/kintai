import { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'

export default function WeeklyTasksSection({ user, isDark }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDeadline, setNewTaskDeadline] = useState('')
  const [saving, setSaving] = useState(false)

  // タスク読み込み
  const loadTasks = async () => {
    if (!user?.id) return
    
    try {
      const { data, error } = await supabase
        .from('weekly_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('deadline', { ascending: true })

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error('Error loading weekly tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [user?.id])

  // タスク追加
  const handleAddTask = async (e) => {
    e.preventDefault()
    if (!newTaskTitle.trim() || !newTaskDeadline || !user?.id) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('weekly_tasks')
        .insert({
          user_id: user.id,
          title: newTaskTitle.trim(),
          deadline: newTaskDeadline,
          completed: false
        })

      if (error) throw error

      setNewTaskTitle('')
      setNewTaskDeadline('')
      setShowAddForm(false)
      await loadTasks()
    } catch (error) {
      console.error('Error adding weekly task:', error)
    } finally {
      setSaving(false)
    }
  }

  // タスク完了切り替え
  const handleToggleComplete = async (taskId, currentCompleted) => {
    try {
      const { error } = await supabase
        .from('weekly_tasks')
        .update({ completed: !currentCompleted, updated_at: new Date().toISOString() })
        .eq('id', taskId)

      if (error) throw error
      await loadTasks()
    } catch (error) {
      console.error('Error toggling task:', error)
    }
  }

  // タスク削除
  const handleDeleteTask = async (taskId) => {
    try {
      const { error } = await supabase
        .from('weekly_tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error
      await loadTasks()
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  // 期限フォーマット
  const formatDeadline = (deadline) => {
    const date = new Date(deadline)
    const now = new Date()
    const isOverdue = date < now
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    
    return {
      text: `${month}/${day} ${hours}:${minutes}`,
      isOverdue
    }
  }

  // デフォルトの期限日時（翌日の同じ時刻）
  const getDefaultDeadline = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setSeconds(0, 0)
    return tomorrow.toISOString().slice(0, 16)
  }

  if (loading) {
    return (
      <div className={`rounded-2xl p-6 ${isDark ? 'bg-gray-900/50' : 'bg-white/50'} backdrop-blur-sm border ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="animate-pulse">
          <div className={`h-6 w-32 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl p-6 ${isDark ? 'bg-gray-900/50' : 'bg-white/50'} backdrop-blur-sm border ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">📅</span>
          <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            今週のタスク
          </h2>
          <span className={`text-sm px-2 py-0.5 rounded-full ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
            {tasks.filter(t => !t.completed).length}
          </span>
        </div>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm)
            if (!newTaskDeadline) {
              setNewTaskDeadline(getDefaultDeadline())
            }
          }}
          className={`p-2 rounded-xl transition-all duration-200 ${
            isDark
              ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* 追加フォーム */}
      {showAddForm && (
        <form onSubmit={handleAddTask} className={`mb-4 p-4 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'}`}>
          <div className="space-y-3">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="タスク名を入力..."
              className={`w-full px-4 py-2 rounded-xl border transition-colors ${
                isDark
                  ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:border-gray-600'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gray-400'
              } focus:outline-none`}
              autoFocus
            />
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={newTaskDeadline}
                onChange={(e) => setNewTaskDeadline(e.target.value)}
                className={`flex-1 px-4 py-2 rounded-xl border transition-colors ${
                  isDark
                    ? 'bg-gray-900 border-gray-700 text-white focus:border-gray-600'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-gray-400'
                } focus:outline-none`}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setNewTaskTitle('')
                  setNewTaskDeadline('')
                }}
                className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
                  isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving || !newTaskTitle.trim() || !newTaskDeadline}
                className={`flex-1 px-4 py-2 rounded-xl font-bold transition-colors ${
                  isDark
                    ? 'bg-white text-gray-900 hover:bg-gray-200 disabled:bg-gray-600 disabled:text-gray-400'
                    : 'bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500'
                }`}
              >
                {saving ? '追加中...' : '追加'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* タスクリスト */}
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className={`text-sm text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            今週のタスクはありません
          </p>
        ) : (
          tasks.map((task) => {
            const deadline = formatDeadline(task.deadline)
            return (
              <div
                key={task.id}
                className={`group flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                  isDark
                    ? 'hover:bg-gray-800/50'
                    : 'hover:bg-gray-100/50'
                } ${task.completed ? 'opacity-50' : ''}`}
              >
                {/* チェックボックス */}
                <button
                  onClick={() => handleToggleComplete(task.id, task.completed)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                    task.completed
                      ? isDark
                        ? 'bg-green-500 border-green-500'
                        : 'bg-green-600 border-green-600'
                      : isDark
                      ? 'border-gray-600 hover:border-gray-500'
                      : 'border-gray-400 hover:border-gray-500'
                  }`}
                >
                  {task.completed && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* タスク名 */}
                <span className={`flex-1 ${
                  task.completed
                    ? 'line-through'
                    : ''
                } ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {task.title}
                </span>

                {/* 期限 */}
                <span className={`text-xs px-2 py-1 rounded-lg ${
                  deadline.isOverdue && !task.completed
                    ? isDark
                      ? 'bg-red-900/50 text-red-400'
                      : 'bg-red-100 text-red-600'
                    : isDark
                    ? 'bg-gray-800 text-gray-400'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {deadline.text}
                </span>

                {/* 削除ボタン */}
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className={`opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all duration-200 ${
                    isDark
                      ? 'hover:bg-red-900/50 text-gray-500 hover:text-red-400'
                      : 'hover:bg-red-100 text-gray-400 hover:text-red-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
