import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import {
  addTodoItem,
  toggleTodoItem,
  deleteTodoItem,
  calculateProgress,
} from '../utils/todo'

export default function CalendarPage({ user, isDark }) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [todoList, setTodoList] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadTodoListForDate(selectedDate)
  }, [selectedDate, user])

  const loadTodoListForDate = async (date) => {
    setLoading(true)
    try {
      // 日本時間で日付を取得
      const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000))
      const dateStr = jstDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('todo_lists')
        .select(`
          *,
          todo_items (*)
        `)
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setTodoList(data || null)
    } catch (error) {
      console.error('Error loading todo list:', error)
    } finally {
      setLoading(false)
    }
  }

  const createTodoListForDate = async (date) => {
    // 日本時間で日付を取得
    const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000))
    const dateStr = jstDate.toISOString().split('T')[0]
    
    const { data, error } = await supabase
      .from('todo_lists')
      .insert({
        user_id: user.id,
        date: dateStr,
        title: `${dateStr}のtodo`
      })
      .select()
      .single()

    if (error) throw error

    return data
  }

  const handleAddTask = async (content) => {
    if (!content.trim()) return

    try {
      let list = todoList
      if (!list) {
        list = await createTodoListForDate(selectedDate)
        list.todo_items = []
      }

      await addTodoItem(list.id, content.trim())
      await loadTodoListForDate(selectedDate)
    } catch (error) {
      console.error('Error adding task:', error)
    }
  }

  const handleToggle = async (itemId, isCompleted) => {
    try {
      await toggleTodoItem(itemId, isCompleted)
      await loadTodoListForDate(selectedDate)
    } catch (error) {
      console.error('Error toggling task:', error)
    }
  }

  const handleDelete = async (itemId) => {
    try {
      await deleteTodoItem(itemId)
      await loadTodoListForDate(selectedDate)
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  // カレンダー表示用のヘルパー関数
  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // 前月の日付で埋める
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // 当月の日付
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }

    return days
  }

  const isToday = (date) => {
    if (!date) return false
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isSelected = (date) => {
    if (!date) return false
    return date.toDateString() === selectedDate.toDateString()
  }

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const weekDays = ['日', '月', '火', '水', '木', '金', '土']

  const days = getDaysInMonth(currentMonth)
  const items = todoList?.todo_items || []
  const progress = calculateProgress(items)

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6">
      {/* カレンダー */}
      <div className={`backdrop-blur-xl rounded-3xl shadow-lg border overflow-hidden transition-colors duration-500 ${
        isDark
          ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
          : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
      }`}>
        <div className="p-8">
          {/* 月選択ヘッダー */}
          <div className="flex items-center justify-between mb-6">
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

            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {currentMonth.getFullYear()}年 {monthNames[currentMonth.getMonth()]}
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

          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekDays.map((day, index) => (
              <div
                key={day}
                className={`text-center text-sm font-semibold py-2 ${
                  index === 0 ? (isDark ? 'text-red-400' : 'text-red-600') :
                  index === 6 ? (isDark ? 'text-blue-400' : 'text-blue-600') :
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* カレンダーグリッド */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => (
              <button
                key={index}
                onClick={() => day && setSelectedDate(day)}
                disabled={!day}
                className={`aspect-square p-2 rounded-lg transition-all duration-200 ${
                  !day
                    ? 'invisible'
                    : isSelected(day)
                    ? isDark
                      ? 'bg-white text-gray-900 font-bold scale-105'
                      : 'bg-gray-900 text-white font-bold scale-105'
                    : isToday(day)
                    ? isDark
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                    : isDark
                    ? 'text-gray-300 hover:bg-gray-800'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {day && day.getDate()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 選択した日付のタスク表示 */}
      <div className={`backdrop-blur-xl rounded-3xl shadow-lg border overflow-hidden transition-colors duration-500 ${
        isDark
          ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
          : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
      }`}>
        <div className="p-8">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-2xl font-bold tracking-tight ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日のタスク
            </h2>
            {items.length > 0 && (
              <div className={`px-4 py-2 rounded-full font-bold text-lg ${
                progress >= 70
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : progress >= 40
                  ? isDark
                    ? 'bg-gray-300 text-gray-900'
                    : 'bg-gray-700 text-white'
                  : isDark
                  ? 'bg-gray-700 text-gray-300'
                  : 'bg-gray-300 text-gray-700'
              }`}>
                {progress}%
              </div>
            )}
          </div>

          {loading ? (
            <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              読み込み中...
            </div>
          ) : (
            <div className="space-y-1">
              {items
                .sort((a, b) => a.order_index - b.order_index)
                .map((item) => (
                  <TaskItem
                    key={item.id}
                    item={item}
                    isDark={isDark}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              <NewTaskItem isDark={isDark} onAdd={handleAddTask} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// TaskItemとNewTaskItemコンポーネントはTodoList.jsxと同じ
function NewTaskItem({ isDark, onAdd }) {
  const [content, setContent] = useState('')
  const [indentLevel, setIndentLevel] = useState(0)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (content.trim()) {
        onAdd(content)
        setContent('')
        setIndentLevel(0)
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        setIndentLevel((prev) => (prev > 0 ? prev - 1 : prev))
      } else {
        setIndentLevel((prev) => (prev < 3 ? prev + 1 : prev))
      }
    }
  }

  return (
    <div
      className="group flex items-center gap-3 py-2 transition-all duration-200"
      style={{ paddingLeft: `${indentLevel * 24}px` }}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
        isDark
          ? 'bg-white text-gray-900'
          : 'bg-gray-900 text-white'
      }`}>
        <span className="text-sm font-bold transform -rotate-90">
          ▼
        </span>
      </div>

      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder=""
        className={`flex-1 bg-transparent border-0 focus:ring-0 outline-none text-sm ${
          isDark
            ? 'text-white placeholder:text-gray-600'
            : 'text-gray-900 placeholder:text-gray-400'
        }`}
      />
    </div>
  )
}

function TaskItem({ item, isDark, onToggle, onDelete }) {
  const [indentLevel, setIndentLevel] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(item.content)
  const inputRef = useState(null)[0]

  const handleToggle = async () => {
    await onToggle(item.id, !item.is_completed)
  }

  const handleEdit = () => {
    setIsEditing(true)
    setEditContent(item.content)
  }

  const handleSave = async () => {
    if (editContent.trim() && editContent !== item.content) {
      // TODO: タスク内容の更新API呼び出し
      item.content = editContent.trim()
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setEditContent(item.content)
      setIsEditing(false)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        setIndentLevel((prev) => (prev > 0 ? prev - 1 : prev))
      } else {
        setIndentLevel((prev) => (prev < 3 ? prev + 1 : prev))
      }
    } else if (e.key === 'Backspace' && !isEditing) {
      e.preventDefault()
      onDelete(item.id)
    }
  }

  return (
    <div
      className="group flex items-center gap-3 py-2 transition-all duration-200"
      style={{ paddingLeft: `${indentLevel * 24}px` }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <button
        onClick={handleToggle}
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:scale-110 ${
          item.is_completed
            ? isDark
              ? 'bg-gray-700 text-white'
              : 'bg-gray-300 text-gray-700'
            : isDark
            ? 'bg-white text-gray-900 hover:bg-gray-100'
            : 'bg-gray-900 text-white hover:bg-gray-800'
        }`}
      >
        {item.is_completed ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <span className="text-sm font-bold transform -rotate-90">
            ▼
          </span>
        )}
      </button>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className={`flex-1 bg-transparent border-0 focus:ring-0 outline-none text-sm ${
            isDark
              ? 'text-white'
              : 'text-gray-900'
          }`}
        />
      ) : (
        <span
          onClick={handleEdit}
          className={`flex-1 text-sm transition-all duration-200 cursor-text ${
            item.is_completed
              ? isDark ? 'text-gray-600 line-through' : 'text-gray-400 line-through'
              : isDark ? 'text-gray-100' : 'text-gray-900'
          }`}
        >
          {item.content}
        </span>
      )}
    </div>
  )
}
