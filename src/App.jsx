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
import RankingPage from './components/RankingPage'
import AttendanceHistoryPage from './components/AttendanceHistoryPage'
import Avatar from './components/Avatar'
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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [othersMenuOpen, setOthersMenuOpen] = useState(false)
  const [eventNotification, setEventNotification] = useState(null)
  const [todayEventNotification, setTodayEventNotification] = useState(null)
  const [followUpNotification, setFollowUpNotification] = useState(null)
  const [requestNotification, setRequestNotification] = useState(null)
  const [announcementsUnreadCount, setAnnouncementsUnreadCount] = useState(0)
  const [pomodoroTimer, setPomodoroTimer] = useState(null) // { timeLeft, totalTime, state }

  // Pomodoroタイマーの状態を監視
  useEffect(() => {
    const checkPomodoroTimer = () => {
      const saved = localStorage.getItem('pomodoroTimerState')
      if (saved) {
        const { state, timeLeft: savedTimeLeft, startTime, pausedTimeLeft, previousState } = JSON.parse(saved)
        if (state !== 'idle') {
          let currentTimeLeft
          let totalTime
          
          // 一時停止中の場合は、保存された残り時間を使う
          if (state === 'paused') {
            currentTimeLeft = pausedTimeLeft
            totalTime = previousState === 'working' ? 25 * 60 : previousState === 'short_break' ? 5 * 60 : 15 * 60
          } else {
            // 実行中の場合は、startTimeからの経過時間を計算
            const elapsed = Math.floor((Date.now() - startTime) / 1000)
            totalTime = state === 'working' ? 25 * 60 : state === 'short_break' ? 5 * 60 : 15 * 60
            currentTimeLeft = Math.max(0, totalTime - elapsed)
          }

          setPomodoroTimer({
            timeLeft: currentTimeLeft,
            totalTime,
            state
          })

          // 時間が0になったらタイマー停止
          if (currentTimeLeft === 0) {
            localStorage.removeItem('pomodoroTimerState')
            setPomodoroTimer(null)
          }
        } else {
          setPomodoroTimer(null)
        }
      } else {
        setPomodoroTimer(null)
      }
    }

    checkPomodoroTimer()
    const interval = setInterval(checkPomodoroTimer, 1000)

    return () => clearInterval(interval)
  }, [])

  // currentPageが変更されたらlocalStorageに保存
  useEffect(() => {
    localStorage.setItem('currentPage', currentPage)
  }, [currentPage])

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

  const reloadUserData = async () => {
    if (!user?.id) return
    
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (error) throw error
      if (userData) {
        setUser(userData)
      }
    } catch (error) {
      console.error('Error reloading user data:', error)
    }
  }

  // 通知を閉じる関数
  const dismissNotification = async (notificationId, notificationType) => {
    if (!notificationId || !user?.id) {
      console.error('dismissNotification called with null notificationId or user')
      return
    }
    
    try {
      // Supabaseに保存
      const { error } = await supabase
        .from('notification_dismissals')
        .insert({
          user_id: user.id,
          notification_type: notificationType,
          notification_id: notificationId
        })

      if (error) {
        // 既に存在する場合はエラーになるが、それは問題ない
        if (!error.message.includes('duplicate') && !error.message.includes('already exists')) {
          console.error('Error dismissing notification:', error)
        }
      }
    } catch (error) {
      console.error('Error dismissing notification:', error)
    }
    
    // 通知を閉じる
    if (notificationType === 'event') setEventNotification(null)
    if (notificationType === 'today') setTodayEventNotification(null)
    if (notificationType === 'followup') setFollowUpNotification(null)
    if (notificationType === 'request') setRequestNotification(null)
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
    let mounted = true
    let initialCheckDone = false

    // 認証状態の変更を監視（ログイン/ログアウト時に反応）
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return

      initialCheckDone = true // onAuthStateChangeが発火したら初期チェック完了とみなす

      try {
        if (session?.user) {
          // Google OAuth かどうかを判定
          const isGoogleAuth = session.user.app_metadata?.provider === 'google'
          const googleId = isGoogleAuth ? session.user.user_metadata?.sub : null

          // タイムアウト付きでユーザーデータを取得
          const fetchWithTimeout = Promise.race([
            supabase.from('users').select('*').eq('id', session.user.id).single(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('User data fetch timeout')), 2000)
            )
          ])

          try {
            const { data: userData, error: userError } = await fetchWithTimeout

            // ユーザーが存在しない場合（Google OAuth 初回ログイン時など）は自動作成
            if (userError && userError.code === 'PGRST116') {
              console.log('🔄 Creating new user from Google OAuth...')
              const newUserData = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'ユーザー',
                google_id: googleId,
                image: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
                role: 'user',
              }

              const { data: createdUser, error: insertError } = await supabase
                .from('users')
                .insert([newUserData])
                .select()
                .single()

              if (insertError) {
                console.error('Error creating user:', insertError)
                setUser(session.user)
              } else {
                console.log('✅ User created successfully:', createdUser)
                setUser(createdUser)
              }
            } else if (userData) {
              // 既存ユーザーの場合、Google IDが未設定なら更新
              if (isGoogleAuth && googleId && !userData.google_id) {
                console.log('🔄 Updating existing user with Google ID...')
                const { data: updatedUser } = await supabase
                  .from('users')
                  .update({
                    google_id: googleId,
                    image: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || userData.image,
                  })
                  .eq('id', session.user.id)
                  .select()
                  .single()
                setUser(updatedUser || userData)
              } else {
                setUser(userData)
              }
            } else {
              setUser(session.user)
            }

            loadStreaks(session.user.id)
            loadHeatmapData(session.user.id)
          } catch (timeoutErr) {
            // タイムアウトした場合は session.user を使用
            setUser(session.user)
            loadStreaks(session.user.id)
            loadHeatmapData(session.user.id)

            // バックグラウンドで完全なユーザーデータを取得
            supabase.from('users').select('*').eq('id', session.user.id).single()
              .then(({ data: userData }) => {
                if (userData && mounted) {
                  setUser(userData)
                }
              })
              .catch(err => console.warn('Background user data fetch failed:', err))
          }
        } else {
          setUser(null)
        }
      } catch (err) {
        console.error('Error in onAuthStateChange:', err)
        setUser(session?.user || null)
      } finally {
        setLoading(false)
      }
    })

    // 初回のセッションチェック（バックグラウンドで実行、タイムアウトは無視）
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (!mounted || initialCheckDone) return // すでにonAuthStateChangeで処理済みならスキップ

        if (error) {
          console.error('Session error:', error)
          setLoading(false)
          return
        }

        const session = data?.session

        if (session?.user) {
          // タイムアウト付きでユーザーデータを取得
          const fetchWithTimeout = Promise.race([
            supabase.from('users').select('*').eq('id', session.user.id).single(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('User data fetch timeout')), 2000)
            )
          ])

          try {
            const { data: userData } = await fetchWithTimeout
            setUser(userData || session.user)
            if (userData || session.user) {
              loadStreaks(session.user.id)
              loadHeatmapData(session.user.id)
            }
          } catch (timeoutErr) {
            console.warn('⚠️ User data fetch timeout in checkSession, using session user')
            setUser(session.user)
            loadStreaks(session.user.id)
            loadHeatmapData(session.user.id)

            // バックグラウンドで完全なユーザーデータを取得
            supabase.from('users').select('*').eq('id', session.user.id).single()
              .then(({ data: userData }) => {
                if (userData && mounted) {
                  setUser(userData)
                }
              })
              .catch(err => console.warn('Background user data fetch failed:', err))
          }
        } else {
          setUser(null)
        }

        setLoading(false)
      } catch (err) {
        console.error('Session check error:', err)
        if (mounted && !initialCheckDone) {
          setLoading(false)
        }
      }
    }

    // onAuthStateChangeは即座に発火するので、それを待つ
    // 500ms経ってもonAuthStateChangeが発火しなければログイン画面を表示
    const timeoutId = setTimeout(() => {
      if (mounted && !initialCheckDone) {
        setLoading(false)
      }
    }, 500)

    // getSessionは非同期でバックグラウンド実行
    checkSession()

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
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
            // 既に閉じた通知かチェック（Supabaseから確認）
            const { data: dismissal } = await supabase
              .from('notification_dismissals')
              .select('id')
              .eq('user_id', user.id)
              .eq('notification_type', 'event')
              .eq('notification_id', newEvent.id)
              .maybeSingle()

            if (dismissal) return

            // 既に表示中のイベントがある場合はスキップ
            if (eventNotification) return

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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements',
          filter: 'category=eq.announcement'
        },
        async (payload) => {
          const newRequest = payload.new

          // 既に閉じた通知かチェック（Supabaseから確認）
          const { data: dismissal } = await supabase
            .from('notification_dismissals')
            .select('id')
            .eq('user_id', user.id)
            .eq('notification_type', 'request')
            .eq('notification_id', newRequest.id)
            .maybeSingle()

          if (dismissal) return

          // 既に表示中のリクエストがある場合はスキップ
          if (requestNotification) return

          // お願いもの作成者の情報を取得
          const { data: author } = await supabase
            .from('users')
            .select('name, email')
            .eq('id', newRequest.author_id)
            .single()

          setRequestNotification({
            ...newRequest,
            author
          })
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
        // Supabaseから非表示状態を取得
        const { data: dismissals } = await supabase
          .from('notification_dismissals')
          .select('notification_id')
          .eq('user_id', user.id)
          .eq('notification_type', 'today')

        const dismissedIds = new Set(dismissals?.map(d => d.notification_id) || [])
        const unnotifiedEvent = todayEvents.find(event => !dismissedIds.has(event.id))

        if (unnotifiedEvent) {
          setTodayEventNotification(unnotifiedEvent)
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

          // 既に閉じた通知かチェック（Supabaseから確認）
          const { data: dismissal } = await supabase
            .from('notification_dismissals')
            .select('id')
            .eq('user_id', user.id)
            .eq('notification_type', 'followup')
            .eq('notification_id', message.id)
            .maybeSingle()

          if (dismissal) return

          // 既に表示中のメッセージがある場合はスキップ
          if (followUpNotification) return

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

  // ページ読み込み時やホームページに戻った時に未表示の通知をチェック
  useEffect(() => {
    if (!user?.id || currentPage !== 'home') return

    const checkPendingNotifications = async () => {
      try {
        // Supabaseから非表示状態を取得
        const { data: dismissals } = await supabase
          .from('notification_dismissals')
          .select('notification_type, notification_id')
          .eq('user_id', user.id)

        const dismissedMap = {}
        if (dismissals) {
          dismissals.forEach(d => {
            const key = `${d.notification_type}_${d.notification_id}`
            dismissedMap[key] = true
          })
        }

        const isDismissed = (type, id) => {
          return dismissedMap[`${type}_${id}`] === true
        }

        // 既に表示中の通知が非表示になっているかチェック
        if (eventNotification && isDismissed('event', eventNotification.id)) {
          setEventNotification(null)
        }
        if (todayEventNotification && isDismissed('today', todayEventNotification.id)) {
          setTodayEventNotification(null)
        }
        if (requestNotification && isDismissed('request', requestNotification.id)) {
          setRequestNotification(null)
        }
        if (followUpNotification && isDismissed('followup', followUpNotification.id)) {
          setFollowUpNotification(null)
        }

        // 投票期限のあるイベントで、まだ通知していないものをチェック
        // 既に表示中のイベントがある場合はチェックしない
        if (!eventNotification) {
          const { data: pendingEvents } = await supabase
            .from('announcements')
            .select(`
              *,
              author:users!announcements_author_id_fkey (
                id,
                name,
                email
              )
            `)
            .eq('category', 'event')
            .not('voting_deadline', 'is', null)
            .order('created_at', { ascending: false })
            .limit(10)

          if (pendingEvents && pendingEvents.length > 0) {
            // 閉じていない最新のイベントを探す
            const unnotifiedEvent = pendingEvents.find(event => !isDismissed('event', event.id))
            if (unnotifiedEvent) {
              setEventNotification(unnotifiedEvent)
            }
          }
        }

        // お願いもの（announcement）で、まだ通知していないものをチェック
        // 既に表示中のリクエストがある場合はチェックしない
        if (!requestNotification) {
          const { data: pendingRequests } = await supabase
            .from('announcements')
            .select(`
              *,
              author:users!announcements_author_id_fkey (
                id,
                name,
                email
              )
            `)
            .eq('category', 'announcement')
            .order('created_at', { ascending: false })
            .limit(10)

          if (pendingRequests && pendingRequests.length > 0) {
            // 閉じていない最新のお願いものを探す
            const unnotifiedRequest = pendingRequests.find(request => !isDismissed('request', request.id))
            if (unnotifiedRequest) {
              setRequestNotification(unnotifiedRequest)
            }
          }
        }

        // 自分宛のフォローアップメッセージで、まだ通知していないものをチェック
        // 既に表示中のメッセージがある場合はチェックしない
        if (!followUpNotification) {
          const { data: followUpMessages } = await supabase
            .from('event_follow_up_messages')
            .select(`
              *,
              announcement:announcements!inner (
                *,
                participants:announcement_participants!inner(user_id),
                date_options:event_date_options(
                  id,
                  votes:event_date_votes(user_id)
                )
              )
            `)
            .order('created_at', { ascending: false })
            .limit(10)

          if (followUpMessages) {
            for (const message of followUpMessages) {
              if (isDismissed('followup', message.id)) continue

              let isTarget = false

              if (message.target_type === 'all_participants') {
                isTarget = message.announcement.participants.some(p => p.user_id === user.id)
              } else if (message.target_type === 'date_option_voters' && message.date_option_id) {
                const dateOption = message.announcement.date_options?.find(opt => opt.id === message.date_option_id)
                isTarget = dateOption?.votes?.some(v => v.user_id === user.id) || false
              }

              if (isTarget) {
                setFollowUpNotification(message)
                break // 最新の1件のみ表示
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking pending notifications:', error)
      }
    }

    // ホームページに戻るたびに実行
    checkPendingNotifications()
  }, [user, currentPage])

  // パスワードリセットページのチェック
  const [isPasswordResetPage, setIsPasswordResetPage] = useState(false)
  
  useEffect(() => {
    // URLハッシュからパスワードリセットトークンをチェック
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const type = hashParams.get('type')
    const accessToken = hashParams.get('access_token')
    
    if (type === 'recovery' && accessToken) {
      setIsPasswordResetPage(true)
    } else if (window.location.pathname === '/reset-password') {
      setIsPasswordResetPage(true)
    }
  }, [])

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

  // パスワードリセットページの場合は、ログイン状態に関係なく表示
  if (isPasswordResetPage) {
    return <PasswordResetPage isDark={isDark} onResetComplete={() => setIsPasswordResetPage(false)} />
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

          {/* Pomodoroタイマー & ストリークバッジ */}
          {user && (
            <div className="ml-auto flex items-center gap-2">
              {/* アナログタイマー表示 */}
              {pomodoroTimer && (
                <div
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setCurrentPage('pomodoro')}
                  title="集中タイマー"
                >
                  {/* 円形プログレスバー（アナログ時計風） */}
                  <div className="relative w-8 h-8">
                    <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                      {/* 背景の円 */}
                      <circle
                        cx="16"
                        cy="16"
                        r="14"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="2.5"
                      />
                      {/* プログレスの円 */}
                      <circle
                        cx="16"
                        cy="16"
                        r="14"
                        fill="none"
                        stroke={pomodoroTimer.state === 'working' ? '#ef4444' : '#22c55e'}
                        strokeWidth="2.5"
                        strokeDasharray={`${2 * Math.PI * 14}`}
                        strokeDashoffset={`${2 * Math.PI * 14 * (1 - pomodoroTimer.timeLeft / pomodoroTimer.totalTime)}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    {/* 中央の時計アイコン */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm">🍅</span>
                    </div>
                  </div>
                  {/* 残り時間 */}
                  <span className="font-mono font-semibold">
                    {Math.floor(pomodoroTimer.timeLeft / 60)}:{String(pomodoroTimer.timeLeft % 60).padStart(2, '0')}
                  </span>
                </div>
              )}

              {/* ストリークバッジ */}
              {(streaks.attendanceStreak > 0 || streaks.todoStreak > 0) && (
                <>
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
                </>
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
              <div className="flex md:flex-row flex-col items-center md:gap-3 gap-0.5">
                <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="hidden md:inline text-xs md:text-base">ホーム</span>
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
              <div className="flex md:flex-row flex-col items-center md:gap-3 gap-0.5">
                <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden md:inline text-xs md:text-base">カレンダー</span>
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
              <div className="flex md:flex-row flex-col items-center md:gap-3 gap-0.5">
                <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="hidden md:inline text-xs md:text-base">メンバー</span>
              </div>
            </button>

            <button
              onClick={() => {
                setCurrentPage('announcements')
                setAnnouncementsUnreadCount(0) // タイムラインを開いたら未読カウントをクリア
              }}
              className={`md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 relative ${
                currentPage === 'announcements'
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <div className="flex md:flex-row flex-col items-center md:gap-3 gap-0.5 relative">
                <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
                {announcementsUnreadCount > 0 && (
                  <span className="absolute top-0 right-0 md:hidden w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
                <span className="hidden md:inline text-xs md:text-base relative inline-flex items-center">
                  タイムライン
                  {announcementsUnreadCount > 0 && (
                    <span className="ml-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </span>
              </div>
            </button>

            {/* PC専用: 管理者ボタン */}
            {user?.role === 'admin' && (
              <button
                onClick={() => setCurrentPage('admin')}
                className={`hidden md:block md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 ${
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

            {/* PC専用: ランキングボタン */}
            <button
              onClick={() => setCurrentPage('ranking')}
              className={`hidden md:block md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 ${
                currentPage === 'ranking'
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <span className="md:inline text-xs md:text-base">ランキング</span>
              </div>
            </button>

            {/* PC専用: 出勤履歴ボタン */}
            <button
              onClick={() => setCurrentPage('attendance-history')}
              className={`hidden md:block md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 ${
                currentPage === 'attendance-history'
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="md:inline text-xs md:text-base">出勤履歴</span>
              </div>
            </button>

            {/* モバイル専用: メニューボタン */}
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`md:hidden md:w-full text-left md:px-4 px-3 md:py-3 py-2 rounded-xl font-medium transition-all duration-200 relative ${
                userMenuOpen || ['admin', 'pomodoro', 'reservations', 'ranking', 'attendance-history', 'settings'].includes(currentPage)
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <div className="flex md:flex-row flex-col items-center md:gap-3 gap-0.5">
                <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="hidden md:inline text-xs md:text-base">メニュー</span>
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
                <Avatar
                  avatarUrl={user?.avatar_url}
                  name={user?.name}
                  email={user?.email}
                  size="md"
                  className={isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600 text-white' : 'bg-gradient-to-br from-gray-800 to-gray-700 text-white'}
                />
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
            <TodoList user={user} isDark={isDark} currentUser={user} />
          </div>
        ) : currentPage === 'calendar' ? (
          <CalendarPage user={user} isDark={isDark} />
        ) : currentPage === 'members' ? (
          <MembersPage user={user} isDark={isDark} />
        ) : currentPage === 'announcements' ? (
          <AnnouncementsPage user={user} isDark={isDark} onUnreadCountChange={setAnnouncementsUnreadCount} />
        ) : currentPage === 'admin' ? (
          <AdminPage isDark={isDark} />
        ) : currentPage === 'pomodoro' ? (
          <PomodoroPage user={user} isDark={isDark} />
        ) : currentPage === 'reservations' ? (
          <ReservationsPage user={user} isDark={isDark} />
        ) : currentPage === 'ranking' ? (
          <RankingPage user={user} isDark={isDark} />
        ) : currentPage === 'attendance-history' ? (
          <AttendanceHistoryPage user={user} isDark={isDark} />
        ) : (
          <SettingsPage user={user} isDark={isDark} setIsDark={setIsDark} onUserUpdate={reloadUserData} />
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
                <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center font-bold text-white ${
                  isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600' : 'bg-gradient-to-br from-gray-800 to-gray-700'
                }`}>
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user?.email?.charAt(0).toUpperCase()
                  )}
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
              {/* 管理者専用: Adminボタン */}
              {user?.role === 'admin' && (
                <button
                  onClick={() => {
                    setCurrentPage('admin')
                    setUserMenuOpen(false)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                    currentPage === 'admin'
                      ? isDark
                        ? 'bg-white/10 text-white'
                        : 'bg-gray-900/10 text-gray-900'
                      : isDark
                      ? 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                      : 'text-gray-600 hover:bg-gray-100/50 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>管理者</span>
                </button>
              )}

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
                  setCurrentPage('ranking')
                  setUserMenuOpen(false)
                }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                  currentPage === 'ranking'
                    ? isDark
                      ? 'bg-white/10 text-white'
                      : 'bg-gray-900/10 text-gray-900'
                    : isDark
                    ? 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-100/50 hover:text-gray-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <span>ランキング</span>
              </button>

              <button
                onClick={() => {
                  setCurrentPage('attendance-history')
                  setUserMenuOpen(false)
                }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                  currentPage === 'attendance-history'
                    ? isDark
                      ? 'bg-white/10 text-white'
                      : 'bg-gray-900/10 text-gray-900'
                    : isDark
                    ? 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-100/50 hover:text-gray-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>出勤履歴</span>
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
            onClick={() => dismissNotification(eventNotification.id, 'event')}
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
                  onClick={() => dismissNotification(eventNotification.id, 'event')}
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
                onClick={() => dismissNotification(eventNotification.id, 'event')}
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
                  dismissNotification(eventNotification.id, 'event')
                  setCurrentPage('announcements')
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
            onClick={() => dismissNotification(todayEventNotification.id, 'today')}
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
                  onClick={() => dismissNotification(todayEventNotification.id, 'today')}
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
                onClick={() => dismissNotification(todayEventNotification.id, 'today')}
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
                  dismissNotification(todayEventNotification.id, 'today')
                  setCurrentPage('announcements')
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

      {/* お願いもの通知ポップアップ */}
      {requestNotification && (
        <>
          {/* オーバーレイ */}
          <div
            onClick={() => dismissNotification(requestNotification.id, 'request')}
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
                  <div className="text-3xl">📢</div>
                  <div>
                    <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      新しいお願い
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      確認をお願いします
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => dismissNotification(requestNotification.id, 'request')}
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
                  {requestNotification.title}
                </h4>
                <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {requestNotification.content}
                </p>
              </div>

              {requestNotification.author && (
                <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span>投稿者:</span>
                  <span>{requestNotification.author.name || requestNotification.author.email.split('@')[0]}</span>
                </div>
              )}
            </div>

            {/* アクション */}
            <div className={`px-6 py-4 border-t flex gap-3 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <button
                onClick={() => dismissNotification(requestNotification.id, 'request')}
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
                  dismissNotification(requestNotification.id, 'request')
                  setCurrentPage('announcements')
                }}
                className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all duration-200 ${
                  isDark
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                }`}
              >
                確認する
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
            onClick={() => dismissNotification(followUpNotification.id, 'followup')}
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
                  onClick={() => dismissNotification(followUpNotification.id, 'followup')}
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
                onClick={() => dismissNotification(followUpNotification.id, 'followup')}
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
                  dismissNotification(followUpNotification.id, 'followup')
                  setCurrentPage('announcements')
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
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetHint, setResetHint] = useState('')
  const [hintQuestion, setHintQuestion] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetError, setResetError] = useState('')
  const [hintVerified, setHintVerified] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)

  // Google OAuth ログイン
  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) throw error
    } catch (error) {
      console.error('Google login error:', error)
      setError(error.message || 'Googleログインに失敗しました')
      setGoogleLoading(false)
    }
  }

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
      setLoading(false)
    }
    // ログイン成功時はonAuthStateChangeが発火するのでloadingはそこで解除
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

  const handleHintVerification = async (e) => {
    e.preventDefault()
    setResetLoading(true)
    setResetError('')
    setHintVerified(false)

    try {
      // メールアドレスとヒントでユーザーを検証
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, password_hint')
        .eq('email', resetEmail)
        .single()

      if (userError || !userData) {
        throw new Error('このメールアドレスは登録されていません。')
      }

      if (!userData.password_hint) {
        throw new Error('このアカウントにはパスワードヒントが設定されていません。設定ページでヒントを設定してください。')
      }

      // JSON形式のヒントを確認
      let hintData = userData.password_hint
      if (typeof hintData === 'string') {
        try {
          hintData = JSON.parse(hintData)
        } catch {
          // 古い形式の場合は、単純なテキストとして扱う
          hintData = { question: '', answer: hintData }
        }
      }

      if (!hintData || !hintData.question || !hintData.answer) {
        throw new Error('このアカウントにはパスワードヒントが正しく設定されていません。設定ページでヒントを設定してください。')
      }

      // 質問を保存して表示
      setHintQuestion(hintData.question)

      // 答えを比較（大文字小文字を区別しない）
      if (hintData.answer.toLowerCase().trim() !== resetHint.toLowerCase().trim()) {
        throw new Error('答えが一致しません。もう一度お試しください。')
      }

      // 答えが一致したら、パスワード変更画面を表示
      setHintVerified(true)
      setResetError('')
    } catch (error) {
      console.error('❌ ヒント認証エラー:', error)
      setResetError(error.message || '答えの確認に失敗しました')
    } finally {
      setResetLoading(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setResetLoading(true)
    setResetError('')

    if (newPassword !== confirmPassword) {
      setResetError('パスワードが一致しません')
      setResetLoading(false)
      return
    }

    if (newPassword.length < 6) {
      setResetError('パスワードは6文字以上である必要があります')
      setResetLoading(false)
      return
    }

    try {
      // Edge Functionを呼び出してパスワードを変更
      const { data, error } = await supabase.functions.invoke('reset-password-with-hint', {
        body: {
          email: resetEmail,
          answer: resetHint, // 答えを送信
          newPassword: newPassword,
        },
      })

      if (error) {
        throw new Error(error.message || 'パスワードの変更に失敗しました')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      setResetSuccess(true)
      setResetEmail('')
      setResetHint('')
      setHintQuestion('')
      setNewPassword('')
      setConfirmPassword('')
      setHintVerified(false)
    } catch (error) {
      console.error('❌ パスワード変更エラー:', error)
      setResetError(error.message || 'パスワードの変更に失敗しました')
    } finally {
      setResetLoading(false)
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

            {/* パスワードを忘れた場合のリンク（ログインモードの時のみ表示） */}
            {!isSignUp && (
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordReset(true)
                    setResetEmail(email) // ログインフォームのメールアドレスを自動入力
                    setResetError('')
                    setResetSuccess(false)
                  }}
                  className={`text-sm font-light transition-colors ${
                    isDark
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  パスワードを忘れた場合
                </button>
              </div>
            )}

            {/* または セパレーター */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className={`px-4 ${isDark ? 'bg-gray-900 text-gray-400' : 'bg-white text-gray-500'}`}>
                  または
                </span>
              </div>
            </div>

            {/* Google OAuth ボタン */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className={`w-full font-medium py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border ${
                isDark
                  ? 'bg-gray-800/50 text-white border-gray-700 hover:bg-gray-700/50 hover:border-gray-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              {/* Google アイコン */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {googleLoading ? 'ログイン中...' : 'Googleでログイン'}
            </button>

            {/* Roots連携の説明（ログインモードのみ） */}
            {!isSignUp && (
              <p className={`text-xs text-center mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                💡 Rootsと同じGoogleアカウントでログインすると連携できます
              </p>
            )}
          </form>

          {/* パスワードリセットフォーム */}
          {showPasswordReset && (
            <div className={`mt-6 pt-6 border-t ${
              isDark ? 'border-gray-800' : 'border-gray-200'
            }`}>
              <h3 className={`text-lg font-medium mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                パスワードリセット
              </h3>
              
              {resetSuccess ? (
                <div className={`p-4 rounded-xl ${
                  isDark ? 'bg-green-900/20 border border-green-700/50' : 'bg-green-50 border border-green-200'
                }`}>
                  <p className={`text-sm ${
                    isDark ? 'text-green-300' : 'text-green-800'
                  }`}>
                    ✅ パスワードを変更しました！新しいパスワードでログインしてください。
                  </p>
                  <button
                    onClick={() => {
                      setShowPasswordReset(false)
                      setResetSuccess(false)
                      setResetEmail('')
                      setResetHint('')
                      setNewPassword('')
                      setConfirmPassword('')
                      setHintVerified(false)
                    }}
                    className={`mt-3 text-sm font-medium ${
                      isDark ? 'text-green-400 hover:text-green-300' : 'text-green-600 hover:text-green-700'
                    }`}
                  >
                    閉じる
                  </button>
                </div>
              ) : hintVerified ? (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className={`p-4 rounded-xl ${
                    isDark ? 'bg-blue-900/20 border border-blue-700/50' : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <p className={`text-sm ${
                      isDark ? 'text-blue-300' : 'text-blue-800'
                    }`}>
                      ✅ ヒントが確認できました。新しいパスワードを設定してください。
                    </p>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      新しいパスワード
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none font-light ${
                        isDark
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                          : 'bg-gray-50/50 border-gray-200 text-gray-900 focus:border-gray-400'
                      }`}
                      placeholder="6文字以上"
                      required
                      minLength={6}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      パスワード（確認）
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none font-light ${
                        isDark
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                          : 'bg-gray-50/50 border-gray-200 text-gray-900 focus:border-gray-400'
                      }`}
                      placeholder="もう一度入力"
                      required
                      minLength={6}
                    />
                  </div>

                  {resetError && (
                    <div className={`text-sm px-4 py-3 rounded-xl font-light whitespace-pre-line ${
                      isDark ? 'text-red-400 bg-red-900/20' : 'text-red-600 bg-red-50'
                    }`}>
                      {resetError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setHintVerified(false)
                        setNewPassword('')
                        setConfirmPassword('')
                        setResetError('')
                      }}
                      className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                        isDark
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      戻る
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDark
                          ? 'bg-white text-gray-900 hover:bg-gray-100'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      {resetLoading ? '変更中...' : 'パスワードを変更'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleHintVerification} className="space-y-4">
                  <div className={`p-4 rounded-xl mb-4 ${
                    isDark ? 'bg-blue-900/20 border border-blue-700/50' : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <p className={`text-sm ${
                      isDark ? 'text-blue-300' : 'text-blue-800'
                    }`}>
                      💡 メールアドレスを入力すると、設定した質問が表示されます。
                      <br />
                      その質問の答えを入力してパスワードをリセットできます。
                    </p>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      メールアドレス
                    </label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={async (e) => {
                        setResetEmail(e.target.value)
                        setResetHint('')
                        setHintQuestion('')
                        // メールアドレスが変更されたら、質問を取得
                        if (e.target.value) {
                          try {
                            const { data: userData } = await supabase
                              .from('users')
                              .select('password_hint')
                              .eq('email', e.target.value)
                              .single()
                            
                            if (userData?.password_hint) {
                              let hintData = userData.password_hint
                              if (typeof hintData === 'string') {
                                try {
                                  hintData = JSON.parse(hintData)
                                } catch {
                                  hintData = { question: '', answer: hintData }
                                }
                              }
                              if (hintData && hintData.question) {
                                setHintQuestion(hintData.question)
                              }
                            }
                          } catch (error) {
                            // エラーは無視（ユーザーが見つからない場合など）
                          }
                        }
                      }}
                      className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none font-light ${
                        isDark
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                          : 'bg-gray-50/50 border-gray-200 text-gray-900 focus:border-gray-400'
                      }`}
                      placeholder="email@example.com"
                      required
                    />
                  </div>

                  {hintQuestion && (
                    <div className={`p-4 rounded-xl border ${
                      isDark ? 'bg-green-900/20 border-green-700/50' : 'bg-green-50 border-green-200'
                    }`}>
                      <div className={`text-sm font-medium mb-2 ${
                        isDark ? 'text-green-300' : 'text-green-800'
                      }`}>
                        💡 質問
                      </div>
                      <div className={`text-base ${
                        isDark ? 'text-green-200' : 'text-green-900'
                      }`}>
                        {hintQuestion}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {hintQuestion ? '答え' : 'パスワードヒント'}
                    </label>
                    <input
                      type="text"
                      value={resetHint}
                      onChange={(e) => setResetHint(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none font-light ${
                        isDark
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                          : 'bg-gray-50/50 border-gray-200 text-gray-900 focus:border-gray-400'
                      }`}
                      placeholder={hintQuestion ? "質問の答えを入力" : "メールアドレスを入力してください"}
                      required
                      disabled={!hintQuestion}
                    />
                  </div>

                  {resetError && (
                    <div className={`text-sm px-4 py-3 rounded-xl font-light whitespace-pre-line ${
                      isDark ? 'text-red-400 bg-red-900/20' : 'text-red-600 bg-red-50'
                    }`}>
                      {resetError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordReset(false)
                        setResetEmail('')
                        setResetHint('')
                        setResetError('')
                        setHintVerified(false)
                      }}
                      className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                        isDark
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDark
                          ? 'bg-white text-gray-900 hover:bg-gray-100'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      {resetLoading ? '確認中...' : '確認'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PasswordResetPage({ isDark, onResetComplete }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // URLハッシュからトークンを取得
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const type = hashParams.get('type')
    const accessToken = hashParams.get('access_token')

    if (type === 'recovery' && accessToken) {
      // トークンが有効か確認
      // Supabaseは自動的にセッションを設定するので、ここでは何もしない
    } else {
      // トークンがない場合はエラー
      setError('無効なリンクです。パスワードリセットメールから再度アクセスしてください。')
    }
  }, [])

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上である必要があります')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      setSuccess(true)
      // 3秒後にログイン画面に戻る
      setTimeout(() => {
        window.location.hash = ''
        onResetComplete()
      }, 3000)
    } catch (error) {
      console.error('Password reset error:', error)
      setError(error.message || 'パスワードのリセットに失敗しました')
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
            パスワードリセット
          </p>
        </div>

        {/* パスワードリセットカード */}
        <div className={`backdrop-blur-xl rounded-3xl shadow-2xl border p-8 transition-colors duration-500 ${
          isDark
            ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
            : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
        }`}>
          {success ? (
            <div className="text-center space-y-4">
              <div className="text-4xl mb-4">✅</div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                パスワードをリセットしました
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                新しいパスワードでログインできます。
                <br />
                3秒後にログイン画面に戻ります...
              </p>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <h2 className={`text-xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                新しいパスワードを設定
              </h2>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  新しいパスワード
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
                  placeholder="6文字以上"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  パスワード（確認）
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none font-light ${
                    isDark
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                      : 'bg-gray-50/50 border-gray-200 text-gray-900 focus:border-gray-400'
                  }`}
                  placeholder="パスワードを再入力"
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className={`text-sm px-4 py-3 rounded-xl font-light ${
                  isDark ? 'text-red-400 bg-red-900/20' : 'text-red-600 bg-red-50'
                }`}>
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
                {loading ? '設定中...' : 'パスワードを設定'}
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.hash = ''
                  onResetComplete()
                }}
                className={`w-full text-sm font-light py-2 transition-colors ${
                  isDark
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ログイン画面に戻る
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
