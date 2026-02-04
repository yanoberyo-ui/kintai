import React, { useState, useEffect, useRef } from 'react'
import { getTodayTodoList } from '../../../features/todo/utils/todo'
import { supabase } from '../../../utils/supabase'

export default function PomodoroPage({ user, isDark }) {
  const [todoList, setTodoList] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)

  // localStorageからタイマー状態を復元
  const [timerState, setTimerState] = useState(() => {
    const saved = localStorage.getItem('pomodoroTimerState')
    return saved ? JSON.parse(saved).state : 'idle'
  })
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem('pomodoroTimerState')
    if (saved) {
      const { state, startTime, pausedTimeLeft } = JSON.parse(saved)
      // 一時停止中の場合は、保存された残り時間を使う
      if (state === 'paused') {
        return pausedTimeLeft
      }
      // 実行中の場合は、経過時間から計算
      const totalTime = state === 'working' ? 25 * 60 : state === 'short_break' ? 5 * 60 : 15 * 60
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      return Math.max(0, totalTime - elapsed)
    }
    return 25 * 60
  })
  const [pomodoroCount, setPomodoroCount] = useState(0) // 連続ポモドーロ数
  const [todayTotal, setTodayTotal] = useState(0) // 今日の合計ポモドーロ数
  const [startTime, setStartTime] = useState(() => {
    const saved = localStorage.getItem('pomodoroTimerState')
    return saved ? JSON.parse(saved).startTime : null
  })

  const intervalRef = useRef(null)
  const audioRef = useRef(null)

  // タイマーの長さ（秒）
  const WORK_TIME = 25 * 60
  const SHORT_BREAK = 5 * 60
  const LONG_BREAK = 15 * 60

  const loadTodoList = async () => {
    try {
      const data = await getTodayTodoList(user.id)
      setTodoList(data)
    } catch (error) {
      console.error('Error loading todo list:', error)
    }
  }

  // タイマー状態をlocalStorageに保存
  useEffect(() => {
    if (timerState === 'idle') {
      localStorage.removeItem('pomodoroTimerState')
    } else if (timerState === 'paused') {
      // 一時停止時は残り時間と元の状態を保存
      const saved = localStorage.getItem('pomodoroTimerState')
      const previousState = saved ? JSON.parse(saved).previousState || JSON.parse(saved).state : 'working'
      localStorage.setItem('pomodoroTimerState', JSON.stringify({
        state: timerState,
        pausedTimeLeft: timeLeft,
        previousState: previousState === 'paused' ? 'working' : previousState,
        startTime: null
      }))
    } else if (startTime) {
      // 実行中はstartTimeを保存
      localStorage.setItem('pomodoroTimerState', JSON.stringify({
        state: timerState,
        startTime: startTime,
        previousState: timerState
      }))
    }
  }, [timerState, startTime, timeLeft])

  useEffect(() => {
    loadTodoList()
    // 今日の合計ポモドーロ数を取得
    setTodayTotal(0)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [user])

  useEffect(() => {
    if (timerState !== 'idle') {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // タイマー完了処理
            if (audioRef.current) {
              audioRef.current.play()
            }

            if (timerState === 'working') {
              // 通知
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('作業完了！', {
                  body: '素晴らしい！5分間休憩しましょう。'
                })
              }

              // 作業完了
              setPomodoroCount(c => c + 1)
              setTodayTotal(t => t + 1)

              // タスクのポモドーロカウントを更新
              if (selectedTask) {
                supabase
                  .from('todo_items')
                  .select('pomodoro_count')
                  .eq('id', selectedTask.id)
                  .single()
                  .then(({ data: task }) => {
                    const newCount = (task?.pomodoro_count || 0) + 1
                    return supabase
                      .from('todo_items')
                      .update({ pomodoro_count: newCount })
                      .eq('id', selectedTask.id)
                  })
                  .then(() => loadTodoList())
                  .catch(error => console.error('Error updating pomodoro count:', error))
              }

              // 次の状態へ
              setPomodoroCount(c => {
                const newCount = c + 1
                if (newCount % 4 === 0) {
                  setTimerState('long_break')
                  setTimeLeft(LONG_BREAK)
                } else {
                  setTimerState('short_break')
                  setTimeLeft(SHORT_BREAK)
                }
                return c
              })
            } else {
              // 休憩終了通知
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('休憩終了！', {
                  body: '次のセッションを始めましょう。'
                })
              }
              setTimerState('idle')
            }

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
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [timerState, selectedTask, LONG_BREAK, SHORT_BREAK])

  const startWork = (task = null) => {
    if (task) {
      setSelectedTask(task)
    }
    setTimerState('working')
    setTimeLeft(WORK_TIME)
    setStartTime(Date.now())
  }

  const pauseTimer = () => {
    setTimerState('paused')
    setStartTime(null)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }

  const resumeTimer = () => {
    // localStorageから一時停止前の状態を取得
    const saved = localStorage.getItem('pomodoroTimerState')
    if (saved) {
      const { pausedTimeLeft, previousState } = JSON.parse(saved)
      if (pausedTimeLeft && previousState) {
        // 残り時間から新しいstartTimeを計算
        const totalTime = previousState === 'working' ? WORK_TIME : previousState === 'short_break' ? SHORT_BREAK : LONG_BREAK
        const newStartTime = Date.now() - ((totalTime - pausedTimeLeft) * 1000)
        setStartTime(newStartTime)
        setTimerState(previousState)
      }
    }
  }

  const resetTimer = () => {
    setTimerState('idle')
    setTimeLeft(WORK_TIME)
    setSelectedTask(null)
    setStartTime(null)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
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
    if (timerState === 'working') return isDark ? '#FFFFFF' : '#111827' // White/Black
    if (timerState === 'long_break') return isDark ? '#9CA3AF' : '#6B7280' // Gray
    if (timerState === 'short_break') return isDark ? '#D1D5DB' : '#4B5563' // Light Gray
    return isDark ? '#6B7280' : '#9CA3AF' // Gray
  }

  return (
    <div className={`h-[calc(100dvh-14rem)] md:h-[calc(100dvh-8rem)] overflow-y-auto ${isDark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* ヘッダー */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">集中タイマー</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            25分集中 → 5分休憩のサイクルで生産性UP！
          </p>
        </div>

        {/* タイマー本体 */}
        <div className={`rounded-3xl shadow-2xl p-6 md:p-12 ${
          isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white'
        }`}>
          {/* 円形タイマー */}
          <div className="relative w-full max-w-80 aspect-square mx-auto mb-8">
            {/* 進捗円 */}
            <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 320 320">
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
              <div className="text-5xl md:text-7xl font-bold mb-2" style={{ color: getTimerColor() }}>
                {formatTime(timeLeft)}
              </div>
              <div className={`text-sm md:text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {timerState === 'working' && '集中タイム'}
                {timerState === 'short_break' && '短い休憩'}
                {timerState === 'long_break' && '長い休憩'}
                {timerState === 'paused' && '一時停止中'}
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
                className={`px-8 py-4 rounded-xl font-semibold transition-colors shadow-lg ${
                  isDark
                    ? 'bg-white text-gray-900 hover:bg-gray-100'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                開始
              </button>
            )}
            {timerState === 'paused' && (
              <>
                <button
                  onClick={resumeTimer}
                  className={`px-8 py-4 rounded-xl font-semibold transition-colors shadow-lg ${
                    isDark
                      ? 'bg-white text-gray-900 hover:bg-gray-100'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  再開
                </button>
                <button
                  onClick={resetTimer}
                  className={`px-8 py-4 rounded-xl font-semibold transition-colors shadow-lg ${
                    isDark
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                  }`}
                >
                  リセット
                </button>
              </>
            )}
            {(timerState === 'working' || timerState === 'short_break' || timerState === 'long_break') && (
              <>
                <button
                  onClick={pauseTimer}
                  className={`px-8 py-4 rounded-xl font-semibold transition-colors shadow-lg ${
                    isDark
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                  }`}
                >
                  一時停止
                </button>
                <button
                  onClick={resetTimer}
                  className={`px-8 py-4 rounded-xl font-semibold transition-colors shadow-lg ${
                    isDark
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                  }`}
                >
                  リセット
                </button>
              </>
            )}
          </div>

          {/* 統計 */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>今日の完了数</p>
              <p className="text-3xl font-bold">{todayTotal}</p>
            </div>
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>連続セッション</p>
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
              通知を有効にする
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
                      <span className={`text-sm font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {task.pomodoro_count} セッション
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
