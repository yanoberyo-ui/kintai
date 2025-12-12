import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { getDateString } from '../utils/date'
import {
  getGoogleAccessToken,
  fetchGoogleCalendarEvents,
  convertGoogleEventToSchedule,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  markGoogleEventAsCompleted,
  getGoogleCalendarEnabledWithFallback,
  setGoogleCalendarEnabled,
} from '../utils/googleCalendar'

const HOUR_HEIGHT = 60 // 1時間あたりの高さ（px）
const START_HOUR = 6 // 開始時間
const END_HOUR = 24 // 終了時間
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
const SNAP_MINUTES = 15 // 15分刻みでスナップ

export default function DailyCalendarPage({ user, isDark }) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [schedules, setSchedules] = useState({}) // { [userId]: Schedule[] }
  const [members, setMembers] = useState([])
  // 表示中のメンバーIDをlocalStorageから復元
  const [displayedMembers, setDisplayedMembers] = useState(() => {
    try {
      const saved = localStorage.getItem('dailyCalendar_displayedMembers')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false)
  const [addModalTab, setAddModalTab] = useState('new') // 'new' | 'todo'
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [newSchedule, setNewSchedule] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    color: COLORS[0],
    target_user_id: null // 追加先のユーザーID（nullなら自分）
  })
  const scrollContainerRef = useRef(null)
  const calendarColumnRef = useRef(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // ドラッグ&リサイズ関連の状態
  const [draggingSchedule, setDraggingSchedule] = useState(null)
  const [resizingSchedule, setResizingSchedule] = useState(null)
  const [dragStartY, setDragStartY] = useState(0)
  const [originalTop, setOriginalTop] = useState(0)
  const [originalHeight, setOriginalHeight] = useState(0)
  
  // Todo関連の状態
  const [todayTodos, setTodayTodos] = useState([])
  const [weeklyTasks, setWeeklyTasks] = useState([])
  const [routineTodos, setRoutineTodos] = useState([])
  const [showTodoPanel, setShowTodoPanel] = useState(false) // モバイルでは初期非表示
  
  // Todoドラッグ&ドロップ
  const [draggingTodo, setDraggingTodo] = useState(null)
  const [dropTargetHour, setDropTargetHour] = useState(null)
  
  // モバイル用タッチドラッグ
  const [touchDraggingTodo, setTouchDraggingTodo] = useState(null)
  const [touchPosition, setTouchPosition] = useState({ x: 0, y: 0 })
  const calendarRef = useRef(null)
  
  // 選択中のスケジュール（Backspaceで削除用）
  const [selectedSchedule, setSelectedSchedule] = useState(null)
  
  // Googleカレンダー連携
  const [googleCalendarEnabled, setGoogleCalendarEnabledState] = useState(false)
  const [googleEvents, setGoogleEvents] = useState([])
  const [googleSyncing, setGoogleSyncing] = useState(false)
  const [googleStatus, setGoogleStatus] = useState('disconnected') // 'disconnected' | 'connected' | 'error'
  const [showGoogleSettings, setShowGoogleSettings] = useState(false)

  // 現在時刻の更新
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // 1分ごとに更新
    return () => clearInterval(interval)
  }, [])

  // 表示中のメンバーをlocalStorageに保存
  useEffect(() => {
    localStorage.setItem('dailyCalendar_displayedMembers', JSON.stringify(displayedMembers))
  }, [displayedMembers])

  // 初回スクロール位置を現在時刻付近に
  useEffect(() => {
    if (scrollContainerRef.current) {
      const now = new Date()
      const currentHour = now.getHours()
      const scrollTo = Math.max(0, (currentHour - START_HOUR - 1) * HOUR_HEIGHT)
      scrollContainerRef.current.scrollTop = scrollTo
    }
  }, [])

  // メンバー一覧を取得（同じワークスペースのユーザー）
  useEffect(() => {
    const loadMembers = async () => {
      if (!user?.id) return
      
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, department')
        .neq('id', user.id) // 自分以外
        .order('name')
      
      if (!error && data) {
        setMembers(data)
      }
    }
    loadMembers()
  }, [user?.id])
  
  // Googleカレンダー連携状態を確認
  useEffect(() => {
    const checkGoogleCalendar = async () => {
      if (!user?.id) return
      const enabled = await getGoogleCalendarEnabledWithFallback(user.id)
      setGoogleCalendarEnabledState(enabled)
    }
    checkGoogleCalendar()
  }, [user?.id])
  
  // Googleカレンダーイベントを取得
  useEffect(() => {
    const loadGoogleEvents = async () => {
      if (!googleCalendarEnabled || !user?.id) {
        setGoogleEvents([])
        setGoogleStatus('disconnected')
        return
      }
      
      setGoogleSyncing(true)
      console.log('[Google Calendar] 同期開始...')
      try {
        const accessToken = await getGoogleAccessToken()
        if (!accessToken) {
          console.error('[Google Calendar] アクセストークンがないため同期できません')
          setGoogleEvents([])
          setGoogleStatus('error') // トークンがない = 要再認証
          return
        }
        
        const startOfDay = new Date(selectedDate)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(selectedDate)
        endOfDay.setHours(23, 59, 59, 999)
        
        const events = await fetchGoogleCalendarEvents(accessToken, startOfDay, endOfDay)
        const convertedEvents = events
          .map(e => convertGoogleEventToSchedule(e, user.id))
          .filter(e => e !== null) // 終日イベントを除外
        
        setGoogleEvents(convertedEvents)
        setGoogleStatus('connected') // 同期成功
        console.log('[Google Calendar] 同期成功!', { eventCount: convertedEvents.length })
      } catch (error) {
        console.error('[Google Calendar] 同期エラー:', error)
        setGoogleStatus('error')
      } finally {
        setGoogleSyncing(false)
      }
    }
    loadGoogleEvents()
  }, [googleCalendarEnabled, selectedDate, user?.id])

  // スケジュール取得
  useEffect(() => {
    loadSchedules()
  }, [selectedDate, user?.id, displayedMembers])

  // リアルタイムサブスクリプション（メンバーのスケジュール更新を監視）
  useEffect(() => {
    if (!user?.id) return
    
    const channel = supabase
      .channel('daily_schedules_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_schedules'
        },
        (payload) => {
          // 表示中のメンバーまたは自分のスケジュールが変更されたらリロード
          const userIds = [user.id, ...displayedMembers]
          if (payload.new?.user_id && userIds.includes(payload.new.user_id)) {
            loadSchedules()
          } else if (payload.old?.user_id && userIds.includes(payload.old.user_id)) {
            loadSchedules()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, displayedMembers, selectedDate])

  // キーボードイベント（Backspaceで選択中のスケジュールを削除）
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedSchedule) {
        // モーダルが開いている場合や入力中は無視
        if (showAddScheduleModal || editingSchedule || showAddMemberModal) return
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
        
        e.preventDefault()
        handleDeleteSchedule(selectedSchedule.id)
        setSelectedSchedule(null)
      }
      // Escapeで選択解除
      if (e.key === 'Escape') {
        setSelectedSchedule(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedSchedule, showAddScheduleModal, editingSchedule, showAddMemberModal])

  // Todo取得
  useEffect(() => {
    loadTodos()
  }, [selectedDate, user?.id])

  // Todoの完了状態をリアルタイム監視（カレンダー上の表示更新用）
  useEffect(() => {
    if (!user?.id) return
    
    const todoItemsChannel = supabase
      .channel('todo_items_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'todo_items' },
        () => loadTodos()
      )
      .subscribe()

    const weeklyTasksChannel = supabase
      .channel('weekly_tasks_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'weekly_tasks' },
        () => loadTodos()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(todoItemsChannel)
      supabase.removeChannel(weeklyTasksChannel)
    }
  }, [user?.id, selectedDate])

  const loadSchedules = async () => {
    if (!user?.id) return

    // 選択した日付の0時から翌日0時まで
    const startOfDay = new Date(selectedDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(selectedDate)
    endOfDay.setHours(23, 59, 59, 999)
    
    // 自分と表示中のメンバーのスケジュールを取得
    const userIds = [user.id, ...displayedMembers]
    
    const { data, error } = await supabase
      .from('daily_schedules')
      .select('*')
      .in('user_id', userIds)
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .order('start_time')

    if (!error && data) {
      // ユーザーIDごとにグループ化
      const grouped = {}
      userIds.forEach(id => {
        grouped[id] = data.filter(s => s.user_id === id)
      })
      setSchedules(grouped)
    }
  }

  const loadTodos = async () => {
    if (!user?.id) return

    const dateStr = getDateString(selectedDate)

    // 今日のTodoリストを取得
    const { data: todoData } = await supabase
      .from('todo_lists')
      .select(`
        *,
        todo_items (*)
      `)
      .eq('user_id', user.id)
      .eq('date', dateStr)
      .maybeSingle()

    if (todoData?.todo_items) {
      const sorted = todoData.todo_items.sort((a, b) => a.order_index - b.order_index)
      setTodayTodos(sorted)
    } else {
      setTodayTodos([])
    }

    // 週次タスクを取得
    const { data: weeklyData } = await supabase
      .from('weekly_tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('deadline', { ascending: true })

    if (weeklyData) {
      setWeeklyTasks(weeklyData)
    }

    // 定常Todoを取得
    const { data: routineData } = await supabase
      .from('routine_todos')
      .select('*')
      .eq('user_id', user.id)
      .order('order_index', { ascending: true })

    if (routineData) {
      setRoutineTodos(routineData)
    }
  }

  const formatDateForQuery = (date) => {
    return date.toISOString().split('T')[0]
  }

  const formatDateDisplay = (date) => {
    const weekDays = ['日', '月', '火', '水', '木', '金', '土']
    const y = date.getFullYear()
    const m = date.getMonth() + 1
    const d = date.getDate()
    const w = weekDays[date.getDay()]
    return `${y}年${m}月${d}日(${w})`
  }

  // 日付ナビゲーション
  const goToPreviousDay = () => {
    setSelectedDate(new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000))
  }

  const goToNextDay = () => {
    setSelectedDate(new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000))
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  // 時間配列を生成
  const hours = []
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    hours.push(h)
  }

  // Y座標から時間を計算（15分刻みにスナップ）
  const yToTime = (y) => {
    const totalMinutes = (y / HOUR_HEIGHT) * 60 + START_HOUR * 60
    const snappedMinutes = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES
    const hours = Math.floor(snappedMinutes / 60)
    const minutes = snappedMinutes % 60
    return { hours: Math.max(START_HOUR, Math.min(END_HOUR, hours)), minutes }
  }

  // 時間からY座標を計算
  const timeToY = (hours, minutes) => {
    return ((hours - START_HOUR) + minutes / 60) * HOUR_HEIGHT
  }

  // スケジュール追加
  const handleAddSchedule = async () => {
    if (!newSchedule.title || !newSchedule.start_time || !newSchedule.end_time) return

    const dateStr = formatDateForQuery(selectedDate)
    const startTime = new Date(`${dateStr}T${newSchedule.start_time}:00`)
    const endTime = new Date(`${dateStr}T${newSchedule.end_time}:00`)
    const targetUserId = newSchedule.target_user_id || user.id

    let googleEventId = null
    
    // Googleカレンダーに同期（自分のスケジュールの場合のみ）
    if (googleCalendarEnabled && targetUserId === user.id) {
      const accessToken = await getGoogleAccessToken()
      if (accessToken) {
        const googleEvent = await createGoogleCalendarEvent(accessToken, {
          title: newSchedule.title,
          description: newSchedule.description,
          start_time: startTime,
          end_time: endTime,
          color: newSchedule.color,
        })
        if (googleEvent) {
          googleEventId = googleEvent.id
        }
      }
    }

    const { error } = await supabase
      .from('daily_schedules')
      .insert({
        user_id: targetUserId,
        created_by: user.id,
        title: newSchedule.title,
        description: newSchedule.description,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        color: newSchedule.color,
        google_event_id: googleEventId,
      })

    if (!error) {
      setShowAddScheduleModal(false)
      setNewSchedule({ title: '', description: '', start_time: '', end_time: '', color: COLORS[0], target_user_id: null })
      setAddModalTab('new')
      loadSchedules()
    }
  }

  // Todoからスケジュールを追加
  const handleAddFromTodo = async (todo, type) => {
    if (!newSchedule.start_time || !newSchedule.end_time) return

    const dateStr = formatDateForQuery(selectedDate)
    const startTime = new Date(`${dateStr}T${newSchedule.start_time}:00`)
    const endTime = new Date(`${dateStr}T${newSchedule.end_time}:00`)
    const targetUserId = newSchedule.target_user_id || user.id

    const title = type === 'weekly' ? todo.title : todo.content
    const color = type === 'weekly' ? COLORS[3] : type === 'routine' ? COLORS[4] : COLORS[0]
    const description = `${type === 'weekly' ? '週次タスク' : type === 'routine' ? '定常タスク' : '今日のTodo'}から追加`

    // Google Calendar連携（自分のスケジュールの場合のみ）
    let googleEventId = null
    if (googleCalendarEnabled && targetUserId === user.id) {
      const accessToken = await getGoogleAccessToken()
      if (accessToken) {
        const googleEvent = await createGoogleCalendarEvent(accessToken, {
          title,
          description,
          start_time: startTime,
          end_time: endTime,
          color,
        })
        if (googleEvent) {
          googleEventId = googleEvent.id
          console.log('Google Calendar event created from Todo:', googleEventId)
        }
      }
    }

    const { error } = await supabase
      .from('daily_schedules')
      .insert({
        user_id: targetUserId,
        created_by: user.id,
        title: title,
        description,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        color: color,
        source_todo_id: todo.id,
        source_type: type,
        google_event_id: googleEventId
      })

    if (!error) {
      setShowAddScheduleModal(false)
      setNewSchedule({ title: '', description: '', start_time: '', end_time: '', color: COLORS[0] })
      setAddModalTab('new')
      loadSchedules()
    }
  }

  // スケジュール更新（時間のみ）
  const updateScheduleTime = async (scheduleId, startTime, endTime) => {
    // まずスケジュール情報を取得（Google Event IDが必要）
    const { data: scheduleData } = await supabase
      .from('daily_schedules')
      .select('google_event_id, title, description, color')
      .eq('id', scheduleId)
      .single()
    
    // Googleカレンダーも更新
    if (googleCalendarEnabled && scheduleData?.google_event_id) {
      const accessToken = await getGoogleAccessToken()
      if (accessToken) {
        await updateGoogleCalendarEvent(accessToken, scheduleData.google_event_id, {
          start_time: startTime,
          end_time: endTime,
        })
      }
    }
    
    const { error } = await supabase
      .from('daily_schedules')
      .update({
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', scheduleId)

    if (!error) {
      loadSchedules()
    }
  }

  // スケジュール更新
  const handleUpdateSchedule = async () => {
    if (!editingSchedule?.id) return

    const dateStr = formatDateForQuery(selectedDate)
    const startTime = new Date(`${dateStr}T${editingSchedule.start_time}:00`)
    const endTime = new Date(`${dateStr}T${editingSchedule.end_time}:00`)

    // Googleカレンダーも更新
    if (googleCalendarEnabled && editingSchedule.google_event_id) {
      const accessToken = await getGoogleAccessToken()
      if (accessToken) {
        await updateGoogleCalendarEvent(accessToken, editingSchedule.google_event_id, {
          title: editingSchedule.title,
          description: editingSchedule.description,
          start_time: startTime,
          end_time: endTime,
          color: editingSchedule.color,
        })
      }
    }

    const { error } = await supabase
      .from('daily_schedules')
      .update({
        title: editingSchedule.title,
        description: editingSchedule.description,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        color: editingSchedule.color,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingSchedule.id)

    if (!error) {
      setEditingSchedule(null)
      loadSchedules()
    }
  }

  // スケジュール削除
  const handleDeleteSchedule = async (scheduleId) => {
    // まずスケジュール情報を取得（Google Event IDが必要）
    const { data: scheduleData } = await supabase
      .from('daily_schedules')
      .select('google_event_id')
      .eq('id', scheduleId)
      .single()
    
    // Googleカレンダーからも削除
    if (googleCalendarEnabled && scheduleData?.google_event_id) {
      const accessToken = await getGoogleAccessToken()
      if (accessToken) {
        await deleteGoogleCalendarEvent(accessToken, scheduleData.google_event_id)
      }
    }
    
    const { error } = await supabase
      .from('daily_schedules')
      .delete()
      .eq('id', scheduleId)

    if (!error) {
      setEditingSchedule(null)
      setSelectedSchedule(null)
      loadSchedules()
    }
  }

  // Todoドラッグ開始（HTML5 Drag and Drop）
  const handleTodoDragStart = (e, todo, type) => {
    setDraggingTodo({ ...todo, type })
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: todo.id, type }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  // Todoドラッグ終了
  const handleTodoDragEnd = () => {
    setDraggingTodo(null)
    setDropTargetHour(null)
  }

  // モバイル用タッチドラッグ開始
  const handleTouchStart = (e, todo, type) => {
    const touch = e.touches[0]
    setTouchDraggingTodo({ ...todo, type })
    setTouchPosition({ x: touch.clientX, y: touch.clientY })
    // パネルを閉じてカレンダーを見えるようにする
    setShowTodoPanel(false)
  }

  // モバイル用タッチ移動
  const handleTouchMove = (e) => {
    if (!touchDraggingTodo) return
    const touch = e.touches[0]
    setTouchPosition({ x: touch.clientX, y: touch.clientY })
  }

  // モバイル用タッチ終了（ドロップ）
  const handleTouchEnd = async (e) => {
    if (!touchDraggingTodo) return
    
    const touch = e.changedTouches[0]
    const dropX = touch.clientX
    const dropY = touch.clientY
    
    // カレンダーグリッド上でドロップされたか確認
    const calendarElement = calendarRef.current
    if (!calendarElement) {
      setTouchDraggingTodo(null)
      return
    }
    
    const calendarRect = calendarElement.getBoundingClientRect()
    
    // カレンダー範囲外ならキャンセル
    if (dropX < calendarRect.left || dropX > calendarRect.right ||
        dropY < calendarRect.top || dropY > calendarRect.bottom) {
      setTouchDraggingTodo(null)
      return
    }
    
    // Y座標から時間を計算（60pxが1時間）
    const relativeY = dropY - calendarRect.top + calendarElement.scrollTop
    const hour = Math.floor(relativeY / 60)
    
    if (hour < 0 || hour > 23) {
      setTouchDraggingTodo(null)
      return
    }
    
    // X座標からターゲットユーザーを判定
    const timeColumnWidth = 60 // 時間列の幅
    const relativeX = dropX - calendarRect.left - timeColumnWidth
    const columnWidth = 200 // 各ユーザー列の幅
    
    let targetUserId = user.id
    if (relativeX > columnWidth && displayedMembers.length > 0) {
      const memberIndex = Math.floor((relativeX - columnWidth) / columnWidth)
      if (memberIndex >= 0 && memberIndex < displayedMembers.length) {
        targetUserId = displayedMembers[memberIndex].id
      }
    }
    
    // スケジュールを作成
    const startTime = new Date(selectedDate)
    startTime.setHours(hour, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(hour + 1, 0, 0, 0)
    
    const title = touchDraggingTodo.content || touchDraggingTodo.title
    const color = touchDraggingTodo.type === 'routine' ? '#8B5CF6' : 
           touchDraggingTodo.type === 'weekly' ? '#F59E0B' : '#3B82F6'
    
    // Google Calendar連携（自分のスケジュールの場合のみ）
    let googleEventId = null
    if (googleCalendarEnabled && targetUserId === user.id) {
      const accessToken = await getGoogleAccessToken()
      if (accessToken) {
        const googleEvent = await createGoogleCalendarEvent(accessToken, {
          title,
          description: '',
          start_time: startTime,
          end_time: endTime,
          color,
        })
        if (googleEvent) {
          googleEventId = googleEvent.id
          console.log('Google Calendar event created (touch):', googleEventId)
        }
      }
    }
    
    const scheduleData = {
      user_id: targetUserId,
      title,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      color,
      source_todo_id: touchDraggingTodo.id,
      source_type: touchDraggingTodo.type,
      created_by: user.id,
      google_event_id: googleEventId
    }
    
    const { error } = await supabase.from('daily_schedules').insert(scheduleData)
    
    if (!error) {
      loadSchedules()
    }
    
    setTouchDraggingTodo(null)
  }

  // カレンダー列でのドラッグオーバー
  const handleCalendarDragOver = (e, hour, targetUserId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropTargetHour(`${targetUserId}-${hour}`)
  }

  // カレンダー列でのドロップ（自分またはメンバー）
  const handleCalendarDrop = async (e, hour, targetUserId) => {
    e.preventDefault()
    setDropTargetHour(null)
    
    if (!draggingTodo) return
    
    // 開始時間
    const startTime = new Date(selectedDate)
    startTime.setHours(hour, 0, 0, 0)
    
    // 終了時間（1時間後、ただし24時を超えないように）
    const endHour = Math.min(hour + 1, END_HOUR)
    const endTime = new Date(selectedDate)
    endTime.setHours(endHour, 0, 0, 0)
    
    // 色を決定
    let color = COLORS[0]
    if (draggingTodo.type === 'routine') {
      color = '#8b5cf6' // 紫
    } else if (draggingTodo.type === 'today') {
      color = '#3b82f6' // 青
    } else if (draggingTodo.type === 'weekly') {
      color = '#f59e0b' // オレンジ
    }
    
    const title = draggingTodo.content || draggingTodo.title
    const todoId = draggingTodo.id
    const todoType = draggingTodo.type
    
    // Google Calendar連携（自分のスケジュールの場合のみ）
    let googleEventId = null
    if (googleCalendarEnabled && targetUserId === user.id) {
      const accessToken = await getGoogleAccessToken()
      if (accessToken) {
        const googleEvent = await createGoogleCalendarEvent(accessToken, {
          title,
          description: '',
          start_time: startTime,
          end_time: endTime,
          color,
        })
        if (googleEvent) {
          googleEventId = googleEvent.id
          console.log('Google Calendar event created:', googleEventId)
        }
      }
    }
    
    const { error } = await supabase
      .from('daily_schedules')
      .insert({
        user_id: targetUserId, // 対象ユーザーのカレンダーに追加
        created_by: user.id, // 作成者
        title,
        description: '',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        color,
        source_todo_id: todoId,
        source_type: todoType,
        google_event_id: googleEventId
      })
    
    if (!error) {
      loadSchedules()
    }
    
    setDraggingTodo(null)
  }

  // スケジュールブロックのドラッグ開始（マウスイベント）
  const handleDragStart = (e, schedule) => {
    e.preventDefault()
    e.stopPropagation()
    const { top } = getSchedulePosition(schedule)
    setDraggingSchedule(schedule)
    setDragStartY(e.clientY)
    setOriginalTop(top)
  }

  // リサイズ開始
  const handleResizeStart = (e, schedule) => {
    e.preventDefault()
    e.stopPropagation()
    const { top, height } = getSchedulePosition(schedule)
    setResizingSchedule(schedule)
    setDragStartY(e.clientY)
    setOriginalTop(top)
    setOriginalHeight(height)
  }

  // マウス移動
  const handleMouseMove = useCallback((e) => {
    if (draggingSchedule) {
      e.preventDefault()
      const deltaY = e.clientY - dragStartY
      const newTop = Math.max(0, Math.min((END_HOUR - START_HOUR) * HOUR_HEIGHT, originalTop + deltaY))
      const { hours, minutes } = yToTime(newTop)
      
      // 元のスケジュールの長さを維持
      const start = new Date(draggingSchedule.start_time)
      const end = new Date(draggingSchedule.end_time)
      const duration = (end - start) / (1000 * 60) // 分単位
      
      const newStartMinutes = hours * 60 + minutes
      const newEndMinutes = Math.min(END_HOUR * 60, newStartMinutes + duration)
      
      // 仮の表示を更新
      setSchedules(prev => {
        const updated = { ...prev }
        if (!updated[user.id]) return prev
        updated[user.id] = updated[user.id].map(s => {
          if (s.id === draggingSchedule.id) {
            const dateStr = formatDateForQuery(selectedDate)
            const startH = Math.floor(newStartMinutes / 60)
            const startM = newStartMinutes % 60
            const endH = Math.floor(newEndMinutes / 60)
            const endM = newEndMinutes % 60
            const newStart = new Date(`${dateStr}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`)
            const newEnd = new Date(`${dateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`)
            return { ...s, start_time: newStart.toISOString(), end_time: newEnd.toISOString() }
          }
          return s
        })
        return updated
      })
    }
    
    if (resizingSchedule) {
      e.preventDefault()
      const deltaY = e.clientY - dragStartY
      const newHeight = Math.max(HOUR_HEIGHT / 4, originalHeight + deltaY) // 最小15分
      const endY = originalTop + newHeight
      const { hours, minutes } = yToTime(endY)
      
      // 仮の表示を更新
      setSchedules(prev => {
        const updated = { ...prev }
        if (!updated[user.id]) return prev
        updated[user.id] = updated[user.id].map(s => {
          if (s.id === resizingSchedule.id) {
            const dateStr = formatDateForQuery(selectedDate)
            const newEnd = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
            return { ...s, end_time: newEnd.toISOString() }
          }
          return s
        })
        return updated
      })
    }
  }, [draggingSchedule, resizingSchedule, dragStartY, originalTop, originalHeight, selectedDate, user?.id])

  // マウスアップ
  const handleMouseUp = useCallback(async () => {
    if (draggingSchedule) {
      const schedule = schedules[user.id]?.find(s => s.id === draggingSchedule.id)
      if (schedule) {
        await updateScheduleTime(
          schedule.id,
          new Date(schedule.start_time),
          new Date(schedule.end_time)
        )
      }
      setDraggingSchedule(null)
    }
    
    if (resizingSchedule) {
      const schedule = schedules[user.id]?.find(s => s.id === resizingSchedule.id)
      if (schedule) {
        await updateScheduleTime(
          schedule.id,
          new Date(schedule.start_time),
          new Date(schedule.end_time)
        )
      }
      setResizingSchedule(null)
    }
  }, [draggingSchedule, resizingSchedule, schedules, user?.id])

  // グローバルマウスイベント
  useEffect(() => {
    if (draggingSchedule || resizingSchedule) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [draggingSchedule, resizingSchedule, handleMouseMove, handleMouseUp])

  // メンバー追加
  const handleAddMember = (memberId) => {
    if (!displayedMembers.includes(memberId)) {
      setDisplayedMembers([...displayedMembers, memberId])
    }
    setShowAddMemberModal(false)
  }

  // メンバー削除
  const handleRemoveMember = (memberId) => {
    setDisplayedMembers(displayedMembers.filter(id => id !== memberId))
  }

  // 現在時刻の位置を計算
  const getCurrentTimePosition = () => {
    const now = currentTime
    const hours = now.getHours()
    const minutes = now.getMinutes()
    if (hours < START_HOUR || hours > END_HOUR) return null
    return (hours - START_HOUR) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT
  }

  // スケジュールブロックの位置を計算
  const getSchedulePosition = (schedule) => {
    const start = new Date(schedule.start_time)
    const end = new Date(schedule.end_time)
    const startHour = start.getHours() + start.getMinutes() / 60
    const endHour = end.getHours() + end.getMinutes() / 60
    
    const top = Math.max(0, (startHour - START_HOUR) * HOUR_HEIGHT)
    const height = Math.max(30, (endHour - startHour) * HOUR_HEIGHT)
    
    return { top, height }
  }

  // スケジュールが元のTodoとして完了しているかチェック
  const isScheduleCompleted = (schedule) => {
    if (!schedule.source_todo_id || !schedule.source_type) return false
    
    if (schedule.source_type === 'today') {
      const todo = todayTodos.find(t => t.id === schedule.source_todo_id)
      return todo?.is_completed || false
    }
    if (schedule.source_type === 'weekly') {
      const task = weeklyTasks.find(t => t.id === schedule.source_todo_id)
      return task?.completed || false
    }
    // routineは今日完了したかをチェック（routine_todo_completions）
    if (schedule.source_type === 'routine') {
      const routine = routineTodos.find(t => t.id === schedule.source_todo_id)
      return routine?.is_completed_today || false
    }
    return false
  }

  // 時間をフォーマット
  const formatTime = (isoString) => {
    const date = new Date(isoString)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  // メンバー名を取得
  const getMemberName = (memberId) => {
    if (memberId === user?.id) return '自分'
    const member = members.find(m => m.id === memberId)
    return member?.name || 'Unknown'
  }

  // 時間帯クリックでスケジュール追加モーダルを開く
  const handleTimeSlotClick = (hour, targetUserId = null) => {
    if (draggingSchedule || resizingSchedule) return
    const startTime = `${hour.toString().padStart(2, '0')}:00`
    const endHour = Math.min(hour + 1, END_HOUR)
    const endTime = `${endHour.toString().padStart(2, '0')}:00`
    setNewSchedule({ 
      ...newSchedule, 
      start_time: startTime, 
      end_time: endTime,
      target_user_id: targetUserId
    })
    setShowAddScheduleModal(true)
  }

  // スケジュールクリックで編集モーダルを開く
  const handleScheduleClick = (e, schedule, isOwn) => {
    if (draggingSchedule || resizingSchedule) return
    if (!isOwn) return // 他人のスケジュールは編集不可
    
    const start = new Date(schedule.start_time)
    const end = new Date(schedule.end_time)
    setEditingSchedule({
      ...schedule,
      start_time: `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`,
      end_time: `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`
    })
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

  const currentTimePosition = getCurrentTimePosition()
  const isToday = selectedDate.toDateString() === new Date().toDateString()

  // 全Todoの統合リスト
  const allTodos = [
    ...routineTodos.map(t => ({ ...t, type: 'routine', content: t.content })),
    ...todayTodos.map(t => ({ ...t, type: 'today' })),
    ...weeklyTasks.map(t => ({ ...t, type: 'weekly', content: t.title }))
  ]

  return (
    <div className="max-w-full mx-auto p-4 md:p-8">
      {/* ヘッダー */}
      <div className={`rounded-2xl p-4 md:p-6 mb-4 ${isDark ? 'bg-gray-900/50' : 'bg-white/50'} backdrop-blur-sm border ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className={`text-xl md:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            📅 {formatDateDisplay(selectedDate)}
          </h1>
          
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousDay}
              className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={goToToday}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                isDark
                  ? 'bg-gray-800 hover:bg-gray-700 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              今日
            </button>
            
            <button
              onClick={goToNextDay}
              className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="w-px h-6 bg-gray-600 mx-2" />

            <button
              onClick={() => setShowTodoPanel(!showTodoPanel)}
              className={`px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                showTodoPanel
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span className="hidden md:inline">Todo</span>
            </button>

            <button
              onClick={() => setShowAddMemberModal(true)}
              className={`px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden md:inline">メンバー</span>
            </button>
            
            {/* Googleカレンダー連携ボタン */}
            <button
              onClick={async () => {
                const newState = !googleCalendarEnabled
                const success = await setGoogleCalendarEnabled(user.id, newState)
                if (success) {
                  setGoogleCalendarEnabledState(newState)
                  if (!newState) {
                    setGoogleStatus('disconnected')
                  }
                }
              }}
              className={`px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                googleStatus === 'connected'
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : googleStatus === 'error'
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title={
                googleStatus === 'connected' 
                  ? 'Googleカレンダー連携中（クリックで解除）' 
                  : googleStatus === 'error'
                  ? '再ログインが必要です'
                  : 'Googleカレンダーと連携'
              }
            >
              {/* ステータスに応じたアイコン */}
              {googleStatus === 'connected' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : googleStatus === 'error' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span className="hidden md:inline">
                {googleSyncing 
                  ? '同期中...' 
                  : googleStatus === 'connected'
                  ? '連携中'
                  : googleStatus === 'error'
                  ? '要再認証'
                  : 'Google'
                }
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 relative">
        {/* Todoパネル - デスクトップ：左サイドバー、モバイル：ボトムシート */}
        {showTodoPanel && (
          <>
            {/* モバイル用オーバーレイ */}
            <div 
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowTodoPanel(false)}
            />
            <div className={`
              fixed md:relative
              bottom-0 md:bottom-auto left-0 right-0 md:left-auto md:right-auto
              z-50 md:z-auto
              w-full md:w-80
              max-h-[70vh] md:max-h-none
              flex-shrink-0 
              rounded-t-3xl md:rounded-2xl 
              ${isDark ? 'bg-gray-900' : 'bg-white'} md:${isDark ? 'bg-gray-900/50' : 'bg-white/50'}
              backdrop-blur-sm 
              border-t md:border ${isDark ? 'border-gray-700 md:border-gray-800' : 'border-gray-200'} 
              overflow-hidden
              transform transition-transform duration-300 ease-out
              animate-slide-up md:animate-none
            `}>
              {/* モバイル用ハンドル */}
              <div className="md:hidden flex justify-center pt-3 pb-1">
                <div className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />
              </div>
              
              <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} flex items-center justify-between`}>
                <div>
                  <h2 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    📋 Todo一覧
                  </h2>
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    ドラッグしてカレンダーに追加
                  </p>
                </div>
                {/* モバイル用閉じるボタン */}
                <button 
                  onClick={() => setShowTodoPanel(false)}
                  className={`md:hidden p-2 rounded-xl ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-4 space-y-4 max-h-[calc(70vh-100px)] md:max-h-[calc(100vh-350px)] overflow-y-auto">
              {/* 定常タスク */}
              {routineTodos.length > 0 && (
                <div>
                  <div className={`text-xs font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    定常タスク
                  </div>
                  <div className="space-y-1">
                    {routineTodos.map(todo => (
                      <div
                        key={`routine-${todo.id}`}
                        draggable
                        onDragStart={(e) => handleTodoDragStart(e, todo, 'routine')}
                        onDragEnd={handleTodoDragEnd}
                        onTouchStart={(e) => handleTouchStart(e, todo, 'routine')}
                        className={`px-3 py-2 rounded-lg text-sm cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02] ${isDark ? 'bg-gray-800/50 text-gray-300 hover:bg-purple-500/20' : 'bg-gray-100/50 text-gray-700 hover:bg-purple-100'}`}
                      >
                        {todo.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 今日のTodo */}
              {todayTodos.length > 0 && (
                <div>
                  <div className={`text-xs font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    今日のTodo
                  </div>
                  <div className="space-y-1">
                    {todayTodos.map(todo => (
                      <div
                        key={`today-${todo.id}`}
                        draggable={!todo.is_completed}
                        onDragStart={(e) => !todo.is_completed && handleTodoDragStart(e, todo, 'today')}
                        onDragEnd={handleTodoDragEnd}
                        onTouchStart={(e) => !todo.is_completed && handleTouchStart(e, todo, 'today')}
                        className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${
                          todo.is_completed
                            ? isDark ? 'bg-gray-800/30 text-gray-500 line-through' : 'bg-gray-100/30 text-gray-400 line-through'
                            : `cursor-grab active:cursor-grabbing hover:scale-[1.02] ${isDark ? 'bg-gray-800/50 text-gray-300 hover:bg-blue-500/20' : 'bg-gray-100/50 text-gray-700 hover:bg-blue-100'}`
                        }`}
                      >
                        {todo.is_completed && (
                          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {todo.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 週次タスク */}
              {weeklyTasks.length > 0 && (
                <div>
                  <div className={`text-xs font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    今週のタスク
                  </div>
                  <div className="space-y-1">
                    {weeklyTasks.map(task => {
                      const deadline = formatDeadline(task.deadline)
                      return (
                        <div
                          key={`weekly-${task.id}`}
                          draggable={!task.completed}
                          onDragStart={(e) => !task.completed && handleTodoDragStart(e, task, 'weekly')}
                          onDragEnd={handleTodoDragEnd}
                          onTouchStart={(e) => !task.completed && handleTouchStart(e, task, 'weekly')}
                          className={`px-3 py-2 rounded-lg text-sm transition-all ${
                            task.completed
                              ? isDark ? 'bg-gray-800/30 text-gray-500 line-through' : 'bg-gray-100/30 text-gray-400 line-through'
                              : `cursor-grab active:cursor-grabbing hover:scale-[1.02] ${isDark ? 'bg-gray-800/50 text-gray-300 hover:bg-amber-500/20' : 'bg-gray-100/50 text-gray-700 hover:bg-amber-100'}`
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={task.completed ? 'line-through' : ''}>{task.title}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              deadline.isOverdue && !task.completed
                                ? 'bg-red-500/20 text-red-400'
                                : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                            }`}>
                              {deadline.text}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {allTodos.length === 0 && (
                <p className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Todoがありません
                </p>
              )}
            </div>
          </div>
          </>
        )}

        {/* カレンダー本体 */}
        <div className={`flex-1 rounded-2xl overflow-hidden ${isDark ? 'bg-gray-900/50' : 'bg-white/50'} backdrop-blur-sm border ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          {/* スクロールコンテナ（横も縦も） */}
          <div
            ref={scrollContainerRef}
            className="overflow-auto"
            style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}
          >
            {/* 一人だけの時は100%幅、複数人の時は固定幅 */}
            <div style={{ 
              width: displayedMembers.length === 0 
                ? '100%' 
                : `${70 + 200 * (1 + displayedMembers.length)}px`,
              minWidth: displayedMembers.length === 0 ? '100%' : undefined
            }}>
              {/* ヘッダー行（縦スクロール時に固定） */}
              <div className={`flex sticky top-0 z-20 border-b ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                {/* 時間ヘッダー（横スクロール時も固定） */}
                <div className={`w-[70px] flex-shrink-0 p-3 text-center font-medium text-sm sticky left-0 z-30 ${isDark ? 'text-gray-500 bg-gray-900' : 'text-gray-400 bg-white'}`}>
                  時間
                </div>
                
                {/* 自分の列ヘッダー */}
                <div className={`${displayedMembers.length === 0 ? 'flex-1' : 'w-[200px] flex-shrink-0'} p-3 text-center font-bold border-l ${isDark ? 'border-gray-800 text-white' : 'border-gray-200 text-gray-900'}`}>
                  自分
                </div>
                
                {/* メンバー列ヘッダー */}
                {displayedMembers.map(memberId => (
                  <div
                    key={memberId}
                    className={`w-[200px] flex-shrink-0 p-3 text-center font-medium border-l ${isDark ? 'border-gray-800 text-gray-300' : 'border-gray-200 text-gray-700'}`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="truncate">{getMemberName(memberId)}</span>
                      <button
                        onClick={() => handleRemoveMember(memberId)}
                        className={`p-1 rounded-full hover:bg-red-500/20 transition-colors flex-shrink-0 ${isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 時間グリッドコンテンツ */}
              <div 
                ref={calendarRef}
                className="flex relative" 
                style={{ height: `${(END_HOUR - START_HOUR + 1) * HOUR_HEIGHT}px` }}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* 時間ラベル（横スクロール時に固定） */}
                <div className={`w-[70px] flex-shrink-0 sticky left-0 z-10 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
                  {hours.map(hour => (
                    <div
                      key={hour}
                      className={`flex items-start justify-center pt-1 text-xs md:text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                      style={{ height: `${HOUR_HEIGHT}px` }}
                    >
                      {hour}:00
                    </div>
                  ))}
                </div>

                {/* 自分の列 */}
                <div 
                  ref={calendarColumnRef}
                  className={`${displayedMembers.length === 0 ? 'flex-1' : 'w-[200px] flex-shrink-0'} relative border-l ${isDark ? 'border-gray-800' : 'border-gray-200'}`}
                >
                  {/* 時間グリッド線 */}
                  {hours.map(hour => (
                    <div
                      key={hour}
                      onClick={() => {
                        setSelectedSchedule(null)
                        handleTimeSlotClick(hour, user.id)
                      }}
                      onDragOver={(e) => handleCalendarDragOver(e, hour, user.id)}
                      onDragLeave={() => setDropTargetHour(null)}
                      onDrop={(e) => handleCalendarDrop(e, hour, user.id)}
                      className={`absolute w-full border-t cursor-pointer transition-colors ${
                        dropTargetHour === `${user.id}-${hour}`
                          ? isDark ? 'bg-blue-500/30 border-blue-500' : 'bg-blue-100 border-blue-300'
                          : isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-200 hover:bg-gray-100/50'
                      }`}
                      style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                    />
                  ))}
                  
                  {/* スケジュールブロック */}
                  {(schedules[user?.id] || []).map(schedule => {
                    const { top, height } = getSchedulePosition(schedule)
                    const isDragging = draggingSchedule?.id === schedule.id
                    const isResizing = resizingSchedule?.id === schedule.id
                    const isSelected = selectedSchedule?.id === schedule.id
                    const isCompleted = isScheduleCompleted(schedule)
                    
                    return (
                      <div
                        key={schedule.id}
                        className={`absolute left-1 right-1 rounded-lg overflow-hidden shadow-lg select-none transition-all ${
                          isDragging || isResizing ? 'shadow-2xl z-30 opacity-90' : 'hover:shadow-xl'
                        } ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 z-20' : ''} ${
                          isCompleted ? 'opacity-40' : ''
                        }`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundColor: schedule.color || COLORS[0],
                          minHeight: '30px'
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedSchedule(schedule)
                        }}
                      >
                        {/* メイン領域（ドラッグ可能） */}
                        <div
                          className="absolute top-0 left-0 right-0 bottom-3 cursor-move p-2"
                          onMouseDown={(e) => handleDragStart(e, schedule)}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            handleScheduleClick(e, schedule, true)
                          }}
                        >
                          <div className={`text-white text-sm font-medium truncate ${isCompleted ? 'line-through' : ''}`}>
                            {isCompleted && <span className="mr-1">✓</span>}
                            {schedule.title}
                          </div>
                          <div className="text-white/80 text-xs mt-1">
                            {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                          </div>
                          {schedule.created_by && schedule.created_by !== user?.id && (
                            <div className="text-white/70 text-xs mt-0.5 flex items-center gap-1">
                              <span className="w-3 h-3 rounded-full bg-white/30 flex items-center justify-center text-[8px]">👤</span>
                              {getMemberName(schedule.created_by)}から
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute top-1 right-1 text-white/60 text-xs">
                              ⌫ 削除
                            </div>
                          )}
                        </div>
                        
                        {/* リサイズハンドル（下部） */}
                        <div
                          className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center hover:bg-black/20"
                          onMouseDown={(e) => handleResizeStart(e, schedule)}
                        >
                          <div className="w-8 h-1 bg-white/50 rounded-full" />
                        </div>
                      </div>
                    )
                  })}
                  
                  {/* Googleカレンダーイベント（読み取り専用） */}
                  {googleCalendarEnabled && googleEvents.map(event => {
                    const { top, height } = getSchedulePosition(event)
                    // 既にKintaiに存在するイベントは表示しない（重複防止）
                    const existsInKintai = (schedules[user?.id] || []).some(s => s.google_event_id === event.google_event_id)
                    if (existsInKintai) return null
                    
                    return (
                      <div
                        key={event.id}
                        className="absolute left-1 right-1 rounded-lg overflow-hidden shadow-lg opacity-70 border-2 border-dashed border-white/30"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundColor: event.color || '#4285f4',
                          minHeight: '30px'
                        }}
                        title="Googleカレンダーから同期"
                      >
                        <div className="p-2">
                          <div className="text-white text-sm font-medium truncate flex items-center gap-1">
                            <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19.5 22h-15A2.5 2.5 0 0 1 2 19.5v-15A2.5 2.5 0 0 1 4.5 2H9v2H4.5a.5.5 0 0 0-.5.5v15a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5V15h2v4.5a2.5 2.5 0 0 1-2.5 2.5z"/>
                            </svg>
                            {event.title}
                          </div>
                          <div className="text-white/80 text-xs mt-1">
                            {formatTime(event.start_time)} - {formatTime(event.end_time)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* メンバー列 */}
                {displayedMembers.map(memberId => (
                  <div
                    key={memberId}
                    className={`w-[200px] flex-shrink-0 relative border-l ${isDark ? 'border-gray-800' : 'border-gray-200'}`}
                  >
                    {/* 時間グリッド線（クリック・ドロップ可能） */}
                    {hours.map(hour => (
                      <div
                        key={hour}
                        onClick={() => {
                          setSelectedSchedule(null)
                          handleTimeSlotClick(hour, memberId)
                        }}
                        onDragOver={(e) => handleCalendarDragOver(e, hour, memberId)}
                        onDragLeave={() => setDropTargetHour(null)}
                        onDrop={(e) => handleCalendarDrop(e, hour, memberId)}
                        className={`absolute w-full border-t cursor-pointer transition-colors ${
                          dropTargetHour === `${memberId}-${hour}`
                            ? isDark ? 'bg-green-500/30 border-green-500' : 'bg-green-100 border-green-300'
                            : isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-200 hover:bg-gray-100/50'
                        }`}
                        style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                      />
                    ))}
                    
                    {/* スケジュールブロック */}
                    {(schedules[memberId] || []).map(schedule => {
                      const { top, height } = getSchedulePosition(schedule)
                      return (
                        <div
                          key={schedule.id}
                          className="absolute left-1 right-1 rounded-lg p-2 overflow-hidden shadow-lg opacity-80"
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            backgroundColor: schedule.color || COLORS[0],
                            minHeight: '30px'
                          }}
                        >
                          <div className="text-white text-sm font-medium truncate">{schedule.title}</div>
                          <div className="text-white/80 text-xs">
                            {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}

                {/* 現在時刻インジケーター */}
                {isToday && currentTimePosition !== null && (
                  <div
                    className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
                    style={{ top: `${currentTimePosition}px` }}
                  >
                    <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5" />
                    <div className="flex-1 h-0.5 bg-red-500" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* メンバー追加モーダル */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              メンバーを追加
            </h3>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {members
                .filter(m => !displayedMembers.includes(m.id))
                .map(member => (
                  <button
                    key={member.id}
                    onClick={() => handleAddMember(member.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                      isDark
                        ? 'hover:bg-gray-800 text-gray-300'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="font-medium">{member.name}</div>
                    {member.department && (
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {member.department}
                      </div>
                    )}
                  </button>
                ))}
              
              {members.filter(m => !displayedMembers.includes(m.id)).length === 0 && (
                <p className={`text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  追加できるメンバーがいません
                </p>
              )}
            </div>
            
            <button
              onClick={() => setShowAddMemberModal(false)}
              className={`w-full mt-4 px-4 py-2 rounded-xl font-medium transition-colors ${
                isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* スケジュール追加モーダル */}
      {showAddScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`w-full max-w-lg rounded-2xl p-6 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <h3 className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              スケジュールを追加
            </h3>
            {newSchedule.target_user_id && newSchedule.target_user_id !== user?.id && (
              <p className={`text-sm mb-3 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                📤 {getMemberName(newSchedule.target_user_id)} さんのカレンダーに追加
              </p>
            )}
            
            {/* タブ切り替え */}
            <div className={`flex gap-2 mb-4 p-1 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <button
                onClick={() => setAddModalTab('new')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  addModalTab === 'new'
                    ? isDark
                      ? 'bg-white text-gray-900'
                      : 'bg-gray-900 text-white'
                    : isDark
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                新規作成
              </button>
              <button
                onClick={() => setAddModalTab('todo')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  addModalTab === 'todo'
                    ? isDark
                      ? 'bg-white text-gray-900'
                      : 'bg-gray-900 text-white'
                    : isDark
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Todoから選択
              </button>
            </div>

            {/* 時間設定（共通） */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  開始時間
                </label>
                <input
                  type="time"
                  value={newSchedule.start_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                  className={`w-full px-4 py-2 rounded-xl border ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  終了時間
                </label>
                <input
                  type="time"
                  value={newSchedule.end_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                  className={`w-full px-4 py-2 rounded-xl border ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
            </div>
            
            {addModalTab === 'new' ? (
              /* 新規作成タブ */
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    タイトル
                  </label>
                  <input
                    type="text"
                    value={newSchedule.title}
                    onChange={(e) => setNewSchedule({ ...newSchedule, title: e.target.value })}
                    className={`w-full px-4 py-2 rounded-xl border ${
                      isDark
                        ? 'bg-gray-800 border-gray-700 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="ミーティング、作業など"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    色
                  </label>
                  <div className="flex gap-2">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewSchedule({ ...newSchedule, color })}
                        className={`w-8 h-8 rounded-full transition-transform ${newSchedule.color === color ? 'scale-125 ring-2 ring-white' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    説明（任意）
                  </label>
                  <textarea
                    value={newSchedule.description}
                    onChange={(e) => setNewSchedule({ ...newSchedule, description: e.target.value })}
                    className={`w-full px-4 py-2 rounded-xl border resize-none ${
                      isDark
                        ? 'bg-gray-800 border-gray-700 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    rows={2}
                    placeholder="詳細を入力..."
                  />
                </div>
              </div>
            ) : (
              /* Todoから選択タブ */
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {/* 定常タスク */}
                {routineTodos.length > 0 && (
                  <>
                    <div className={`text-xs font-semibold flex items-center gap-2 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      定常タスク
                    </div>
                    {routineTodos.map(todo => (
                      <button
                        key={`routine-${todo.id}`}
                        onClick={() => handleAddFromTodo(todo, 'routine')}
                        disabled={!newSchedule.start_time || !newSchedule.end_time}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                          isDark
                            ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50'
                        }`}
                      >
                        {todo.content}
                      </button>
                    ))}
                  </>
                )}

                {/* 今日のTodo */}
                {todayTodos.filter(t => !t.is_completed).length > 0 && (
                  <>
                    <div className={`text-xs font-semibold flex items-center gap-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      今日のTodo
                    </div>
                    {todayTodos.filter(t => !t.is_completed).map(todo => (
                      <button
                        key={`today-${todo.id}`}
                        onClick={() => handleAddFromTodo(todo, 'today')}
                        disabled={!newSchedule.start_time || !newSchedule.end_time}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                          isDark
                            ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50'
                        }`}
                      >
                        {todo.content}
                      </button>
                    ))}
                  </>
                )}

                {/* 週次タスク */}
                {weeklyTasks.filter(t => !t.completed).length > 0 && (
                  <>
                    <div className={`text-xs font-semibold flex items-center gap-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      今週のタスク
                    </div>
                    {weeklyTasks.filter(t => !t.completed).map(task => (
                      <button
                        key={`weekly-${task.id}`}
                        onClick={() => handleAddFromTodo(task, 'weekly')}
                        disabled={!newSchedule.start_time || !newSchedule.end_time}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                          isDark
                            ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{task.title}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>
                            {formatDeadline(task.deadline).text}
                          </span>
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {allTodos.filter(t => !t.is_completed && !t.completed).length === 0 && (
                  <p className={`text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    未完了のTodoがありません
                  </p>
                )}

                {(!newSchedule.start_time || !newSchedule.end_time) && (
                  <p className={`text-center py-2 text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                    ⚠️ 開始・終了時間を設定してから選択してください
                  </p>
                )}
              </div>
            )}
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowAddScheduleModal(false)
                  setNewSchedule({ title: '', description: '', start_time: '', end_time: '', color: COLORS[0] })
                  setAddModalTab('new')
                }}
                className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
                  isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                キャンセル
              </button>
              {addModalTab === 'new' && (
                <button
                  onClick={handleAddSchedule}
                  disabled={!newSchedule.title || !newSchedule.start_time || !newSchedule.end_time}
                  className={`flex-1 px-4 py-2 rounded-xl font-bold transition-colors ${
                    isDark
                      ? 'bg-white text-gray-900 hover:bg-gray-200 disabled:bg-gray-600 disabled:text-gray-400'
                      : 'bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500'
                  }`}
                >
                  追加
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* スケジュール編集モーダル */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              スケジュールを編集
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  タイトル
                </label>
                <input
                  type="text"
                  value={editingSchedule.title}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, title: e.target.value })}
                  className={`w-full px-4 py-2 rounded-xl border ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    開始時間
                  </label>
                  <input
                    type="time"
                    value={editingSchedule.start_time}
                    onChange={(e) => setEditingSchedule({ ...editingSchedule, start_time: e.target.value })}
                    className={`w-full px-4 py-2 rounded-xl border ${
                      isDark
                        ? 'bg-gray-800 border-gray-700 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    終了時間
                  </label>
                  <input
                    type="time"
                    value={editingSchedule.end_time}
                    onChange={(e) => setEditingSchedule({ ...editingSchedule, end_time: e.target.value })}
                    className={`w-full px-4 py-2 rounded-xl border ${
                      isDark
                        ? 'bg-gray-800 border-gray-700 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  色
                </label>
                <div className="flex gap-2">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditingSchedule({ ...editingSchedule, color })}
                      className={`w-8 h-8 rounded-full transition-transform ${editingSchedule.color === color ? 'scale-125 ring-2 ring-white' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  説明（任意）
                </label>
                <textarea
                  value={editingSchedule.description || ''}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, description: e.target.value })}
                  className={`w-full px-4 py-2 rounded-xl border resize-none ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  rows={2}
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => handleDeleteSchedule(editingSchedule.id)}
                className="px-4 py-2 rounded-xl font-medium transition-colors bg-red-500/20 text-red-500 hover:bg-red-500/30"
              >
                削除
              </button>
              <button
                onClick={() => setEditingSchedule(null)}
                className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
                  isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={handleUpdateSchedule}
                className={`flex-1 px-4 py-2 rounded-xl font-bold transition-colors ${
                  isDark
                    ? 'bg-white text-gray-900 hover:bg-gray-200'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* モバイル用ドラッグプレビュー */}
      {touchDraggingTodo && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: touchPosition.x - 75,
            top: touchPosition.y - 20,
          }}
        >
          <div className={`px-4 py-2 rounded-lg text-sm font-medium shadow-lg ${
            touchDraggingTodo.type === 'routine' 
              ? 'bg-purple-500 text-white' 
              : touchDraggingTodo.type === 'weekly'
              ? 'bg-amber-500 text-white'
              : 'bg-blue-500 text-white'
          }`}>
            {touchDraggingTodo.content || touchDraggingTodo.title}
          </div>
          <p className={`text-xs text-center mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            カレンダーにドロップ
          </p>
        </div>
      )}
    </div>
  )
}
