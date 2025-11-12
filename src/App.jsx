import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import TodoList from './components/TodoList'
import AttendanceCard from './components/AttendanceCard'
import CalendarPage from './components/CalendarPage'
import SettingsPage from './components/SettingsPage'
import MembersPage from './components/MembersPage'
import PomodoroPage from './components/PomodoroPage'
import ReservationsPage from './components/ReservationsPage'
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      
      // ユーザーがいる場合はストリークとヒートマップを読み込む
      if (session?.user) {
        loadStreaks(session.user.id)
        loadHeatmapData(session.user.id)
      }
    })

    // 認証状態の変更を監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

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
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  isDark
                    ? 'bg-gray-800/80 text-gray-300'
                    : 'bg-gray-100/80 text-gray-700'
                }`}>
                  <span className="text-sm">📅</span>
                  <span>{streaks.attendanceStreak}</span>
                </div>
              )}
              {streaks.todoStreak > 0 && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  isDark
                    ? 'bg-gray-800/80 text-gray-300'
                    : 'bg-gray-100/80 text-gray-700'
                }`}>
                  <span className="text-sm">🎯</span>
                  <span>{streaks.todoStreak}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* サイドバー (PC) / フッターバー (Mobile - 常に表示) */}
      <aside className={`fixed backdrop-blur-xl border transition-all duration-300 z-40 safe-bottom
        md:left-0 md:top-[72px] md:bottom-0 md:w-64 md:border-r md:border-b-0
        left-0 right-0 bottom-0 border-t translate-y-0
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
              onClick={() => setCurrentPage('pomodoro')}
              className={`md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 ${
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

            <button
              onClick={() => setCurrentPage('reservations')}
              className={`md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 ${
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

            {/* ユーザーアイコンボタン (モバイルのみ) */}
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`md:hidden md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 relative ${
                userMenuOpen
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <div className="flex md:flex-row flex-col items-center md:gap-3 gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  userMenuOpen
                    ? isDark
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-900'
                    : isDark
                    ? 'bg-gradient-to-br from-gray-700 to-gray-600 text-white'
                    : 'bg-gradient-to-br from-gray-600 to-gray-500 text-white'
                }`}>
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
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
          <div className={`fixed bottom-24 md:bottom-auto md:right-8 md:top-24 left-1/2 md:left-auto -translate-x-1/2 md:translate-x-0 z-50 w-64 backdrop-blur-xl rounded-2xl shadow-2xl border overflow-hidden transition-all duration-300 ${
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
                  setCurrentPage('settings')
                  setUserMenuOpen(false)
                }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                  isDark
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
      const { data: existingUser, error: selectError } = await supabase
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
