import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

export default function RoutineTodos({ user, isDark }) {
  const [routineTodos, setRoutineTodos] = useState([])
  const [completions, setCompletions] = useState(new Set())
  const [newTodoContent, setNewTodoContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadRoutineTodos()
      loadTodayCompletions()
    }
  }, [user])

  const loadRoutineTodos = async () => {
    try {
      const { data, error } = await supabase
        .from('routine_todos')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })

      if (error) throw error
      setRoutineTodos(data || [])
    } catch (error) {
      console.error('Error loading routine todos:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTodayCompletions = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('routine_todo_completions')
        .select('routine_todo_id')
        .eq('user_id', user.id)
        .eq('completed_date', today)

      if (error) throw error
      setCompletions(new Set(data?.map(c => c.routine_todo_id) || []))
    } catch (error) {
      console.error('Error loading completions:', error)
    }
  }

  const addRoutineTodo = async (e) => {
    e.preventDefault()
    if (!newTodoContent.trim()) return

    try {
      const maxOrder = routineTodos.length > 0
        ? Math.max(...routineTodos.map(t => t.order_index))
        : -1

      const { data, error } = await supabase
        .from('routine_todos')
        .insert({
          user_id: user.id,
          content: newTodoContent.trim(),
          order_index: maxOrder + 1
        })
        .select()
        .single()

      if (error) throw error

      setRoutineTodos([...routineTodos, data])
      setNewTodoContent('')
    } catch (error) {
      console.error('Error adding routine todo:', error)
      alert('定常TODOの追加に失敗しました')
    }
  }

  const toggleCompletion = async (todoId) => {
    const today = new Date().toISOString().split('T')[0]
    const isCompleted = completions.has(todoId)

    try {
      if (isCompleted) {
        // 完了を取り消し
        const { error } = await supabase
          .from('routine_todo_completions')
          .delete()
          .eq('routine_todo_id', todoId)
          .eq('completed_date', today)

        if (error) throw error

        setCompletions(prev => {
          const newSet = new Set(prev)
          newSet.delete(todoId)
          return newSet
        })
      } else {
        // 完了にする
        const { error } = await supabase
          .from('routine_todo_completions')
          .insert({
            routine_todo_id: todoId,
            user_id: user.id,
            completed_date: today
          })

        if (error) throw error

        setCompletions(prev => new Set([...prev, todoId]))
      }
    } catch (error) {
      console.error('Error toggling completion:', error)
      alert('完了状態の更新に失敗しました')
    }
  }

  const deleteRoutineTodo = async (todoId) => {
    if (!confirm('この定常TODOを削除しますか？')) return

    try {
      const { error } = await supabase
        .from('routine_todos')
        .delete()
        .eq('id', todoId)

      if (error) throw error

      setRoutineTodos(routineTodos.filter(t => t.id !== todoId))
      setCompletions(prev => {
        const newSet = new Set(prev)
        newSet.delete(todoId)
        return newSet
      })
    } catch (error) {
      console.error('Error deleting routine todo:', error)
      alert('定常TODOの削除に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className={`backdrop-blur-xl rounded-3xl shadow-lg border p-6 ${
        isDark
          ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
          : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
      }`}>
        <div className={`animate-pulse ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          読み込み中...
        </div>
      </div>
    )
  }

  return (
    <div className={`backdrop-blur-xl rounded-3xl shadow-lg border transition-colors duration-500 ${
      isDark
        ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
        : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
    }`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            🔄 定常TODO
          </h2>
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            毎日リセット
          </span>
        </div>

        {/* TODOリスト */}
        <div className="space-y-2 mb-4">
          {routineTodos.length === 0 ? (
            <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              定常TODOを追加しましょう
            </div>
          ) : (
            routineTodos.map(todo => {
              const isCompleted = completions.has(todo.id)
              return (
                <div
                  key={todo.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    isDark
                      ? 'bg-gray-800/50 hover:bg-gray-800'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <button
                    onClick={() => toggleCompletion(todo.id)}
                    className={`flex-shrink-0 w-5 h-5 rounded border-2 transition-all ${
                      isCompleted
                        ? 'bg-green-500 border-green-500'
                        : isDark
                        ? 'border-gray-600 hover:border-gray-500'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {isCompleted && (
                      <svg className="w-full h-full text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <span className={`flex-1 ${
                    isCompleted
                      ? `line-through ${isDark ? 'text-gray-500' : 'text-gray-400'}`
                      : isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {todo.content}
                  </span>

                  <button
                    onClick={() => deleteRoutineTodo(todo.id)}
                    className={`flex-shrink-0 p-1 rounded hover:bg-red-500/10 transition-colors ${
                      isDark ? 'text-red-400' : 'text-red-600'
                    }`}
                    title="削除"
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

        {/* 新規追加フォーム */}
        <form onSubmit={addRoutineTodo} className="flex gap-2">
          <input
            type="text"
            value={newTodoContent}
            onChange={(e) => setNewTodoContent(e.target.value)}
            placeholder="新しい定常TODOを追加..."
            className={`flex-1 px-4 py-2 rounded-xl border focus:ring-0 transition-colors outline-none ${
              isDark
                ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 focus:border-gray-600'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
            }`}
          />
          <button
            type="submit"
            disabled={!newTodoContent.trim()}
            className={`px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            追加
          </button>
        </form>

        <p className={`mt-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          💡 定常TODOは毎日0時にリセットされます
        </p>
      </div>
    </div>
  )
}
