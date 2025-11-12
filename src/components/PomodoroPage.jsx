import React, { useState, useEffect, useRef } from 'react'
import { getTodayTodoList } from '../utils/todo'
import { supabase } from '../utils/supabase'

export default function PomodoroPage({ user, isDark }) {
  const [todoList, setTodoList] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)
  const [timerState, setTimerState] = useState('idle') // idle, working, short_break, long_break
  const [timeLeft, setTimeLeft] = useState(25 * 60) // 秒単位
  const [pomodoroCount, setPomodoroCount] = useState(0) // 連続ポモドーロ数
  const [todayTotal, setTodayTotal] = useState(0) // 今日の合計ポモドーロ数
  const intervalRef = useRef(null)
  const audioRef = useRef(null)

  // タイマーの長さ（秒）
  const WORK_TIME = 25 * 60
  const SHORT_BREAK = 5 * 60
  const LONG_BREAK = 15 * 60

  useEffect(() => {
    loadTodoList()
    loadTodayPomodoroCount()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [user])

  useEffect(() => {
    if (timerState !== 'idle' && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimerComplete()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [timerState, timeLeft])

  const loadTodoList = async () => {
    try {
      const data = await getTodayTodoList(user.id)
      setTodoList(data)
    } catch (error) {
      console.error('Error loading todo list:', error)
    }
  }

  const loadTodayPomodoroCount = async () => {
    // TODO: 今日の合計ポモドーロ数を取得
    // pomodoro_sessionsテーブルから取得する（後で実装）
    setTodayTotal(0)
  }

  const handleTimerComplete = () => {
    playSound()
    sendNotification()

    if (timerState === 'working') {
      // 作業完了
      setPomodoroCount(prev => prev + 1)
      setTodayTotal(prev => prev + 1)

      // タスクのポモドーロカウントを更新
      if (selectedTask) {
        updateTaskPomodoroCount(selectedTask.id)
      }

      // 4ポモドーロ完了したら長い休憩、そうでなければ短い休憩
      if ((pomodoroCount + 1) % 4 === 0) {
        startBreak('long_break')
      } else {
        startBreak('short_break')
      }
    } else {
      // 休憩終了
      setTimerState('idle')
    }
  }

  const startWork = (task = null) => {
    if (task) {
      setSelectedTask(task)
    }
    setTimerState('working')
    setTimeLeft(WORK_TIME)
  }

  const startBreak = (type) => {
    setTimerState(type)
    setTimeLeft(type === 'long_break' ? LONG_BREAK : SHORT_BREAK)
  }

  const pauseTimer = () => {
    setTimerState('idle')
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }

  const resetTimer = () => {
    setTimerState('idle')
    setTimeLeft(WORK_TIME)
    setSelectedTask(null)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }

  const updateTaskPomodoroCount = async (taskId) => {
    try {
      // タスクのポモドーロカウントを+1
      const { data: task } = await supabase
        .from('todo_items')
        .select('pomodoro_count')
        .eq('id', taskId)
        .single()

      const newCount = (task?.pomodoro_count || 0) + 1

      await supabase
        .from('todo_items')
        .update({ pomodoro_count: newCount })
        .eq('id', taskId)

      // リスト再読み込み
      await loadTodoList()
    } catch (error) {
      console.error('Error updating pomodoro count:', error)
    }
  }

  const playSound = () => {
    // Web Audio APIで音を再生（後で実装）
    if (audioRef.current) {
      audioRef.current.play()
    }
  }

  const sendNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      if (timerState === 'working') {
        new Notification('🍅 ポモドーロ完了！', {
          body: '素晴らしい！5分間休憩しましょう。',
          icon: '/tomato.png'
        })
      } else {
        new Notification('☕ 休憩終了！', {
          body: '次のポモドーロを始めましょう。',
          icon: '/coffee.png'
        })
      }
    }
  }

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getProgress = () => {
    const total = timerState === 'working'
      ? WORK_TIME
      : timerState === 'long_break'
      ? LONG_BREAK
      : SHORT_BREAK
    return ((total - timeLeft) / total) * 100
  }

  const getTimerColor = () => {
    if (timerState === 'working') return isDark ? '#EF4444' : '#DC2626' // Red
    if (timerState === 'long_break') return isDark ? '#3B82F6' : '#2563EB' // Blue
    if (timerState === 'short_break') return isDark ? '#10B981' : '#059669' // Green
    return isDark ? '#6B7280' : '#9CA3AF' // Gray
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* ヘッダー */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">🍅 ポモドーロタイマー</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            25分集中 → 5分休憩のサイクルで生産性UP！
          </p>
        </div>

        {/* タイマー本体 */}
        <div className={`rounded-3xl shadow-2xl p-12 ${
          isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white'
        }`}>
          {/* 円形タイマー */}
          <div className="relative w-80 h-80 mx-auto mb-8">
            {/* 進捗円 */}
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              {/* 背景円 */}
              <circle
                cx="160"
                cy="160"
                r="140"
                stroke={isDark ? '#374151' : '#E5E7EB'}
                strokeWidth="12"
                fill="none"
              />
              {/* 進捗円 */}
              <circle
                cx="160"
                cy="160"
                r="140"
                stroke={getTimerColor()}
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 140}`}
                strokeDashoffset={`${2 * Math.PI * 140 * (1 - getProgress() / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>

            {/* 時間表示 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-7xl font-bold mb-2" style={{ color: getTimerColor() }}>
                {formatTime(timeLeft)}
              </div>
              <div className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {timerState === 'working' && '🍅 集中タイム'}
                {timerState === 'short_break' && '☕ 短い休憩'}
                {timerState === 'long_break' && '🌴 長い休憩'}
                {timerState === 'idle' && '待機中'}
              </div>
            </div>
          </div>

          {/* 現在のタスク */}
          {selectedTask && (
            <div className={`text-center mb-6 p-4 rounded-xl ${
              isDark ? 'bg-gray-800' : 'bg-gray-50'
            }`}>
              <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                現在のタスク
              </p>
              <p className="text-lg font-semibold">{selectedTask.content}</p>
            </div>
          )}

          {/* コントロールボタン */}
          <div className="flex gap-4 justify-center mb-6">
            {timerState === 'idle' && (
              <button
                onClick={() => startWork(selectedTask)}
                className="px-8 py-4 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg"
                disabled={!selectedTask}
              >
                🍅 開始
              </button>
            )}
            {timerState !== 'idle' && (
              <>
                <button
                  onClick={pauseTimer}
                  className={`px-8 py-4 rounded-xl font-semibold transition-colors shadow-lg ${
                    isDark
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                  }`}
                >
                  ⏸️ 一時停止
                </button>
                <button
                  onClick={resetTimer}
                  className={`px-8 py-4 rounded-xl font-semibold transition-colors shadow-lg ${
                    isDark
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                  }`}
                >
                  🔄 リセット
                </button>
              </>
            )}
          </div>

          {/* 統計 */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>今日の🍅</p>
              <p className="text-3xl font-bold">{todayTotal}</p>
            </div>
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>連続ポモドーロ</p>
              <p className="text-3xl font-bold">{pomodoroCount % 4} / 4</p>
            </div>
          </div>
        </div>

        {/* タスク一覧 */}
        <div className={`rounded-3xl shadow-2xl p-8 ${
          isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">今日のタスク</h2>
            <button
              onClick={requestNotificationPermission}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🔔 通知を有効にする
            </button>
          </div>

          {todoList?.todo_items?.length > 0 ? (
            <div className="space-y-3">
              {todoList.todo_items.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    selectedTask?.id === task.id
                      ? isDark
                        ? 'bg-red-900/30 border-2 border-red-500'
                        : 'bg-red-50 border-2 border-red-500'
                      : isDark
                      ? 'bg-gray-800 hover:bg-gray-750 border-2 border-transparent'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {task.is_completed ? '✅' : '⬜'}
                      </span>
                      <span className={`font-medium ${
                        task.is_completed ? 'line-through opacity-60' : ''
                      }`}>
                        {task.content}
                      </span>
                    </div>
                    {task.pomodoro_count > 0 && (
                      <span className="text-sm font-semibold">
                        🍅 × {task.pomodoro_count}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              今日のタスクがありません。TODOページでタスクを追加しましょう！
            </p>
          )}
        </div>
      </div>

      {/* 音声用の隠しaudio要素 */}
      <audio ref={audioRef} src="/notification.mp3" />
    </div>
  )
}
