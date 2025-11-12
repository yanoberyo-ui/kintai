import React, { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { calculateProgress } from '../utils/todo'

export default function MembersPage({ isDark }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberTasks, setMemberTasks] = useState(null)
  const [memberAttendance, setMemberAttendance] = useState(null)
  const [attendanceStatus, setAttendanceStatus] = useState({})
  const [taskProgress, setTaskProgress] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [birthdayNotifications, setBirthdayNotifications] = useState({ today: [], tomorrow: [] })
  const [showBirthdayPopup, setShowBirthdayPopup] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    loadCurrentUser()
    loadMembers()
    loadAttendanceStatus()
    loadAllTaskProgress()
  }, [])

  useEffect(() => {
    if (members.length > 0 && currentUser) {
      checkBirthdays()
    }
  }, [members, currentUser])

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      setCurrentUser(data)
    }
  }

  const checkBirthdays = () => {
    // attendance.jsと同じ方法で日付を取得
    const now = new Date()
    const today = new Date(now.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayBirthdays = []
    const tomorrowBirthdays = []
    let isCurrentUserBirthday = false

    members.forEach(member => {
      if (!member.birthday) return

      const birthday = new Date(member.birthday)
      const birthdayThisYear = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate())
      const tomorrowDate = new Date(today.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())

      // 今日が誕生日
      if (birthdayThisYear.toDateString() === today.toDateString()) {
        if (member.id === currentUser?.id) {
          isCurrentUserBirthday = true
        } else {
          todayBirthdays.push(member)
        }
      }
      // 明日が誕生日
      else if (birthdayThisYear.toDateString() === tomorrowDate.toDateString()) {
        tomorrowBirthdays.push(member)
      }
    })

    setBirthdayNotifications({ today: todayBirthdays, tomorrow: tomorrowBirthdays })
    
    // ポップアップは自動で表示しない（出勤ボタン押下時に表示）
  }

  useEffect(() => {
    if (selectedMember) {
      loadMemberTasks(selectedMember.id)
      loadMemberAttendance(selectedMember.id)
    }
  }, [selectedMember])

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error
      setMembers(data || [])
    } catch (error) {
      console.error('Error loading members:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAttendanceStatus = async () => {
    try {
      // attendance.jsと同じ方法で日付を取得
      const now = new Date()
      const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
      const today = jstDate.toISOString().split('T')[0]
      
      console.log('========== ATTENDANCE STATUS DEBUG ==========')
      console.log('Current UTC time:', now.toISOString())
      console.log('JST time calculated:', jstDate.toISOString())
      console.log('Today date string:', today)
      console.log('Date type:', typeof today)

      const { data, error } = await supabase
        .from('attendances')
        .select('user_id, status, clock_in, clock_out, date')

      if (error) throw error
      
      console.log('All attendance records:', JSON.stringify(data, null, 2))
      console.log('Total records:', data?.length)

      const statusMap = {}
      data?.forEach((record, index) => {
        console.log(`
--- Record ${index + 1} ---`)
        console.log('  date:', record.date, 'type:', typeof record.date)
        console.log('  today:', today, 'type:', typeof today)
        console.log('  strict match (===):', record.date === today)
        console.log('  loose match (==):', record.date == today)
        console.log('  includes today:', record.date?.includes?.(today))
        
        // より柔軟なマッチング
        const recordDateStr = String(record.date).split('T')[0]
        console.log('  record date (normalized):', recordDateStr)
        console.log('  normalized match:', recordDateStr === today)
        
        if (recordDateStr === today) {
          console.log('  ✓ MATCH! Adding to statusMap')
          statusMap[record.user_id] = {
            status: record.status,
            clock_in: record.clock_in,
            clock_out: record.clock_out
          }
        }
      })
      console.log('Final statusMap:', statusMap)
      console.log('========== END DEBUG ==========')
      setAttendanceStatus(statusMap)
    } catch (error) {
      console.error('Error loading attendance status:', error)
    }
  }

  const loadAllTaskProgress = async () => {
    try {
      // attendance.jsと同じ方法で日付を取得
      const now = new Date()
      const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
      const today = jstDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('todo_lists')
        .select(`
          user_id,
          todo_items (is_completed)
        `)
        .eq('date', today)

      if (error) throw error

      const progressMap = {}
      data?.forEach(list => {
        if (list.todo_items && list.todo_items.length > 0) {
          progressMap[list.user_id] = calculateProgress(list.todo_items)
        } else {
          progressMap[list.user_id] = 0
        }
      })
      setTaskProgress(progressMap)
    } catch (error) {
      console.error('Error loading task progress:', error)
    }
  }

  const loadMemberTasks = async (userId) => {
    try {
      // attendance.jsと同じ方法で日付を取得
      const now = new Date()
      const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
      const today = jstDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('todo_lists')
        .select(`
          *,
          todo_items (*)
        `)
        .eq('user_id', userId)
        .eq('date', today)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setMemberTasks(data)
    } catch (error) {
      console.error('Error loading member tasks:', error)
      setMemberTasks(null)
    }
  }

  const loadMemberAttendance = async (userId) => {
    try {
      // attendance.jsと同じ方法で日付を取得
      const now = new Date()
      const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
      const today = jstDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setMemberAttendance(data)
    } catch (error) {
      console.error('Error loading member attendance:', error)
      setMemberAttendance(null)
    }
  }

  const handleMemberClick = (member) => {
    setSelectedMember(member)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedMember(null)
    setMemberTasks(null)
    setMemberAttendance(null)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className={`animate-pulse ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          読み込み中...
        </div>
      </div>
    )
  }

  return (
    <>
      {/* クラッカーアニメーション（本人の誕生日） */}
      {showBirthdayPopup && isCurrentUserBirthday && <ConfettiAnimation />}

      {/* 誕生日ポップアップ */}
      {showBirthdayPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowBirthdayPopup(false)}
        >
          <div
            className={`max-w-md w-full rounded-3xl shadow-2xl border p-8 ${
              isDark
                ? 'bg-gray-900/95 border-gray-800/50'
                : 'bg-white/95 border-gray-200/50'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              {isCurrentUserBirthday ? (
                <>
                  <h2 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    誕生日おめでとうございます！
                  </h2>
                  <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    素敵な一年になりますように
                  </p>
                </>
              ) : (
                <>
                  <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    今日は
                    {birthdayNotifications.today.map((member, index) => (
                      <span key={member.id}>
                        {index > 0 && '、'}
                        <span className="text-blue-500">{member.name || member.email.split('@')[0]}</span>
                        さん
                      </span>
                    ))}
                    のお誕生日です！
                  </h2>
                  <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    お祝いしましょう！
                  </p>
                </>
              )}
              <button
                onClick={() => setShowBirthdayPopup(false)}
                className={`mt-6 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isDark
                    ? 'bg-white text-gray-900 hover:bg-gray-100'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
      {/* ページタイトル */}
      <div className="mb-6">
        <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          メンバー
        </h1>
        <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          チームメンバーと今日のタスクを確認
        </p>
      </div>

      {/* 明日の誕生日通知 */}
      {birthdayNotifications.tomorrow.length > 0 && (
        <div className={`mb-6 backdrop-blur-xl rounded-3xl shadow-lg border p-6 transition-colors duration-500 ${
          isDark
            ? 'bg-gradient-to-r from-purple-900/80 to-pink-900/80 shadow-black/50 border-purple-800/50'
            : 'bg-gradient-to-r from-purple-100/80 to-pink-100/80 shadow-purple-200/50 border-purple-200/50'
        }`}>
          <div className="flex items-center gap-4">
            <div className="text-4xl">🎂</div>
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                明日は
                {birthdayNotifications.tomorrow.map((member, index) => (
                  <span key={member.id}>
                    {index > 0 && '、'}
                    <span className={isDark ? 'text-purple-300' : 'text-purple-700'}>
                      {member.name || member.email.split('@')[0]}
                    </span>
                    さん
                  </span>
                ))}
                のお誕生日です！
              </h3>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                準備をお忘れなく
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ギャラリービュー */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {members.map((member) => {
          const progress = taskProgress[member.id] ?? 0
          return (
            <button
              key={member.id}
              onClick={() => handleMemberClick(member)}
              className={`backdrop-blur-xl rounded-3xl shadow-lg border p-6 transition-all duration-200 hover:scale-105 ${
                isDark
                  ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50 hover:bg-gray-800/80'
                  : 'bg-white/80 shadow-gray-200/50 border-gray-200/50 hover:bg-white/90'
              }`}
            >
              {/* アバターと進捗サークル */}
              <div className="relative w-24 h-24 mx-auto mb-4">
                {/* 円形プログレスバー */}
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                  {/* 背景円 */}
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    stroke={isDark ? '#374151' : '#E5E7EB'}
                    strokeWidth="6"
                    fill="none"
                  />
                  {/* 進捗円 */}
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    stroke={isDark ? '#FFFFFF' : '#111827'}
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                {/* アバター */}
                <div className={`absolute inset-2 rounded-full flex items-center justify-center text-2xl font-bold text-white ${
                  isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600' : 'bg-gradient-to-br from-gray-800 to-gray-700'
                }`}>
                  {member.email.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* 進捗パーセント */}
              <div className={`text-xs font-bold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {progress}%
              </div>

              {/* 名前 */}
              <h3 className={`text-lg font-bold mb-1 truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {member.name || member.email.split('@')[0]}
              </h3>

              {/* 部署 */}
              <p className={`text-sm mb-3 truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {member.department || 'なし'}
              </p>

              {/* 出勤ステータス */}
              <div className="flex justify-center">
                {(() => {
                  const attendance = attendanceStatus[member.id]
                  
                  // 勤怠レコードがない場合
                  if (!attendance) {
                    return (
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-200 text-gray-500'
                      }`}>
                        未出勤
                      </div>
                    )
                  }
                  
                  // clock_outがある場合は退勤済
                  if (attendance.clock_out) {
                    return (
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        isDark
                          ? 'bg-blue-900/50 text-blue-300'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        退勤済
                      </div>
                    )
                  }
                  
                  // statusで判定
                  if (attendance.status === 'working') {
                    return (
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        isDark
                          ? 'bg-white text-gray-900'
                          : 'bg-gray-900 text-white'
                      }`}>
                        出勤中
                      </div>
                    )
                  }
                  
                  if (attendance.status === 'break') {
                    return (
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        isDark
                          ? 'bg-gray-300 text-gray-900'
                          : 'bg-gray-500 text-white'
                      }`}>
                        休憩中
                      </div>
                    )
                  }
                  
                  if (attendance.status === 'completed') {
                    return (
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        isDark
                          ? 'bg-blue-900/50 text-blue-300'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        退勤済
                      </div>
                    )
                  }
                  
                  // 不明なステータス
                  return (
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                      isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-300 text-gray-700'
                    }`}>
                      不明({attendance.status})
                    </div>
                  )
                })()}
              </div>
            </button>
          )
        })}
      </div>

      {/* モーダル */}
      {showModal && selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className={`max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border ${
              isDark
                ? 'bg-gray-900/95 border-gray-800/50'
                : 'bg-white/95 border-gray-200/50'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div className={`sticky top-0 z-10 backdrop-blur-xl border-b p-6 ${
              isDark ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white ${
                    isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600' : 'bg-gradient-to-br from-gray-800 to-gray-700'
                  }`}>
                    {selectedMember.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {selectedMember.name || selectedMember.email.split('@')[0]}
                    </h2>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedMember.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className={`p-2 rounded-xl transition-colors ${
                    isDark
                      ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* モーダルコンテンツ */}
            <div className="p-6 space-y-6">
              {/* 勤怠カード */}
              <div className={`backdrop-blur-xl rounded-3xl shadow-lg border p-6 ${
                isDark
                  ? 'bg-gray-800/50 border-gray-700/50'
                  : 'bg-gray-50/50 border-gray-200/50'
              }`}>
                <div className="text-center">
                  <div className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {memberAttendance?.status === 'working' ? '出勤中' :
                     memberAttendance?.status === 'break' ? '休憩中' :
                     memberAttendance?.status === 'completed' ? '退勤済' : '未出勤'}
                  </div>
                  <div className={`text-5xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {(() => {
                      if (!memberAttendance?.clock_in) return '0:00'
                      
                      try {
                        // attendance.jsと同じ方法で日付を取得
                        const now = new Date()
                        const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
                        const today = jstDate.toISOString().split('T')[0]
                        
                        const clockInTime = memberAttendance.clock_in.includes('T') 
                          ? memberAttendance.clock_in.split('T')[1] 
                          : memberAttendance.clock_in
                        
                        const clockIn = new Date(`${today}T${clockInTime}`)
                        
                        let clockOut
                        if (memberAttendance.clock_out) {
                          const clockOutTime = memberAttendance.clock_out.includes('T')
                            ? memberAttendance.clock_out.split('T')[1]
                            : memberAttendance.clock_out
                          clockOut = new Date(`${today}T${clockOutTime}`)
                        } else {
                          clockOut = jstDate
                        }
                        
                        const diff = clockOut - clockIn
                        if (diff < 0 || isNaN(diff)) return '0:00'
                        
                        const hours = Math.floor(diff / 3600000)
                        const minutes = Math.floor((diff % 3600000) / 60000)
                        return `${hours}:${minutes.toString().padStart(2, '0')}`
                      } catch (e) {
                        console.error('Error calculating work time:', e)
                        return '0:00'
                      }
                    })()}
                  </div>
                  <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    勤務時間
                  </div>
                </div>
              </div>

              {/* TODOリスト */}
              <div className={`backdrop-blur-xl rounded-3xl shadow-lg border ${
                isDark
                  ? 'bg-gray-800/50 border-gray-700/50'
                  : 'bg-gray-50/50 border-gray-200/50'
              }`}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/')}のToDo
                    </h3>
                    {memberTasks?.todo_items && memberTasks.todo_items.length > 0 && (
                      <div className={`px-4 py-2 rounded-full font-bold text-lg ${
                        calculateProgress(memberTasks.todo_items) >= 70
                          ? isDark
                            ? 'bg-white text-gray-900'
                            : 'bg-gray-900 text-white'
                          : calculateProgress(memberTasks.todo_items) >= 40
                          ? isDark
                            ? 'bg-gray-300 text-gray-900'
                            : 'bg-gray-700 text-white'
                          : isDark
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-300 text-gray-700'
                      }`}>
                        {calculateProgress(memberTasks.todo_items)}%
                      </div>
                    )}
                  </div>

                  {memberTasks?.todo_items && memberTasks.todo_items.length > 0 ? (
                    <div className="space-y-2">
                      {memberTasks.todo_items
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-3 p-3 rounded-xl ${
                              isDark ? 'bg-gray-900/50' : 'bg-white/50'
                            }`}
                          >
                            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                              item.is_completed
                                ? isDark
                                  ? 'bg-gray-700 text-white'
                                  : 'bg-gray-300 text-gray-700'
                                : isDark
                                ? 'bg-white text-gray-900'
                                : 'bg-gray-900 text-white'
                            }`}>
                              {item.is_completed ? (
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <span className="text-xs font-bold transform -rotate-90">▼</span>
                              )}
                            </div>
                            <span className={`flex-1 text-sm ${
                              item.is_completed
                                ? isDark ? 'text-gray-600 line-through' : 'text-gray-400 line-through'
                                : isDark ? 'text-gray-100' : 'text-gray-900'
                            }`}>
                              {item.content}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p>今日のタスクはまだありません</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

// クラッカーアニメーションコンポーネント（TodoListから再利用）
function ConfettiAnimation() {
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 2,
    rotation: Math.random() * 360,
    color: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3'][Math.floor(Math.random() * 7)]
  }))

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute w-3 h-3 animate-confetti-fall"
          style={{
            left: `${piece.left}%`,
            top: '-5%',
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${piece.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}