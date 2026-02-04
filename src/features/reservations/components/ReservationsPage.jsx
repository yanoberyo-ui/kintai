import { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'

export default function ReservationsPage({ user, isDark }) {
  const [rooms, setRooms] = useState([])
  const [reservations, setReservations] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [showReservationModal, setShowReservationModal] = useState(false)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null)
  const [loading, setLoading] = useState(true)

  // 時間スロット生成 (10:00-19:00, 30分刻み)
  const timeSlots = []
  for (let hour = 10; hour < 19; hour++) {
    timeSlots.push(`${hour.toString().padStart(2, '0')}:00`)
    timeSlots.push(`${hour.toString().padStart(2, '0')}:30`)
  }

  useEffect(() => {
    loadRooms()
  }, [])

  useEffect(() => {
    if (selectedRoom) {
      loadReservations()
    }
  }, [selectedRoom, selectedDate])

  const loadRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('name')

      if (error) throw error

      setRooms(data || [])
      if (data && data.length > 0) {
        setSelectedRoom(data[0])
      }
    } catch (error) {
      console.error('Error loading rooms:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadReservations = async () => {
    if (!selectedRoom) return

    try {
      // 選択された日の予約を取得
      const dayStart = new Date(selectedDate)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(selectedDate)
      dayEnd.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          user:users(name, email)
        `)
        .eq('room_id', selectedRoom.id)
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString())
        .order('start_time')

      if (error) throw error

      setReservations(data || [])
    } catch (error) {
      console.error('Error loading reservations:', error)
    }
  }

  const isTimeSlotReserved = (timeSlot) => {
    const [hours, minutes] = timeSlot.split(':').map(Number)
    const slotTime = new Date(selectedDate)
    slotTime.setHours(hours, minutes, 0, 0)

    return reservations.some(reservation => {
      const startTime = new Date(reservation.start_time)
      const endTime = new Date(reservation.end_time)
      return slotTime >= startTime && slotTime < endTime
    })
  }

  const getReservationForTimeSlot = (timeSlot) => {
    const [hours, minutes] = timeSlot.split(':').map(Number)
    const slotTime = new Date(selectedDate)
    slotTime.setHours(hours, minutes, 0, 0)

    return reservations.find(reservation => {
      const startTime = new Date(reservation.start_time)
      const endTime = new Date(reservation.end_time)
      return slotTime >= startTime && slotTime < endTime
    })
  }

  const handleTimeSlotClick = (timeSlot) => {
    if (isTimeSlotReserved(timeSlot)) {
      // 既存の予約を表示
      const reservation = getReservationForTimeSlot(timeSlot)
      setSelectedTimeSlot({ timeSlot, reservation })
      setShowReservationModal(true)
    } else {
      // 新規予約モーダルを表示
      setSelectedTimeSlot({ timeSlot, reservation: null })
      setShowReservationModal(true)
    }
  }

  const handleDateChange = (days) => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + days)
    setSelectedDate(newDate)
  }

  const formatDate = (date) => {
    const days = ['日', '月', '火', '水', '木', '金', '土']
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const dayOfWeek = days[date.getDay()]
    return `${year}年${month}月${day}日（${dayOfWeek}）`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          読み込み中...
        </div>
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          会議室が登録されていません
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 h-[calc(100dvh-14rem)] md:h-[calc(100dvh-8rem)] overflow-y-auto">
      {/* ヘッダー */}
      <div className={`backdrop-blur-xl rounded-3xl shadow-xl border p-6 ${
        isDark
          ? 'bg-gray-900/80 border-gray-800/50'
          : 'bg-white/80 border-gray-200/50'
      }`}>
        <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          会議室予約
        </h2>

        {/* 会議室選択 */}
        <div className="flex gap-2 mb-4">
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room)}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                selectedRoom?.id === room.id
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {room.name}
            </button>
          ))}
        </div>

        {/* 日付ナビゲーション */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => handleDateChange(-1)}
            className={`p-2 rounded-xl transition-colors ${
              isDark
                ? 'hover:bg-gray-800 text-gray-300'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {formatDate(selectedDate)}
          </div>

          <button
            onClick={() => handleDateChange(1)}
            className={`p-2 rounded-xl transition-colors ${
              isDark
                ? 'hover:bg-gray-800 text-gray-300'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* タイムスロット一覧 */}
      <div className={`backdrop-blur-xl rounded-3xl shadow-xl border p-6 ${
        isDark
          ? 'bg-gray-900/80 border-gray-800/50'
          : 'bg-white/80 border-gray-200/50'
      }`}>
        <div className="space-y-2">
          {timeSlots.map(timeSlot => {
            const reserved = isTimeSlotReserved(timeSlot)
            const reservation = reserved ? getReservationForTimeSlot(timeSlot) : null

            return (
              <button
                key={timeSlot}
                onClick={() => handleTimeSlotClick(timeSlot)}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  reserved
                    ? isDark
                      ? 'bg-blue-900/30 border-2 border-blue-700/50 hover:bg-blue-900/40'
                      : 'bg-blue-50 border-2 border-blue-200 hover:bg-blue-100'
                    : isDark
                    ? 'bg-gray-800/50 border-2 border-gray-700/50 hover:bg-gray-800'
                    : 'bg-gray-50 border-2 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`text-lg font-medium ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {timeSlot}
                  </div>
                  {reserved && reservation && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {reservation.is_recurring && (
                          <span className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`} title="定期予約">
                            🔄
                          </span>
                        )}
                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {reservation.title}
                        </span>
                      </div>
                      <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {reservation.user?.name || reservation.user?.email}
                      </div>
                    </div>
                  )}
                  {!reserved && (
                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      予約可能
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 予約モーダル（後で実装） */}
      {showReservationModal && (
        <ReservationModal
          user={user}
          isDark={isDark}
          room={selectedRoom}
          date={selectedDate}
          timeSlot={selectedTimeSlot}
          onClose={() => {
            setShowReservationModal(false)
            setSelectedTimeSlot(null)
          }}
          onSave={() => {
            setShowReservationModal(false)
            setSelectedTimeSlot(null)
            loadReservations()
          }}
        />
      )}
    </div>
  )
}

// 予約作成・編集モーダル
function ReservationModal({ user, isDark, room, date, timeSlot, onClose, onSave }) {
  const reservation = timeSlot?.reservation
  const isExisting = !!reservation
  
  const [title, setTitle] = useState(reservation?.title || '')
  const [description, setDescription] = useState(reservation?.description || '')
  const [startTime, setStartTime] = useState(timeSlot.timeSlot)
  const [duration, setDuration] = useState(30)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  // 繰り返し予約用の状態（既存の予約データから初期化）
  const [isRecurring, setIsRecurring] = useState(reservation?.is_recurring || false)
  const [recurrenceRule, setRecurrenceRule] = useState(reservation?.recurrence_rule || 'weekly') // 'daily' or 'weekly'
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(() => {
    // 既存の予約に終了日がある場合はそれを使用、なければデフォルトは1ヶ月後
    if (reservation?.recurrence_end_date) {
      return reservation.recurrence_end_date.split('T')[0]
    }
    const endDate = new Date(date)
    endDate.setMonth(endDate.getMonth() + 1)
    return endDate.toISOString().split('T')[0]
  })

  const handleSave = async () => {
    if (!title.trim()) {
      alert('タイトルを入力してください')
      return
    }

    setSaving(true)

    try {
      const [hours, minutes] = startTime.split(':').map(Number)
      const startDateTime = new Date(date)
      startDateTime.setHours(hours, minutes, 0, 0)

      const endDateTime = new Date(startDateTime)
      endDateTime.setMinutes(endDateTime.getMinutes() + duration)

      if (isRecurring) {
        // 繰り返し予約の場合
        const reservationsToCreate = []
        const currentDate = new Date(startDateTime)
        const endDate = new Date(recurrenceEndDate + 'T23:59:59')
        
        // 親予約を作成
        const { data: parentData, error: parentError } = await supabase
          .from('reservations')
          .insert([{
            room_id: room.id,
            user_id: user.id,
            title,
            description,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            is_recurring: true,
            recurrence_rule: recurrenceRule,
            recurrence_end_date: recurrenceEndDate,
          }])
          .select()
          .single()

        if (parentError) throw parentError

        // 子予約を作成（最初の日はスキップ）
        const parentId = parentData.id
        const interval = recurrenceRule === 'daily' ? 1 : 7 // 毎日なら1日、毎週なら7日
        
        currentDate.setDate(currentDate.getDate() + interval)
        
        while (currentDate <= endDate) {
          const childStart = new Date(currentDate)
          childStart.setHours(hours, minutes, 0, 0)
          
          const childEnd = new Date(childStart)
          childEnd.setMinutes(childEnd.getMinutes() + duration)

          reservationsToCreate.push({
            room_id: room.id,
            user_id: user.id,
            title,
            description,
            start_time: childStart.toISOString(),
            end_time: childEnd.toISOString(),
            is_recurring: true,
            recurrence_rule: recurrenceRule,
            parent_reservation_id: parentId,
          })

          currentDate.setDate(currentDate.getDate() + interval)
        }

        // 子予約を一括挿入
        if (reservationsToCreate.length > 0) {
          const { error: childError } = await supabase
            .from('reservations')
            .insert(reservationsToCreate)

          if (childError) throw childError
        }

        const totalCount = reservationsToCreate.length + 1
        alert(`${totalCount}件の予約を作成しました`)
      } else {
        // 単発予約の場合
        const { error } = await supabase
          .from('reservations')
          .insert([{
            room_id: room.id,
            user_id: user.id,
            title,
            description,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
          }])

        if (error) throw error
      }

      onSave()
    } catch (error) {
      console.error('Error creating reservation:', error)
      alert('予約の作成に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (deleteAll = false) => {
    const isRecurringReservation = reservation?.is_recurring
    const parentId = reservation?.parent_reservation_id || reservation?.id
    
    let confirmMessage = 'この予約を取り消しますか？'
    if (isRecurringReservation && deleteAll) {
      confirmMessage = 'この繰り返し予約をすべて取り消しますか？'
    }
    
    if (!window.confirm(confirmMessage)) {
      return
    }

    setDeleting(true)

    try {
      if (isRecurringReservation && deleteAll) {
        // 繰り返し予約を全て削除
        // 親予約を特定（自身が親の場合は自身のID、子の場合はparent_reservation_id）
        const actualParentId = reservation.parent_reservation_id || reservation.id
        
        // 子予約を削除
        const { error: childError } = await supabase
          .from('reservations')
          .delete()
          .eq('parent_reservation_id', actualParentId)
        
        if (childError) throw childError
        
        // 親予約を削除
        const { error: parentError } = await supabase
          .from('reservations')
          .delete()
          .eq('id', actualParentId)
        
        if (parentError) throw parentError
      } else {
        // 単発削除
        const { error } = await supabase
          .from('reservations')
          .delete()
          .eq('id', reservation.id)

        if (error) throw error
      }

      onSave()
    } catch (error) {
      console.error('Error deleting reservation:', error)
      alert('予約の取り消しに失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {/* オーバーレイ */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-50"
      />

      {/* モーダル */}
      <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md backdrop-blur-xl rounded-3xl shadow-2xl border p-6 ${
        isDark
          ? 'bg-gray-900/90 border-gray-800/50'
          : 'bg-white/90 border-gray-200/50'
      }`}>
        <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {isExisting ? '予約の詳細' : '会議室を予約'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              タイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="会議のタイトル"
              disabled={isExisting}
              className={`w-full px-4 py-2 rounded-xl border ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-gray-50 border-gray-200 text-gray-900'
              } ${isExisting ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              説明（任意）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="会議の説明"
              rows={3}
              disabled={isExisting}
              className={`w-full px-4 py-2 rounded-xl border ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-gray-50 border-gray-200 text-gray-900'
              } ${isExisting ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                開始時刻
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                step="1800"
                disabled={isExisting}
                className={`w-full px-4 py-2 rounded-xl border ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-900'
                } ${isExisting ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                時間
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={isExisting}
                className={`w-full px-4 py-2 rounded-xl border ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-900'
                } ${isExisting ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <option value={30}>30分</option>
                <option value={60}>1時間</option>
                <option value={90}>1.5時間</option>
                <option value={120}>2時間</option>
                <option value={180}>3時間</option>
              </select>
            </div>
          </div>

          {/* 繰り返し予約オプション（新規作成時のみ） */}
          {!isExisting && (
            <div className={`p-4 rounded-xl border ${
              isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
            }`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-5 h-5 rounded text-blue-500"
                />
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  🔄 定期予約（固定枠）
                </span>
              </label>

              {isRecurring && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      繰り返し
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRecurrenceRule('daily')}
                        className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all ${
                          recurrenceRule === 'daily'
                            ? isDark
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-500 text-white'
                            : isDark
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        毎日
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecurrenceRule('weekly')}
                        className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all ${
                          recurrenceRule === 'weekly'
                            ? isDark
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-500 text-white'
                            : isDark
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        毎週（同じ曜日）
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      終了日
                    </label>
                    <input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      min={new Date(date).toISOString().split('T')[0]}
                      className={`w-full px-4 py-2 rounded-xl border ${
                        isDark
                          ? 'bg-gray-800 border-gray-700 text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-900'
                      }`}
                    />
                    <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      この日まで{recurrenceRule === 'daily' ? '毎日' : '毎週'}予約を作成します
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 既存予約の場合は予約者情報を表示 */}
          {isExisting && reservation && (
            <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                予約者
              </div>
              <div className={`${isDark ? 'text-white' : 'text-gray-900'}`}>
                {reservation.user?.name || reservation.user?.email || 'ユーザー'}
              </div>
              {reservation.is_recurring && (
                <div className={`mt-2 flex items-center gap-2 text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  <span>🔄</span>
                  <span>
                    定期予約（{reservation.recurrence_rule === 'daily' ? '毎日' : '毎週'}）
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-4">
            {isExisting ? (
              <>
                {reservation?.user_id === user?.id && reservation?.is_recurring && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(false)}
                      disabled={deleting}
                      className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        isDark
                          ? 'bg-orange-600 text-white hover:bg-orange-700'
                          : 'bg-orange-500 text-white hover:bg-orange-600'
                      } disabled:opacity-50`}
                    >
                      この予約のみ取り消し
                    </button>
                    <button
                      onClick={() => handleDelete(true)}
                      disabled={deleting}
                      className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        isDark
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-red-500 text-white hover:bg-red-600'
                      } disabled:opacity-50`}
                    >
                      すべて取り消し
                    </button>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
                      isDark
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    閉じる
                  </button>
                  {reservation?.user_id === user?.id && !reservation?.is_recurring && (
                    <button
                      onClick={() => handleDelete(false)}
                      disabled={deleting}
                      className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
                        isDark
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-red-500 text-white hover:bg-red-600'
                      } disabled:opacity-50`}
                    >
                      {deleting ? '取り消し中...' : '予約取り消し'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
                    isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
                    isDark
                      ? 'bg-white text-gray-900 hover:bg-gray-100'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  } disabled:opacity-50`}
                >
                  {saving ? '保存中...' : isRecurring ? '定期予約を作成' : '予約する'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
