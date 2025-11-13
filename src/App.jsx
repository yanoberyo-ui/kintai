import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import TodoList from './components/TodoList'
import AttendanceCard from './components/AttendanceCard'
import CalendarPage from './components/CalendarPage'
import SettingsPage from './components/SettingsPage'
import MembersPage from './components/MembersPage'
import PomodoroPage from './components/PomodoroPage'
import ReservationsPage from './components/ReservationsPage'
import AnnouncementsPage from './components/AnnouncementsPage'
import AdminPage from './components/AdminPage'
import { getStreaks } from './utils/streaks'
import { getHeatmapData } from './utils/heatmap'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  // リロード時にも現在のページを保持
  const [currentPage, setCurrentPage] = useState(() => {
    return localStorage.getItem('currentPage') || 'home'
  })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [streaks, setStreaks] = useState({ attendanceStreak: 0, todoStreak: 0 })
  const [heatmapData, setHeatmapData] = useState([])

  // currentPageが変更されたらlocalStorageに保存
  useEffect(() => {
    localStorage.setItem('currentPage', currentPage)
  }, [currentPage])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [othersMenuOpen, setOthersMenuOpen] = useState(false)
  const [eventNotification, setEventNotification] = useState(null)
  const [todayEventNotification, setTodayEventNotification] = useState(null)
  const [followUpNotification, setFollowUpNotification] = useState(null)

  // データ読み込み関数（useEffectより前に定義）
  const loadStreaks = async (userId) => {
    try {
      const data = await getStreaks(userId)
      setStreaks(data)
    } catch (error) {
      console.error('Error loading streaks:', error)
    }
  }

  const loadHeatmapData = async (userId) => {
    try {
      const data = await getHeatmapData(userId)
      setHeatmapData(data)
    } catch (error) {
      console.error('Error loading heatmap data:', error)
    }
  }

  // 17:00以降かどうかをチェック
  useEffect(() => {
    const checkTime = () => {
      const hour = new Date().getHours()
      setIsDark(hour >= 17 || hour < 6) // 17:00-翌6:00はダークモード
    }

    checkTime()
    const timer = setInterval(checkTime, 60000) // 1分ごとにチェック

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    // セッションチェック
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('Session check:', session?.user ? 'User found' : 'No user')
      if (session?.user) {
        // usersテーブルから完全なユーザー情報を取得
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        console.log('User data:', userData, 'Error:', error)
        setUser(userData || session.user)
        loadStreaks(session.user.id)
        loadHeatmapData(session.user.id)
      } else {
        setUser(null)
      }
      console.log('Setting loading to false')
      setLoading(false)
    }).catch(err => {
      console.error('Session error:', err)
      setLoading(false)
    })

    // 認証状態の変更を監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        // usersテーブルから完全なユーザー情報を取得
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        setUser(userData || session.user)
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // イベント作成のリアルタイム監視
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('announcements-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements',
          filter: 'category=eq.event'
        },
        async (payload) => {
          const newEvent = payload.new

          // 投票期限があり、かつ日程投票がある場合のみ通知
          if (newEvent.voting_deadline) {
            // イベント作成者の情報を取得
            const { data: author } = await supabase
              .from('users')
              .select('name, email')
              .eq('id', newEvent.author_id)
              .single()

            setEventNotification({
              ...newEvent,
              author
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  // 当日のイベント通知チェック
  useEffect(() => {
    if (!user?.id) return

    const checkTodayEvents = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // 今日のイベントで参加登録済みのものを取得
      const { data: todayEvents } = await supabase
        .from('announcements')
        .select(`
          *,
          author:users!announcements_author_id_fkey (
            id,
            name,
            email
          ),
          participants:announcement_participants!inner (
            user_id
          )
        `)
        .eq('category', 'event')
        .eq('participants.user_id', user.id)
        .gte('event_date', today.toISOString())
        .lt('event_date', tomorrow.toISOString())

      // まだ通知していないイベントがあれば表示
      if (todayEvents && todayEvents.length > 0) {
        const notifiedEvents = JSON.parse(localStorage.getItem('notifiedTodayEvents') || '[]')
        const unnotifiedEvent = todayEvents.find(event => !notifiedEvents.includes(event.id))

        if (unnotifiedEvent) {
          setTodayEventNotification(unnotifiedEvent)
          // 通知済みとしてマーク
          localStorage.setItem('notifiedTodayEvents', JSON.stringify([...notifiedEvents, unnotifiedEvent.id]))
        }
      }
    }

    checkTodayEvents()
    // 1時間ごとにチェック
    const interval = setInterval(checkTodayEvents, 60 * 60 * 1000)

    return () => clearInterval(interval)
  }, [user])

  // フォローアップメッセージのリアルタイム監視
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('follow-up-messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_follow_up_messages'
        },
        async (payload) => {
          const message = payload.new

          // 自分が対象かどうかチェック
          const { data: announcement } = await supabase
            .from('announcements')
            .select(`
              *,
              participants:announcement_participants!inner(user_id),
              date_options:event_date_options(
                id,
                votes:event_date_votes!inner(user_id)
              )
            `)
            .eq('id', message.announcement_id)
            .single()

          if (!announcement) return

          let isTarget = false

          if (message.target_type === 'all_participants') {
            // 全参加者が対象
            isTarget = announcement.participants.some(p => p.user_id === user.id)
          } else if (message.target_type === 'date_option_voters' && message.date_option_id) {
            // 特定の日程に投票した人のみが対象
            const dateOption = announcement.date_options?.find(opt => opt.id === message.date_option_id)
            isTarget = dateOption?.votes?.some(v => v.user_id === user.id) || false
          }

          if (isTarget) {
            setFollowUpNotification({
              ...message,
              announcement
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark
          ? 'bg-gradient-to-br from-gray-900 to-black'
          : 'bg-gradient-to-br from-gray-50 to-gray-100'
      }`}>
        <div className={`animate-pulse text-lg font-light ${
          isDark ? 'text-gray-500' : 'text-gray-400'
        }`}>Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen isDark={isDark} />
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${
      isDark
        ? 'bg-gradient-to-br from-gray-900 via-black to-gray-900'
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-50'
    }`}>
      {/* ヘッダー */}
      <header className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b transition-colors duration-500 safe-top ${
        isDark
          ? 'bg-gray-900/70 border-gray-800/50'
          : 'bg-white/70 border-gray-200/50'
      }`}>
        <div className="px-6 py-4 flex items-center gap-4">
          {/* ハンバーガーメニューボタン (PC only) */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`hidden md:block p-2 rounded-xl transition-colors duration-300 ${
              isDark
                ? 'hover:bg-gray-800/50 text-white'
                : 'hover:bg-gray-100/50 text-gray-900'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* ロゴ */}
          <img
            src="/images/logo.png"
            alt="FD GROUP"
            className={`h-5 transition-all duration-500 ${
              isDark ? '' : 'invert'
            }`}
          />

          {/* ストリークバッジ */}
          {user && (streaks.attendanceStreak > 0 || streaks.todoStreak > 0) && (
            <div className="ml-auto flex items-center gap-2">
              {streaks.attendanceStreak > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white text-gray-600">
                  <span className="text-sm">📅</span>
                  <span>{streaks.attendanceStreak}</span>
                </div>
              )}
              {streaks.todoStreak > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white text-gray-600">
                  <span className="text-sm">🎯</span>
                  <span>{streaks.todoStreak}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* サイドバー (PC) / フッターバー (Mobile) */}
      <aside className={`
        fixed backdrop-blur-xl border transition-all duration-300 z-40
        md:left-0 md:top-[72px] md:bottom-0 md:w-64 md:border-r md:border-b-0
        max-md:left-0 max-md:right-0 max-md:bottom-0 max-md:border-t
        ${sidebarOpen ? 'md:translate-x-0' : 'md:-translate-x-64'}
        ${isDark
          ? 'bg-gray-900/70 border-gray-800/50'
          : 'bg-white/70 border-gray-200/50'
        }`}>
        {/* PC: 縦並び、Mobile: 横並び */}
        <div className="flex md:flex-col h-full md:p-6 p-4">

          {/* ナビゲーション */}
          <nav className="flex md:flex-col flex-1 md:space-y-2 space-x-2 md:space-x-0 justify-around md:justify-start">
            <button
              onClick={() => setCurrentPage('home')}
              className={`md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 ${
                currentPage === 'home'
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <div className="flex md:flex-row flex-col items-center md:gap-3 gap-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="md:inline text-xs md:text-base">ホーム</span>
              </div>
            </button>

            <button
              onClick={() => setCurrentPage('calendar')}
              className={`md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 ${
                currentPage === 'calendar'
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <div className="flex md:flex-row flex-col items-center md:gap-3 gap-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="md:inline text-xs md:text-base">カレンダー</span>
              </div>
            </button>

            <button
              onClick={() => setCurrentPage('members')}
              className={`md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 ${
                currentPage === 'members'
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <div className="flex md:flex-row flex-col items-center md:gap-3 gap-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="md:inline text-xs md:text-base">メンバー</span>
              </div>
            </button>

            <button
              onClick={() => setCurrentPage('announcements')}
              className={`md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 ${
                currentPage === 'announcements'
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <div className="flex md:flex-row flex-col items-center md:gap-3 gap-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
                <span className="md:inline text-xs md:text-base">タイムライン</span>
              </div>
            </button>

            {/* 管理者専用: Adminボタン */}
            {user?.role === 'admin' && (
              <button
                onClick={() => setCurrentPage('admin')}
                className={`md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 ${
                  currentPage === 'admin'
                    ? isDark
                      ? 'bg-white text-gray-900'
                      : 'bg-gray-900 text-white'
                    : isDark
                    ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
              >
                <div className="flex md:flex-row flex-col items-center md:gap-3 gap-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="md:inline text-xs md:text-base">管理者</span>
                </div>
              </button>
            )}

            {/* PC専用: 集中ボタン */}
            <button
              onClick={() => setCurrentPage('pomodoro')}
              className={`hidden md:block md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 ${
                currentPage === 'pomodoro'
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <div className="flex md:flex-row flex-col items-center md:gap-3 gap-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="md:inline text-xs md:text-base">集中</span>
              </div>
            </button>

            {/* PC専用: 予約ボタン */}
            <button
              onClick={() => setCurrentPage('reservations')}
              className={`hidden md:block md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 ${
                currentPage === 'reservations'
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <div className="flex md:flex-row flex-col items-center md:gap-3 gap-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="md:inline text-xs md:text-base">予約</span>
              </div>
            </button>

            {/* モバイル専用: メニューボタン */}
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`md:hidden md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 relative ${
                userMenuOpen || ['pomodoro', 'reservations', 'settings'].includes(currentPage)
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <div className="flex md:flex-row flex-col items-center md:gap-3 gap-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="md:inline text-xs md:text-base">メニュー</span>
              </div>
            </button>
          </nav>

          {/* ヒートマップ (PC only) - 一旦非表示 */}

          {/* ユーザーセクション (PC only) */}
          <div className={`hidden md:block border-t pt-4 space-y-3 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            {/* ユーザー情報 */}
            <button
              onClick={() => setCurrentPage('settings')}
              className={`w-full px-2 py-2 rounded-xl transition-all duration-200 ${
                currentPage === 'settings'
                  ? isDark
                    ? 'bg-gray-800'
                    : 'bg-gray-100'
                  : isDark
                  ? 'hover:bg-gray-800/50'
                  : 'hover:bg-gray-100/50'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* アバター */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                  isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600' : 'bg-gradient-to-br from-gray-800 to-gray-700'
                }`}>
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                {/* ユーザー名とメール */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {user?.email?.split('@')[0]}
                  </div>
                  <div className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {user?.email}
                  </div>
                </div>
              </div>
            </button>

            {/* ログアウトボタン */}
            <button
              onClick={() => supabase.auth.signOut()}
              className={`w-full px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>ログアウト</span>
              </div>
            </button>
          </div>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className={`pt-24 md:pb-8 pb-32 px-8 transition-all duration-300 ${
        sidebarOpen ? 'md:ml-64' : 'md:ml-0'
      } ml-0`}>
        {currentPage === 'home' ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* 勤怠カード */}
            <AttendanceCard user={user} isDark={isDark} onStreakUpdate={setStreaks} />

            {/* TODOリスト */}
            <TodoList user={user} isDark={isDark} />
          </div>
        ) : currentPage === 'calendar' ? (
          <CalendarPage user={user} isDark={isDark} />
        ) : currentPage === 'members' ? (
          <MembersPage user={user} isDark={isDark} />
        ) : currentPage === 'announcements' ? (
          <AnnouncementsPage user={user} isDark={isDark} />
        ) : currentPage === 'admin' ? (
          <AdminPage isDark={isDark} />
        ) : currentPage === 'pomodoro' ? (
          <PomodoroPage user={user} isDark={isDark} />
        ) : currentPage === 'reservations' ? (
          <ReservationsPage user={user} isDark={isDark} />
        ) : (
          <SettingsPage user={user} isDark={isDark} setIsDark={setIsDark} />
        )}
      </main>

      {/* ユーザーメニューポップアップ */}
      {userMenuOpen && (
        <>
          {/* オーバーレイ */}
          <div
            onClick={() => setUserMenuOpen(false)}
            className="fixed inset-0 z-40"
          />
          
          {/* メニュー */}
          <div className={`fixed bottom-24 md:bottom-auto md:right-8 md:top-24 left-1/2 md:left-auto -translate-x-1/2 md:translate-x-0 z-50 w-64 backdrop-blur-xl rounded-2xl shadow-2xl border overflow-hidden animate-genie-in ${
            isDark
              ? 'bg-gray-900/90 border-gray-800/50'
              : 'bg-white/90 border-gray-200/50'
          }`}>
            {/* ユーザー情報 */}
            <div className={`px-4 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                  isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600' : 'bg-gradient-to-br from-gray-800 to-gray-700'
                }`}>
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {user?.email}
                  </div>
                </div>
              </div>
            </div>

            {/* メニューアイテム */}
            <div className="p-2">
              <button
                onClick={() => {
                  setCurrentPage('pomodoro')
                  setUserMenuOpen(false)
                }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                  currentPage === 'pomodoro'
                    ? isDark
                      ? 'bg-white/10 text-white'
                      : 'bg-gray-900/10 text-gray-900'
                    : isDark
                    ? 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-100/50 hover:text-gray-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>集中</span>
              </button>

              <button
                onClick={() => {
                  setCurrentPage('reservations')
                  setUserMenuOpen(false)
                }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                  currentPage === 'reservations'
                    ? isDark
                      ? 'bg-white/10 text-white'
                      : 'bg-gray-900/10 text-gray-900'
                    : isDark
                    ? 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-100/50 hover:text-gray-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>予約</span>
              </button>

              <button
                onClick={() => {
                  setCurrentPage('settings')
                  setUserMenuOpen(false)
                }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                  currentPage === 'settings'
                    ? isDark
                      ? 'bg-white/10 text-white'
                      : 'bg-gray-900/10 text-gray-900'
                    : isDark
                    ? 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-100/50 hover:text-gray-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>設定</span>
              </button>

              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  setUserMenuOpen(false)
                }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                  isDark
                    ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
                    : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>ログアウト</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* イベント投票通知ポップアップ */}
      {eventNotification && (
        <>
          {/* オーバーレイ */}
          <div
            onClick={() => setEventNotification(null)}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
          />

          {/* ポップアップ */}
          <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-11/12 max-w-md backdrop-blur-xl rounded-3xl shadow-2xl border overflow-hidden animate-scale-in ${
            isDark
              ? 'bg-gray-900/95 border-gray-800/50'
              : 'bg-white/95 border-gray-200/50'
          }`}>
            {/* ヘッダー */}
            <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">🎉</div>
                  <div>
                    <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      新しいイベント！
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      投票が必要です
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEventNotification(null)}
                  className={`p-2 rounded-full transition-colors ${
                    isDark
                      ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* コンテンツ */}
            <div className="p-6 space-y-4">
              <div>
                <h4 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {eventNotification.title}
                </h4>
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {eventNotification.content}
                </p>
              </div>

              {eventNotification.voting_deadline && (
                <div className={`flex items-center gap-2 text-sm p-3 rounded-xl ${
                  isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'
                }`}>
                  <span>⏰</span>
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    投票期限: {new Date(eventNotification.voting_deadline).toLocaleString('ja-JP', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}

              {eventNotification.author && (
                <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span>投稿者:</span>
                  <span>{eventNotification.author.name || eventNotification.author.email.split('@')[0]}</span>
                </div>
              )}
            </div>

            {/* アクション */}
            <div className={`px-6 py-4 border-t flex gap-3 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <button
                onClick={() => setEventNotification(null)}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                後で
              </button>
              <button
                onClick={() => {
                  setCurrentPage('announcements')
                  setEventNotification(null)
                }}
                className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all duration-200 ${
                  isDark
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
                }`}
              >
                今すぐ投票
              </button>
            </div>
          </div>
        </>
      )}

      {/* イベント当日通知ポップアップ */}
      {todayEventNotification && (
        <>
          {/* オーバーレイ */}
          <div
            onClick={() => setTodayEventNotification(null)}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
          />

          {/* ポップアップ */}
          <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-11/12 max-w-md backdrop-blur-xl rounded-3xl shadow-2xl border overflow-hidden animate-scale-in ${
            isDark
              ? 'bg-gray-900/95 border-gray-800/50'
              : 'bg-white/95 border-gray-200/50'
          }`}>
            {/* ヘッダー */}
            <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">📅</div>
                  <div>
                    <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      今日はイベント当日！
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      参加登録済みのイベントです
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTodayEventNotification(null)}
                  className={`p-2 rounded-full transition-colors ${
                    isDark
                      ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* コンテンツ */}
            <div className="p-6 space-y-4">
              <div>
                <h4 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {todayEventNotification.title}
                </h4>
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {todayEventNotification.content}
                </p>
              </div>

              {todayEventNotification.event_date && (
                <div className={`flex items-center gap-2 text-sm p-3 rounded-xl ${
                  isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'
                }`}>
                  <span>⏰</span>
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    開始時刻: {new Date(todayEventNotification.event_date).toLocaleString('ja-JP', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}

              {todayEventNotification.event_location && (
                <div className={`flex items-center gap-2 text-sm p-3 rounded-xl ${
                  isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'
                }`}>
                  <span>📍</span>
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    場所: {todayEventNotification.event_location}
                  </span>
                </div>
              )}

              {todayEventNotification.participants_only_message && (
                <div className={`p-3 rounded-xl ${
                  isDark ? 'bg-purple-900/30 border border-purple-700/50' : 'bg-purple-50 border border-purple-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">🔒</span>
                    <span className={`text-xs font-bold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                      参加者へのメッセージ
                    </span>
                  </div>
                  <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-purple-200' : 'text-purple-900'}`}>
                    {todayEventNotification.participants_only_message}
                  </p>
                </div>
              )}
            </div>

            {/* アクション */}
            <div className={`px-6 py-4 border-t flex gap-3 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <button
                onClick={() => setTodayEventNotification(null)}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                閉じる
              </button>
              <button
                onClick={() => {
                  setCurrentPage('announcements')
                  setTodayEventNotification(null)
                }}
                className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all duration-200 ${
                  isDark
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700'
                }`}
              >
                詳細を見る
              </button>
            </div>
          </div>
        </>
      )}

      {/* フォローアップメッセージ通知ポップアップ */}
      {followUpNotification && (
        <>
          {/* オーバーレイ */}
          <div
            onClick={() => setFollowUpNotification(null)}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
          />

          {/* ポップアップ */}
          <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-11/12 max-w-md backdrop-blur-xl rounded-3xl shadow-2xl border overflow-hidden animate-scale-in ${
            isDark
              ? 'bg-gray-900/95 border-gray-800/50'
              : 'bg-white/95 border-gray-200/50'
          }`}>
            {/* ヘッダー */}
            <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">💬</div>
                  <div>
                    <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      新着メッセージ
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {followUpNotification.announcement?.title}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setFollowUpNotification(null)}
                  className={`p-2 rounded-full transition-colors ${
                    isDark
                      ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* コンテンツ */}
            <div className="p-6 space-y-4">
              <div className={`p-4 rounded-xl ${
                isDark ? 'bg-green-900/20 border border-green-700/30' : 'bg-green-50 border border-green-200'
              }`}>
                <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-green-100' : 'text-green-900'}`}>
                  {followUpNotification.message}
                </p>
              </div>

              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {followUpNotification.target_type === 'all_participants' ? (
                  <p>📢 全参加者へのメッセージ</p>
                ) : (
                  <p>🎯 特定の日程に投票した方へのメッセージ</p>
                )}
              </div>
            </div>

            {/* アクション */}
            <div className={`px-6 py-4 border-t flex gap-3 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <button
                onClick={() => setFollowUpNotification(null)}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                閉じる
              </button>
              <button
                onClick={() => {
                  setCurrentPage('announcements')
                  setFollowUpNotification(null)
                }}
                className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all duration-200 ${
                  isDark
                    ? 'bg-white text-gray-900 hover:bg-gray-100'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                イベントを見る
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  )
}

function LoginScreen({ isDark }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [slackId, setSlackId] = useState('')
  const [department, setDepartment] = useState('')
  const [birthday, setBirthday] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    }

    setLoading(false)
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // 1. Supabase Authでユーザー作成
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      // authDataが正しく返されているか確認
      if (!authData?.user?.id) {
        throw new Error('ユーザー登録に失敗しました。もう一度お試しください。')
      }

      // 2. 既存のユーザーレコードをチェック
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', authData.user.id)
        .maybeSingle()

      // SELECTエラーがある場合はスルー（RLSでブロックされている可能性）
      // 3. ユーザーレコードが存在しない場合のみ挿入
      if (!existingUser) {
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            {
              id: authData.user.id,
              email: email,
              name: name,
              slack_user_id: slackId,
              role: 'user',
              department: department || null,
              birthday: birthday || null,
            },
          ])

        if (insertError) {
          // 既に存在する場合のエラーは無視（別のタブで登録完了した可能性）
          if (!insertError.message.includes('duplicate') && !insertError.message.includes('already exists')) {
            throw insertError
          }
        }
      }

      alert('登録完了！ログインしてください。')
      setIsSignUp(false)
      setName('')
      setSlackId('')
      setDepartment('')
      setBirthday('')
    } catch (error) {
      console.error('Sign up error:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 transition-colors duration-500 ${
      isDark
        ? 'bg-gradient-to-br from-gray-900 via-black to-gray-900'
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-50'
    }`}>
      <div className="w-full max-w-md">
        {/* ロゴ */}
        <div className="text-center mb-12">
          <img
            src="/images/logo.png"
            alt="FD GROUP"
            className={`h-12 mx-auto mb-4 transition-all duration-500 ${
              isDark ? '' : 'invert'
            }`}
          />
          <p className={`font-light ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            勤怠管理システム
          </p>
        </div>

        {/* ログイン/サインアップカード */}
        <div className={`backdrop-blur-xl rounded-3xl shadow-2xl border p-8 transition-colors duration-500 ${
          isDark
            ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
            : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
        }`}>
          {/* タブ切り替え */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                !isSignUp
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ログイン
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                isSignUp
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              新規登録
            </button>
          </div>

          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-6">
            {isSignUp && (
              <>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    氏名
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none font-light ${
                      isDark
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                        : 'bg-gray-50/50 border-gray-200 text-gray-900 focus:border-gray-400'
                    }`}
                    placeholder="山田太郎"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Slack ID
                  </label>
                  <input
                    type="text"
                    value={slackId}
                    onChange={(e) => setSlackId(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none font-light ${
                      isDark
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                        : 'bg-gray-50/50 border-gray-200 text-gray-900 focus:border-gray-400'
                    }`}
                    placeholder="U01234ABCDE"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    部署（任意）
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none font-light ${
                      isDark
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                        : 'bg-gray-50/50 border-gray-200 text-gray-900 focus:border-gray-400'
                    }`}
                    placeholder="開発部"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    誕生日（任意）
                  </label>
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none font-light ${
                      isDark
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                        : 'bg-gray-50/50 border-gray-200 text-gray-900 focus:border-gray-400'
                    }`}
                  />
                </div>
              </>
            )}

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none font-light ${
                  isDark
                    ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                    : 'bg-gray-50/50 border-gray-200 text-gray-900 focus:border-gray-400'
                }`}
                placeholder="email@example.com"
                required
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none font-light ${
                  isDark
                    ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                    : 'bg-gray-50/50 border-gray-200 text-gray-900 focus:border-gray-400'
                }`}
                placeholder="パスワード"
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl font-light">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full font-medium py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                isDark
                  ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-white/20'
                  : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-900/20'
              }`}
            >
              {loading ? (isSignUp ? '登録中...' : 'ログイン中...') : (isSignUp ? '新規登録' : 'ログイン')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default App
