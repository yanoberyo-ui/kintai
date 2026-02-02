import React, { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'
import { getTodayDate } from '../../../utils/date'
import { 
  getActiveSurvey, 
  getSurveyResults, 
  calculateCategoryScores, 
  calculateDepartmentScores,
  calculateQuestionScores,
  getScoreTrend, 
  getResponseRate, 
  getFreeComments,
  getAvailablePeriods,
  getCurrentResponsePeriod
} from '../../../features/survey/utils/healthSurvey'

export default function AdminPage({ isDark }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard') // dashboard, attendance, salary, users, todo_achievement
  const [users, setUsers] = useState([])
  const [attendances, setAttendances] = useState([])
  const [salaries, setSalaries] = useState([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [dashboardData, setDashboardData] = useState([])
  const [todoAchievementData, setTodoAchievementData] = useState([])
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState('all') // ユニットフィルター
  const [importingFromSheets, setImportingFromSheets] = useState(false)
  const [attendanceViewMode, setAttendanceViewMode] = useState('summary') // 'summary' or 'daily'
  const [dailyAttendances, setDailyAttendances] = useState([])
  const [editingAttendance, setEditingAttendance] = useState(null)
  const [selectedUser, setSelectedUser] = useState('all') // ユーザーフィルター
  const [selectedDate, setSelectedDate] = useState('all') // 日付フィルター
  const [expandedSessions, setExpandedSessions] = useState(new Set()) // 展開されたセッションのID
  const [showAddAttendanceModal, setShowAddAttendanceModal] = useState(false) // 新規勤怠追加モーダル
  const [newAttendance, setNewAttendance] = useState({
    user_id: '',
    date: getTodayDate(),
    clock_in: '09:00',
    clock_out: '18:00',
    break_minutes_used: 60,
    work_type: 'office'
  })
  
  // ヘルスケアサーベイ関連state
  const [healthSurvey, setHealthSurvey] = useState(null)
  const [healthResults, setHealthResults] = useState([])
  const [healthCategoryScores, setHealthCategoryScores] = useState({})
  const [healthDeptScores, setHealthDeptScores] = useState({})
  const [healthQuestionScores, setHealthQuestionScores] = useState([])
  const [healthTrend, setHealthTrend] = useState([])
  const [healthResponseRate, setHealthResponseRate] = useState({ totalUsers: 0, completedUsers: 0, rate: 0 })
  const [healthComments, setHealthComments] = useState([])
  const [healthPeriods, setHealthPeriods] = useState([])
  const [selectedHealthPeriod, setSelectedHealthPeriod] = useState('')
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [showQuestionEditor, setShowQuestionEditor] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [newQuestion, setNewQuestion] = useState({ category: '', question_text: '', question_type: 'scale' })

  useEffect(() => {
    loadCurrentUser()
  }, [])

  // ユーザー一覧は初回のみ読み込み
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadUsers()
    }
  }, [currentUser])

  // タブやyear/month変更時にデータ読み込み
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      if (activeTab === 'dashboard') {
        loadDashboard()
      } else if (activeTab === 'attendance') {
        if (attendanceViewMode === 'summary') {
        loadAttendances()
        } else {
          loadDailyAttendances()
        }
      } else if (activeTab === 'salary') {
        loadSalaries()
      } else if (activeTab === 'todo_achievement') {
        loadTodoAchievement()
      } else if (activeTab === 'health') {
        loadHealthSurveyData()
      }
    }
  }, [currentUser, activeTab, selectedYear, selectedMonth, attendanceViewMode])
  
  // ヘルスケア期間変更時にデータ再読み込み
  useEffect(() => {
    if (activeTab === 'health' && selectedHealthPeriod && healthSurvey) {
      loadHealthPeriodData(selectedHealthPeriod)
    }
  }, [selectedHealthPeriod])

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()
        setCurrentUser(data)
        
        // 管理者でない場合はアクセス拒否
        if (data?.role !== 'admin') {
          alert('管理者権限が必要です')
        }
      }
    } catch (error) {
      console.error('Error loading current user:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const importRevenueFromSheets = async () => {
    setImportingFromSheets(true)
    try {
      const { data, error } = await supabase.functions.invoke('import-revenue', {
        body: {
          year: selectedYear,
          month: selectedMonth
        }
      })

      if (error) throw error

      if (data.error) {
        throw new Error(data.error)
      }

      alert(`スプレッドシートからのインポートが完了しました（${data.imported}件）`)
      loadDashboard() // ダッシュボードを再読み込み
    } catch (error) {
      console.error('Error importing from sheets:', error)
      alert(`インポートエラー: ${error.message}`)
    } finally {
      setImportingFromSheets(false)
    }
  }

  const loadDashboard = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

      // 粗利データが最新かチェック（最終更新から12時間以上経過していたら自動インポート）
      const { data: recentRevenue } = await supabase
        .from('revenues')
        .select('updated_at')
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      const shouldAutoImport = !recentRevenue ||
        (new Date() - new Date(recentRevenue.updated_at)) > 12 * 60 * 60 * 1000

      if (shouldAutoImport && !importingFromSheets) {
        // 自動インポート（エラーは無視）
        try {
          await supabase.functions.invoke('import-revenue', {
            body: { year: selectedYear, month: selectedMonth }
          })
        } catch (e) {
          // 自動インポート失敗時は既存データを使用
        }
      }

      // 3つのクエリを並列実行
      const [
        { data: attendanceData, error: attendanceError },
        { data: revenueData, error: revenueError },
        { data: todoData }
      ] = await Promise.all([
        // 勤怠データ取得（clock_inが存在するレコードをすべて取得）
        supabase
          .from('attendances')
          .select(`
            *,
            user:users (
              id,
              name,
              department
            )
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .not('clock_in', 'is', null),

        // 粗利データ取得
        supabase
          .from('revenues')
          .select('*')
          .eq('year', selectedYear)
          .eq('month', selectedMonth),

        // TODOデータ取得
        supabase
          .from('todo_lists')
          .select(`
            *,
            user:users (
              id,
              name,
              department
            ),
            todo_items (
              is_completed
            )
          `)
          .gte('date', startDate)
          .lte('date', endDate)
      ])

      if (attendanceError) {
        console.error('Error loading attendance data:', attendanceError)
        throw attendanceError
      }

      // ユニーク部署リストを取得
      const allDepartments = [...new Set(attendanceData?.map(a => a.user?.department).filter(Boolean))]
      setDepartments(allDepartments)

      // ユニット（部署）ごとに集計
      const unitSummary = {}

      attendanceData?.forEach(record => {
        // userが存在しない場合はスキップ
        if (!record.user || !record.user.id) {
          return
        }

        // clock_inが存在しない場合はスキップ
        if (!record.clock_in) {
          return
        }

        let dept = record.user.department || '未設定'
        
        // アドコンとムードメーカーを統合
        if (dept === 'ムードメーカー') {
          dept = 'アドコン'
        }
        if (!unitSummary[dept]) {
          unitSummary[dept] = {
            department: dept,
            memberCount: new Set(),
            totalMinutes: 0,
            totalRevenue: 0,
            todoTotal: 0,
            todoCompleted: 0,
            remoteDays: 0,
            officeDays: 0,
            totalDays: 0
          }
        }

        unitSummary[dept].memberCount.add(record.user.id)
        unitSummary[dept].totalDays++
        
        // work_typeでリモートと出社を分類
        if (record.work_type === 'remote') {
          unitSummary[dept].remoteDays++
        } else if (record.work_type === 'office') {
          unitSummary[dept].officeDays++
        }
        
        // total_work_minutesを取得（データベースの確定値のみを使用）
        const workMinutes = record.total_work_minutes || 0
        unitSummary[dept].totalMinutes += workMinutes
      })

      // 粗利を集計
      revenueData?.forEach(revenue => {
        let dept = revenue.department

        // アドコンとムードメーカーを統合
        if (dept === 'ムードメーカー') {
          dept = 'アドコン'
        }
        if (unitSummary[dept]) {
          unitSummary[dept].totalRevenue += parseFloat(revenue.gross_profit) || 0
        }
      })

      // TODOを集計
      todoData?.forEach(list => {
        let dept = list.user.department || '未設定'
        
        // アドコンとムードメーカーを統合
        if (dept === 'ムードメーカー') {
          dept = 'アドコン'
        }
        if (unitSummary[dept]) {
          const items = list.todo_items || []
          unitSummary[dept].todoTotal += items.length
          unitSummary[dept].todoCompleted += items.filter(item => item.is_completed).length
        }
      })

      // 時間あたり採算を計算
      const dashboardArray = Object.values(unitSummary).map(unit => ({
        department: unit.department,
        memberCount: unit.memberCount.size,
        totalHours: Math.floor(unit.totalMinutes / 60),
        totalMinutes: unit.totalMinutes % 60,
        totalRevenue: unit.totalRevenue,
        profitPerHour: unit.totalMinutes > 0 ? unit.totalRevenue / (unit.totalMinutes / 60) : 0,
        todoRate: unit.todoTotal > 0 ? Math.round((unit.todoCompleted / unit.todoTotal) * 100) : 0,
        remoteDays: unit.remoteDays,
        officeDays: unit.officeDays,
        totalDays: unit.totalDays,
        remoteRate: unit.totalDays > 0 ? Math.round((unit.remoteDays / unit.totalDays) * 100) : 0
      }))

      setDashboardData(dashboardArray)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    }
  }

  const loadAttendances = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      // 正しい月末日を計算（selectedMonth月の最終日）
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

      const [
        { data: attendanceData, error: attendanceError },
        { data: todoData }
      ] = await Promise.all([
        // clock_inが存在するレコードをすべて取得（clock_outがなくても出勤としてカウント）
        supabase
          .from('attendances')
          .select(`
            *,
            user:users (
              id,
              name,
              department
            )
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .not('clock_in', 'is', null),

        supabase
          .from('todo_lists')
          .select(`
            *,
            todo_items (
              is_completed
            )
          `)
          .gte('date', startDate)
          .lte('date', endDate)
      ])

      if (attendanceError) {
        console.error('Error loading attendances:', attendanceError)
        throw attendanceError
      }

      // ユーザーごとに集計
      const userStats = {}

      attendanceData?.forEach(record => {
        // userが存在しない場合はスキップ
        if (!record.user || !record.user.id) {
          return
        }

        const userId = record.user.id
        if (!userStats[userId]) {
          userStats[userId] = {
            name: record.user.name,
            department: record.user.department,
            attendanceDays: 0,
            remoteDays: 0,
            officeDays: 0,
            totalWorkMinutes: 0,
            todoTotal: 0,
            todoCompleted: 0
          }
        }

        // clock_inが存在しない場合はスキップ
        if (!record.clock_in) {
          return
        }

        // 出勤日数としてカウント（clock_outがなくても出勤として扱う）
        userStats[userId].attendanceDays++
        
        // work_typeでリモートと出社を分類
        if (record.work_type === 'remote') {
          userStats[userId].remoteDays++
        } else if (record.work_type === 'office') {
          userStats[userId].officeDays++
        }
        
        // total_work_minutesを取得（データベースの確定値のみを使用）
        const workMinutes = record.total_work_minutes || 0
        userStats[userId].totalWorkMinutes += workMinutes
      })

      // TODO達成率を集計
      todoData?.forEach(list => {
        const userId = list.user_id
        if (userStats[userId]) {
          const items = list.todo_items || []
          userStats[userId].todoTotal += items.length
          userStats[userId].todoCompleted += items.filter(item => item.is_completed).length
        }
      })

      // 平均勤務時間とTODO達成率を計算
      const attendanceArray = Object.values(userStats).map(user => ({
        ...user,
        avgWorkMinutes: user.attendanceDays > 0 ? Math.round(user.totalWorkMinutes / user.attendanceDays) : 0,
        todoRate: user.todoTotal > 0 ? Math.round((user.todoCompleted / user.todoTotal) * 100) : 0
      }))

      setAttendances(attendanceArray)
    } catch (error) {
      console.error('Error loading attendances:', error)
      setAttendances([])
    }
  }

  const loadSalaries = async () => {
    try {
      const { data, error } = await supabase
        .from('salaries')
        .select(`
          *,
          user:users (
            id,
            name,
            department
          )
        `)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSalaries(data || [])
    } catch (error) {
      console.error('Error loading salaries:', error)
      setSalaries([])
    }
  }

  const loadTodoAchievement = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('todo_lists')
        .select(`
          *,
          user:users (
            id,
            name
          ),
          todo_items (
            is_completed
          )
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

      if (error) throw error

      const achievementData = data?.map(list => {
        const items = list.todo_items || []
        const totalTasks = items.length
        const completedTasks = items.filter(item => item.is_completed).length
        const achievementRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

        return {
          date: list.date,
          userName: list.user.name,
          totalTasks,
          completedTasks,
          achievementRate
        }
      }) || []

      setTodoAchievementData(achievementData)
    } catch (error) {
      console.error('Error loading todo achievement:', error)
    }
  }

  // ヘルスケアサーベイデータの読み込み
  const loadHealthSurveyData = async () => {
    try {
      setLoadingHealth(true)
      
      // アクティブなサーベイを取得
      const survey = await getActiveSurvey()
      if (!survey) {
        setHealthSurvey(null)
        return
      }
      setHealthSurvey(survey)
      
      // 利用可能な期間を取得
      const periods = await getAvailablePeriods(survey.id)
      setHealthPeriods(periods)
      
      // デフォルトで最新期間を選択
      const currentPeriod = periods.length > 0 ? periods[0] : getCurrentResponsePeriod(survey.frequency)
      setSelectedHealthPeriod(currentPeriod)
      
      // 期間データを読み込み
      await loadHealthPeriodData(currentPeriod, survey.id)
      
    } catch (error) {
      console.error('Error loading health survey data:', error)
    } finally {
      setLoadingHealth(false)
    }
  }
  
  // 特定期間のヘルスケアデータを読み込み
  const loadHealthPeriodData = async (period, surveyId = null) => {
    try {
      const sid = surveyId || healthSurvey?.id
      if (!sid) return
      
      // 結果データを取得
      const results = await getSurveyResults(sid, period)
      setHealthResults(results)
      
      // カテゴリ別スコアを計算
      const categoryScores = calculateCategoryScores(results)
      setHealthCategoryScores(categoryScores)
      
      // 部署別スコアを計算
      const deptScores = calculateDepartmentScores(results)
      setHealthDeptScores(deptScores)
      
      // 質問別スコアを計算
      const questionScores = calculateQuestionScores(results)
      setHealthQuestionScores(questionScores)
      
      // 回答率を取得
      const responseRate = await getResponseRate(sid, period)
      setHealthResponseRate(responseRate)
      
      // フリーコメントを取得
      const comments = await getFreeComments(sid, period)
      setHealthComments(comments)
      
      // スコア推移を取得
      const trend = await getScoreTrend(sid, 6)
      setHealthTrend(trend)
      
    } catch (error) {
      console.error('Error loading health period data:', error)
    }
  }

  // 質問を追加
  const handleAddQuestion = async () => {
    if (!newQuestion.category || !newQuestion.question_text) {
      alert('カテゴリと質問文を入力してください')
      return
    }
    
    try {
      const maxOrder = healthSurvey.questions?.length > 0 
        ? Math.max(...healthSurvey.questions.map(q => q.order_index)) + 1 
        : 1
      
      const { error } = await supabase
        .from('health_survey_questions')
        .insert({
          survey_id: healthSurvey.id,
          category: newQuestion.category,
          question_text: newQuestion.question_text,
          question_type: newQuestion.question_type,
          order_index: maxOrder
        })
      
      if (error) throw error
      
      setNewQuestion({ category: '', question_text: '', question_type: 'scale' })
      await loadHealthSurveyData()
    } catch (error) {
      console.error('Error adding question:', error)
      alert('質問の追加に失敗しました')
    }
  }

  // 質問を更新
  const handleUpdateQuestion = async (questionId, updates) => {
    try {
      const { error } = await supabase
        .from('health_survey_questions')
        .update(updates)
        .eq('id', questionId)
      
      if (error) throw error
      
      setEditingQuestion(null)
      await loadHealthSurveyData()
    } catch (error) {
      console.error('Error updating question:', error)
      alert('質問の更新に失敗しました')
    }
  }

  // 質問を削除
  const handleDeleteQuestion = async (questionId) => {
    if (!confirm('この質問を削除しますか？関連する回答データも削除されます。')) return
    
    try {
      const { error } = await supabase
        .from('health_survey_questions')
        .delete()
        .eq('id', questionId)
      
      if (error) throw error
      
      await loadHealthSurveyData()
    } catch (error) {
      console.error('Error deleting question:', error)
      alert('質問の削除に失敗しました')
    }
  }

  const loadDailyAttendances = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('attendances')
        .select(`
          *,
          user:users (
            id,
            name,
            department
          )
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('user_id', { ascending: true })

      if (error) throw error

      // 時刻をフォーマット
      const formattedData = data?.map(record => {
        let workMinutes = 0
        let calculatedMinutes = 0
        
        // clock_inとclock_outから計算
        if (record.clock_in && record.clock_out) {
          const clockIn = new Date(record.clock_in)
          const clockOut = new Date(record.clock_out)
          if (!isNaN(clockIn.getTime()) && !isNaN(clockOut.getTime()) && clockOut > clockIn) {
            calculatedMinutes = Math.floor((clockOut - clockIn) / 60000) - (record.break_minutes_used || 0)
          }
        }
        
        // データベースの total_work_minutes をそのまま使用
        workMinutes = record.total_work_minutes || 0
        
        // total_work_minutesが存在しない場合は計算値を使用
        if (workMinutes === 0 && calculatedMinutes > 0) {
          workMinutes = Math.max(0, calculatedMinutes)
        }

        return {
          ...record,
          calculatedWorkMinutes: Math.max(0, workMinutes)
        }
      }) || []

      setDailyAttendances(formattedData)
    } catch (error) {
      console.error('Error loading daily attendances:', error)
      setDailyAttendances([])
    }
  }

  const handleUpdateAttendance = async (attendanceId, updates) => {
    try {
      // 時刻データの変換
      const updateData = {}
      
      if (updates.clock_in !== undefined) {
        // HH:mm 形式の時刻を UTC の ISO 文字列に変換
        const record = dailyAttendances.find(a => a.id === attendanceId)
        if (record && updates.clock_in) {
          const [hours, minutes] = updates.clock_in.split(':').map(Number)
          // JST で日付と時刻を組み合わせて UTC に変換
          const jstDate = new Date(`${record.date}T${updates.clock_in}:00+09:00`)
          updateData.clock_in = jstDate.toISOString()
        } else if (updates.clock_in === '') {
          updateData.clock_in = null
        }
      }
      
      if (updates.clock_out !== undefined) {
        const record = dailyAttendances.find(a => a.id === attendanceId)
        if (record && updates.clock_out) {
          const jstDate = new Date(`${record.date}T${updates.clock_out}:00+09:00`)
          updateData.clock_out = jstDate.toISOString()
        } else if (updates.clock_out === '') {
          updateData.clock_out = null
        }
      }
      
      if (updates.break_minutes_used !== undefined) {
        updateData.break_minutes_used = parseInt(updates.break_minutes_used) || 0
      }
      
      if (updates.work_type !== undefined) {
        updateData.work_type = updates.work_type
      }

      // total_work_minutes を再計算
      const record = dailyAttendances.find(a => a.id === attendanceId)
      if (record) {
        const clockIn = updateData.clock_in ? new Date(updateData.clock_in) : (record.clock_in ? new Date(record.clock_in) : null)
        const clockOut = updateData.clock_out ? new Date(updateData.clock_out) : (record.clock_out ? new Date(record.clock_out) : null)
        const breakMinutes = updateData.break_minutes_used !== undefined ? updateData.break_minutes_used : (record.break_minutes_used || 0)
        
        if (clockIn && clockOut && !isNaN(clockIn.getTime()) && !isNaN(clockOut.getTime())) {
          const totalMinutes = Math.floor((clockOut - clockIn) / 60000)
          updateData.total_work_minutes = Math.max(0, totalMinutes - breakMinutes)
        }
      }

      const { error } = await supabase
        .from('attendances')
        .update(updateData)
        .eq('id', attendanceId)

      if (error) throw error

      // データを再読み込み
      await loadDailyAttendances()
      setEditingAttendance(null)
      alert('勤怠データを更新しました')
    } catch (error) {
      console.error('Error updating attendance:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const handleDeleteAttendance = async (attendanceId) => {
    if (!window.confirm('この勤怠データを削除しますか？')) return

    try {
      const { error } = await supabase
        .from('attendances')
        .delete()
        .eq('id', attendanceId)

      if (error) throw error

      await loadDailyAttendances()
      alert('勤怠データを削除しました')
    } catch (error) {
      console.error('Error deleting attendance:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const handleCreateAttendance = async () => {
    try {
      // バリデーション
      if (!newAttendance.user_id) {
        alert('ユーザーを選択してください')
        return
      }
      if (!newAttendance.date) {
        alert('日付を入力してください')
        return
      }
      if (!newAttendance.clock_in) {
        alert('出勤時刻を入力してください')
        return
      }

      // 既存データチェック
      const { data: existing } = await supabase
        .from('attendances')
        .select('id')
        .eq('user_id', newAttendance.user_id)
        .eq('date', newAttendance.date)
        .single()

      if (existing) {
        alert('この日付にはすでに勤怠データが存在します。編集機能を使用してください。')
        return
      }

      // 時刻データをISO形式に変換
      const clockInDate = new Date(`${newAttendance.date}T${newAttendance.clock_in}:00+09:00`)
      const clockOutDate = newAttendance.clock_out 
        ? new Date(`${newAttendance.date}T${newAttendance.clock_out}:00+09:00`)
        : null

      // 合計勤務時間を計算
      let totalWorkMinutes = 0
      if (clockOutDate) {
        const totalMinutes = Math.floor((clockOutDate - clockInDate) / 60000)
        totalWorkMinutes = Math.max(0, totalMinutes - (newAttendance.break_minutes_used || 0))
      }

      const insertData = {
        user_id: newAttendance.user_id,
        date: newAttendance.date,
        clock_in: clockInDate.toISOString(),
        clock_out: clockOutDate ? clockOutDate.toISOString() : null,
        break_minutes_used: newAttendance.break_minutes_used || 0,
        total_work_minutes: totalWorkMinutes,
        work_type: newAttendance.work_type || null
      }

      const { error } = await supabase
        .from('attendances')
        .insert(insertData)

      if (error) throw error

      // データを再読み込み
      await loadDailyAttendances()
      
      // モーダルを閉じてフォームをリセット
      setShowAddAttendanceModal(false)
      setNewAttendance({
        user_id: '',
        date: getTodayDate(),
        clock_in: '09:00',
        clock_out: '18:00',
        break_minutes_used: 60,
        work_type: 'office'
      })
      
      alert('勤怠データを追加しました')
    } catch (error) {
      console.error('Error creating attendance:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const formatTimeForInput = (isoString) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    // UTC を JST に変換（+9時間）
    const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000)
    const hours = jstDate.getUTCHours().toString().padStart(2, '0')
    const minutes = jstDate.getUTCMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // 中抜けセッションを取得（実際に中抜けしていた時間帯のみ）
  const getBreakSessions = (record) => {
    if (!record.break_sessions || record.break_sessions.length === 0) {
      return []
    }
    
    return record.break_sessions
      .filter(session => session.start) // 開始時刻があるもののみ
      .map(session => ({
        start: formatTimeForInput(session.start),
        end: session.end ? formatTimeForInput(session.end) : null
      }))
  }

  // セッション展開状態をトグル
  const toggleSessionExpansion = (attendanceId) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(attendanceId)) {
        newSet.delete(attendanceId)
      } else {
        newSet.add(attendanceId)
      }
      return newSet
    })
  }

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      // ユーザー一覧を再読み込み
      loadUsers()
      alert('権限を更新しました')
    } catch (error) {
      console.error('Error updating user role:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const handleCreateSalary = async (userId) => {
    try {
      // 既存のレコードをチェック
      const { data: existing } = await supabase
        .from('salaries')
        .select('id')
        .eq('user_id', userId)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .single()

      if (existing) {
        alert('このユーザーの給料レコードは既に存在します')
        return
      }

      const { error } = await supabase
        .from('salaries')
        .insert({
          user_id: userId,
          year: selectedYear,
          month: selectedMonth,
          base_salary: 0,
          overtime_pay: 0,
          bonuses: 0,
          deductions: 0,
          total_salary: 0,
          payment_status: 'pending'
        })

      if (error) throw error

      loadSalaries()
    } catch (error) {
      console.error('Error creating salary:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const handleUpdateSalary = async (salaryId, field, value) => {
    try {
      const numValue = parseFloat(value) || 0
      const updates = { [field]: numValue }

      // total_salaryを計算
      const salary = salaries.find(s => s.id === salaryId)
      if (salary) {
        const baseSalary = field === 'base_salary' ? numValue : salary.base_salary
        const overtimePay = field === 'overtime_pay' ? numValue : salary.overtime_pay
        const bonuses = field === 'bonuses' ? numValue : salary.bonuses
        const deductions = field === 'deductions' ? numValue : salary.deductions
        updates.total_salary = baseSalary + overtimePay + bonuses - deductions
      }

      const { error } = await supabase
        .from('salaries')
        .update(updates)
        .eq('id', salaryId)

      if (error) throw error

      loadSalaries()
    } catch (error) {
      console.error('Error updating salary:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const handleUpdatePaymentStatus = async (salaryId, status) => {
    try {
      const { error } = await supabase
        .from('salaries')
        .update({ payment_status: status })
        .eq('id', salaryId)

      if (error) throw error

      loadSalaries()
    } catch (error) {
      console.error('Error updating payment status:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const handleUpdateRevenue = async (department, year, month, value) => {
    try {
      const numValue = parseFloat(value) || 0

      // 既存のレコードをチェック
      const { data: existing } = await supabase
        .from('revenues')
        .select('id')
        .eq('department', department)
        .eq('year', year)
        .eq('month', month)
        .single()

      if (existing) {
        // 更新
        const { error } = await supabase
          .from('revenues')
          .update({ gross_profit: numValue })
          .eq('id', existing.id)

        if (error) throw error
      } else {
        // 新規作成
        const { error } = await supabase
          .from('revenues')
          .insert({
            department,
            year,
            month,
            gross_profit: numValue
          })

        if (error) throw error
      }

      loadDashboard()
    } catch (error) {
      console.error('Error updating revenue:', error)
      alert(`エラー: ${error.message}`)
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          読み込み中...
        </div>
      </div>
    )
  }

  // 管理者権限チェック
  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            アクセスが拒否されました
          </div>
          <div className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            このページは管理者のみアクセス可能です
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto pb-20">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          管理者ダッシュボード
        </h1>
        <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          給料管理と出勤管理
        </p>
      </div>

      {/* タブ */}
      <div className={`mb-6 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { value: 'dashboard', label: 'ダッシュボード', icon: '📈', shortLabel: 'ダッシュボード' },
            { value: 'attendance', label: '出勤管理', icon: '📊', shortLabel: '出勤' },
            { value: 'salary', label: '給料管理', icon: '💰', shortLabel: '給料' },
            { value: 'todo_achievement', label: 'TODO', icon: '✅', shortLabel: 'TODO' },
            { value: 'health', label: 'ヘルスチェック', icon: '💚', shortLabel: 'ヘルス' },
            { value: 'users', label: 'ユーザー', icon: '👥', shortLabel: 'ユーザー' }
          ].map(({ value, label, icon, shortLabel }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-3 font-medium transition-all duration-200 relative whitespace-nowrap text-sm md:text-base ${
                activeTab === value
                  ? isDark
                    ? 'text-white'
                    : 'text-gray-900'
                  : isDark
                  ? 'text-gray-500 hover:text-gray-300'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="text-base md:text-lg">{icon}</span>
              <span className="hidden md:inline">{label}</span>
              <span className="md:hidden">{shortLabel}</span>
              {activeTab === value && (
                <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-full ${
                  isDark ? 'bg-white' : 'bg-gray-900'
                }`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 年月選択とユニット選択 */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className={`px-3 py-2 text-sm md:text-base rounded-xl transition-colors flex-1 min-w-[100px] ${
              isDark
                ? 'bg-gray-800 text-white border border-gray-700'
                : 'bg-white text-gray-900 border border-gray-300'
            } focus:outline-none`}
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
              <option key={year} value={year}>{year}年</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className={`px-3 py-2 text-sm md:text-base rounded-xl transition-colors flex-1 min-w-[80px] ${
              isDark
                ? 'bg-gray-800 text-white border border-gray-700'
                : 'bg-white text-gray-900 border border-gray-300'
            } focus:outline-none`}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
              <option key={month} value={month}>{month}月</option>
            ))}
          </select>
          {(activeTab === 'dashboard' || activeTab === 'attendance') && (
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className={`px-3 py-2 text-sm md:text-base rounded-xl transition-colors flex-1 min-w-[120px] ${
                isDark
                  ? 'bg-gray-800 text-white border border-gray-700'
                  : 'bg-white text-gray-900 border border-gray-300'
              } focus:outline-none`}
            >
              <option value="all">全ユニット</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          )}
        </div>
        {activeTab === 'dashboard' && (
          <button
            onClick={importRevenueFromSheets}
            disabled={importingFromSheets}
            className={`w-full md:w-auto px-4 py-2 text-sm md:text-base rounded-xl transition-colors ${
              isDark
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {importingFromSheets ? '📥 インポート中...' : '📊 シートから粗利をインポート'}
          </button>
        )}
      </div>

      {/* コンテンツ */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* ビュー切り替えとユーザーフィルター */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className={`inline-flex rounded-xl p-1 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <button
                onClick={() => setAttendanceViewMode('summary')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  attendanceViewMode === 'summary'
                    ? isDark
                      ? 'bg-white text-gray-900'
                      : 'bg-gray-900 text-white'
                    : isDark
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📊 月次サマリー
              </button>
              <button
                onClick={() => setAttendanceViewMode('daily')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  attendanceViewMode === 'daily'
                    ? isDark
                      ? 'bg-white text-gray-900'
                      : 'bg-gray-900 text-white'
                    : isDark
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📅 日別詳細
              </button>
            </div>

            {attendanceViewMode === 'daily' && (
              <>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={`px-3 py-2 text-sm rounded-xl transition-colors ${
                    isDark
                      ? 'bg-gray-800 text-white border border-gray-700'
                      : 'bg-white text-gray-900 border border-gray-300'
                  } focus:outline-none`}
                >
                  <option value="all">📅 全日程</option>
                  {[...new Set(dailyAttendances.map(a => a.date))].sort((a, b) => b.localeCompare(a)).map(date => (
                    <option key={date} value={date}>
                      {new Date(date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className={`px-3 py-2 text-sm rounded-xl transition-colors ${
                    isDark
                      ? 'bg-gray-800 text-white border border-gray-700'
                      : 'bg-white text-gray-900 border border-gray-300'
                  } focus:outline-none`}
                >
                  <option value="all">👤 全員</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* 月次サマリービュー */}
          {attendanceViewMode === 'summary' && (
        <div className={`rounded-2xl border overflow-hidden ${
          isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm md:text-base">
              <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    名前
                  </th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    ユニット
                  </th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    出勤
                  </th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    🏠 リモート
                  </th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    🏢 出社
                  </th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    合計
                  </th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    平均
                  </th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    TODO
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
                {attendances
                  .filter(user => selectedDepartment === 'all' || user.department === selectedDepartment)
                  .map((user, index) => (
                  <tr key={index} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {user.name}
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {user.department}
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {user.attendanceDays}日
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {user.remoteDays || 0}日
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'
                      }`}>
                        {user.officeDays || 0}日
                      </span>
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {Math.floor(user.totalWorkMinutes / 60)}:{String(user.totalWorkMinutes % 60).padStart(2, '0')}
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {Math.floor(user.avgWorkMinutes / 60)}:{String(user.avgWorkMinutes % 60).padStart(2, '0')}
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {user.todoTotal > 0 ? `${user.todoRate}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {attendances.length === 0 && (
              <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <p>出勤データがありません</p>
              </div>
            )}
          </div>
            </div>
          )}

          {/* 日別詳細ビュー */}
          {attendanceViewMode === 'daily' && (
            <div className="space-y-4">
              {/* 勤怠データ追加ボタン */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAddAttendanceModal(true)}
                  className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors flex items-center gap-2 ${
                    isDark
                      ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  <span>＋</span>
                  勤怠データを追加
                </button>
              </div>

              {/* 日付でグループ化して表示 */}
              {(() => {
                // フィルタリング
                const filteredData = dailyAttendances
                  .filter(record => selectedDate === 'all' || record.date === selectedDate)
                  .filter(record => selectedUser === 'all' || record.user_id === selectedUser)
                  .filter(record => selectedDepartment === 'all' || record.user?.department === selectedDepartment)

                // 日付でグループ化
                const groupedByDate = filteredData.reduce((acc, record) => {
                  if (!acc[record.date]) {
                    acc[record.date] = []
                  }
                  acc[record.date].push(record)
                  return acc
                }, {})

                // 日付でソート（降順）
                const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a))

                if (sortedDates.length === 0) {
                  return (
                    <div className={`rounded-2xl border p-12 text-center ${
                      isDark ? 'border-gray-800 bg-gray-900/50 text-gray-500' : 'border-gray-200 bg-white text-gray-400'
                    }`}>
                      <p>出勤データがありません</p>
                    </div>
                  )
                }

                return sortedDates.map(date => (
                  <div key={date} className={`rounded-2xl border overflow-hidden ${
                    isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
                  }`}>
                    {/* 日付ヘッダー */}
                    <div className={`px-4 py-3 flex items-center justify-between ${
                      isDark ? 'bg-gray-800/70' : 'bg-gray-100'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📅</span>
                        <div>
                          <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {new Date(date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                          </div>
                          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            出勤者: {groupedByDate[date].length}名
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedDate(selectedDate === date ? 'all' : date)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          selectedDate === date
                            ? isDark
                              ? 'bg-white text-gray-900'
                              : 'bg-gray-900 text-white'
                            : isDark
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {selectedDate === date ? '✓ 選択中' : '選択'}
                      </button>
                    </div>

                    {/* テーブル */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className={isDark ? 'bg-gray-800/30' : 'bg-gray-50'}>
                          <tr>
                            <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              名前
                            </th>
                            <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              出勤
                            </th>
                            <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              退勤
                            </th>
                            <th className={`px-3 py-2 text-center text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              中抜け
                            </th>
                            <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              休憩
                            </th>
                            <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              稼働時間
                            </th>
                            <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              タイプ
                            </th>
                            <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              操作
                            </th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
                          {groupedByDate[date].map((record) => (
                            <tr key={record.id} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                              <td className={`px-3 py-3 whitespace-nowrap text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {record.user?.name || '不明'}
                              </td>
                              
                              {/* 編集モード */}
                              {editingAttendance === record.id ? (
                                <>
                                  <td className="px-3 py-3 whitespace-nowrap">
                                    <input
                                      type="time"
                                      defaultValue={formatTimeForInput(record.clock_in)}
                                      id={`clock_in_${record.id}`}
                                      className={`w-24 px-2 py-1 text-sm rounded ${
                                        isDark
                                          ? 'bg-gray-800 text-white border border-gray-600'
                                          : 'bg-white text-gray-900 border border-gray-300'
                                      }`}
                                    />
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap">
                                    <input
                                      type="time"
                                      defaultValue={formatTimeForInput(record.clock_out)}
                                      id={`clock_out_${record.id}`}
                                      className={`w-24 px-2 py-1 text-sm rounded ${
                                        isDark
                                          ? 'bg-gray-800 text-white border border-gray-600'
                                          : 'bg-white text-gray-900 border border-gray-300'
                                      }`}
                                    />
                                  </td>
                                  <td className={`px-3 py-3 whitespace-nowrap text-center text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {(() => {
                                      const breakSessions = getBreakSessions(record)
                                      if (breakSessions.length === 0) return '-'
                                      return `${breakSessions.length}回`
                                    })()}
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap">
                                    <input
                                      type="number"
                                      defaultValue={record.break_minutes_used || 0}
                                      id={`break_${record.id}`}
                                      min="0"
                                      className={`w-16 px-2 py-1 text-sm rounded ${
                                        isDark
                                          ? 'bg-gray-800 text-white border border-gray-600'
                                          : 'bg-white text-gray-900 border border-gray-300'
                                      }`}
                                    />
                                    <span className={`ml-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>分</span>
                                  </td>
                                  <td className={`px-3 py-3 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                                    --
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap">
                                    <select
                                      defaultValue={record.work_type || ''}
                                      id={`work_type_${record.id}`}
                                      className={`px-2 py-1 text-sm rounded ${
                                        isDark
                                          ? 'bg-gray-800 text-white border border-gray-600'
                                          : 'bg-white text-gray-900 border border-gray-300'
                                      }`}
                                    >
                                      <option value="">未設定</option>
                                      <option value="remote">🏠 リモート</option>
                                      <option value="office">🏢 出社</option>
                                    </select>
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap">
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          const clockIn = document.getElementById(`clock_in_${record.id}`).value
                                          const clockOut = document.getElementById(`clock_out_${record.id}`).value
                                          const breakMinutes = document.getElementById(`break_${record.id}`).value
                                          const workType = document.getElementById(`work_type_${record.id}`).value
                                          handleUpdateAttendance(record.id, {
                                            clock_in: clockIn,
                                            clock_out: clockOut,
                                            break_minutes_used: breakMinutes,
                                            work_type: workType || null
                                          })
                                        }}
                                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                          isDark
                                            ? 'bg-green-600 text-white hover:bg-green-700'
                                            : 'bg-green-500 text-white hover:bg-green-600'
                                        }`}
                                      >
                                        保存
                                      </button>
                                      <button
                                        onClick={() => setEditingAttendance(null)}
                                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                          isDark
                                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                      >
                                        キャンセル
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className={`px-3 py-3 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                                    {formatTimeForInput(record.clock_in) || '-'}
                                  </td>
                                  <td className={`px-3 py-3 whitespace-nowrap text-sm ${
                                    !record.clock_out
                                      ? 'text-orange-500 font-medium'
                                      : isDark ? 'text-gray-300' : 'text-gray-900'
                                  }`}>
                                    {formatTimeForInput(record.clock_out) || '未退勤'}
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap text-center">
                                    {(() => {
                                      const breakSessions = getBreakSessions(record)
                                      const hasBreaks = breakSessions.length > 0
                                      const isExpanded = expandedSessions.has(record.id)
                                      
                                      if (!hasBreaks) {
                                        // 中抜けなし
                                        return (
                                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            -
                                          </span>
                                        )
                                      }
                                      
                                      // 中抜けあり
                                      if (isExpanded) {
                                        // 展開状態：全中抜けセッション表示
                                        return (
                                          <div className="space-y-1">
                                            <div className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                              {breakSessions.map((session, idx) => (
                                                <div key={idx} className="py-0.5">
                                                  {session.start}-{session.end || '中抜け中'}
                                                </div>
                                              ))}
                                            </div>
                                            <button
                                              onClick={() => toggleSessionExpansion(record.id)}
                                              className={`text-xs underline ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                              閉じる
                                            </button>
                                          </div>
                                        )
                                      } else {
                                        // 折りたたみ状態：最初と最後の中抜けのみ
                                        const firstBreak = breakSessions[0]
                                        const lastBreak = breakSessions[breakSessions.length - 1]
                                        const displayText = breakSessions.length === 1
                                          ? `${firstBreak.start}-${firstBreak.end || '中抜け中'}`
                                          : `${firstBreak.start}-${firstBreak.end || '中抜け中'} ... ${lastBreak.start}-${lastBreak.end || '中抜け中'}`
                                        
                                        return (
                                          <div className="flex items-center justify-center gap-1">
                                            <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                              {displayText}
                                            </span>
                                            {breakSessions.length > 1 && (
                                              <button
                                                onClick={() => toggleSessionExpansion(record.id)}
                                                className={`text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                                              >
                                                ...
                                              </button>
                                            )}
                                          </div>
                                        )
                                      }
                                    })()}
                                  </td>
                                  <td className={`px-3 py-3 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                                    {record.break_minutes_used || 0}分
                                  </td>
                                  <td className={`px-3 py-3 whitespace-nowrap text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {Math.floor(record.calculatedWorkMinutes / 60)}:{String(record.calculatedWorkMinutes % 60).padStart(2, '0')}
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap">
                                    {record.work_type === 'remote' ? (
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                        isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'
                                      }`}>
                                        🏠 リモート
                                      </span>
                                    ) : record.work_type === 'office' ? (
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                        isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'
                                      }`}>
                                        🏢 出社
                                      </span>
                                    ) : (
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                        isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                                      }`}>
                                        未設定
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap">
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => setEditingAttendance(record.id)}
                                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                          isDark
                                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                                            : 'bg-blue-500 text-white hover:bg-blue-600'
                                        }`}
                                      >
                                        ✏️ 編集
                                      </button>
                                      <button
                                        onClick={() => handleDeleteAttendance(record.id)}
                                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                          isDark
                                            ? 'bg-red-600 text-white hover:bg-red-700'
                                            : 'bg-red-500 text-white hover:bg-red-600'
                                        }`}
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>
      )}

      {activeTab === 'salary' && (
        <div className="space-y-6">
          {/* 給料レコード作成ボタン */}
          <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  給料レコード作成
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {selectedYear}年{selectedMonth}月の給料レコードを作成
                </div>
              </div>
              <button
                onClick={() => {
                  const userId = prompt('ユーザーIDを入力してください（全員作成する場合は空欄）')
                  if (userId === null) return
                  if (userId === '') {
                    users.forEach(user => handleCreateSalary(user.id))
                  } else {
                    handleCreateSalary(userId)
                  }
                }}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  isDark
                    ? 'bg-white text-gray-900 hover:bg-gray-100'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                + 作成
              </button>
            </div>
          </div>

          {/* 給料一覧 */}
          <div className={`rounded-2xl border overflow-hidden ${
            isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      社員
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      基本給
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      残業代
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      手当
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      控除
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      総支給額
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      支払状況
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
                  {salaries.map((salary) => (
                    <tr key={salary.id} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                        <div className="font-medium">{salary.user.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={salary.base_salary}
                          onChange={(e) => handleUpdateSalary(salary.id, 'base_salary', e.target.value)}
                          className={`w-24 px-2 py-1 text-sm rounded ${
                            isDark
                              ? 'bg-gray-800 text-white border border-gray-700'
                              : 'bg-white text-gray-900 border border-gray-300'
                          }`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={salary.overtime_pay}
                          onChange={(e) => handleUpdateSalary(salary.id, 'overtime_pay', e.target.value)}
                          className={`w-24 px-2 py-1 text-sm rounded ${
                            isDark
                              ? 'bg-gray-800 text-white border border-gray-700'
                              : 'bg-white text-gray-900 border border-gray-300'
                          }`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={salary.bonuses}
                          onChange={(e) => handleUpdateSalary(salary.id, 'bonuses', e.target.value)}
                          className={`w-24 px-2 py-1 text-sm rounded ${
                            isDark
                              ? 'bg-gray-800 text-white border border-gray-700'
                              : 'bg-white text-gray-900 border border-gray-300'
                          }`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={salary.deductions}
                          onChange={(e) => handleUpdateSalary(salary.id, 'deductions', e.target.value)}
                          className={`w-24 px-2 py-1 text-sm rounded ${
                            isDark
                              ? 'bg-gray-800 text-white border border-gray-700'
                              : 'bg-white text-gray-900 border border-gray-300'
                          }`}
                        />
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        ¥{salary.total_salary.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleUpdatePaymentStatus(
                            salary.id,
                            salary.payment_status === 'paid' ? 'pending' : 'paid'
                          )}
                          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                            salary.payment_status === 'paid'
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                          }`}
                        >
                          {salary.payment_status === 'paid' ? '支払済' : '未払い'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {salaries.length === 0 && (
                <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <p>給料データがありません</p>
                  <p className="text-sm mt-2">上の「+ 作成」ボタンから給料レコードを作成してください</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className={`rounded-2xl border overflow-hidden ${
          isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm md:text-base">
              <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>ユニット</th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>メンバー</th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>稼働時間</th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>合計粗利</th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>時間採算</th>
                  <th className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>TODO</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
                {dashboardData
                  .filter(unit => selectedDepartment === 'all' || unit.department === selectedDepartment)
                  .map((unit, index) => (
                  <tr key={index} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {unit.department}
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {unit.memberCount}
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {unit.totalHours}:{String(unit.totalMinutes).padStart(2, '0')}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 md:gap-2">
                        <span className={`text-xs md:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>¥</span>
                        <input
                          type="number"
                          value={unit.totalRevenue}
                          onChange={(e) => handleUpdateRevenue(unit.department, selectedYear, selectedMonth, e.target.value)}
                          className={`w-20 md:w-32 px-1 md:px-2 py-1 text-xs md:text-sm rounded font-medium ${
                            isDark
                              ? 'bg-gray-800 text-green-400 border border-gray-700'
                              : 'bg-white text-green-600 border border-gray-300'
                          } focus:outline-none focus:ring-1 md:focus:ring-2 focus:ring-green-500`}
                        />
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <span className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-bold ${
                        unit.profitPerHour >= 5000 ? 'bg-green-100 text-green-800' :
                        unit.profitPerHour >= 3000 ? 'bg-yellow-100 text-yellow-800' :
                        unit.profitPerHour > 0 ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {unit.profitPerHour > 0 ? `¥${Math.round(unit.profitPerHour).toLocaleString()}/h` : '-'}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <span className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs font-bold ${
                        unit.todoRate === 100 ? 'bg-green-100 text-green-800' :
                        unit.todoRate >= 80 ? 'bg-yellow-100 text-yellow-800' :
                        unit.todoRate >= 50 ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {unit.todoRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dashboardData.length === 0 && (
              <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <p>データがありません</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'todo_achievement' && (
        <div className={`rounded-2xl border overflow-hidden ${
          isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>日付</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>名前</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>タスク総数</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>完了数</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>達成率</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>ステータス</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
                {todoAchievementData.map((data, index) => (
                  <tr key={index} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {new Date(data.date).toLocaleDateString('ja-JP')}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{data.userName}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{data.totalTasks}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{data.completedTasks}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        data.achievementRate === 100 ? 'bg-green-100 text-green-800' :
                        data.achievementRate >= 80 ? 'bg-yellow-100 text-yellow-800' :
                        data.achievementRate >= 50 ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {data.achievementRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xl">
                      {data.achievementRate >= 80 ? '🎉' : data.achievementRate >= 50 ? '👍' : '📝'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {todoAchievementData.length === 0 && (
              <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <p>データがありません</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ヘルスケアサーベイタブ */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {loadingHealth ? (
            <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              読み込み中...
            </div>
          ) : !healthSurvey ? (
            <div className={`rounded-2xl border p-12 text-center ${
              isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
            }`}>
              <div className="text-6xl mb-4">📊</div>
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                アクティブなサーベイがありません
              </p>
            </div>
          ) : (
            <>
              {/* ヘッダー情報 */}
              <div className={`rounded-2xl border p-6 ${
                isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      💚 {healthSurvey.title}
                    </h2>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {healthSurvey.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedHealthPeriod}
                      onChange={(e) => setSelectedHealthPeriod(e.target.value)}
                      className={`px-3 py-2 text-sm rounded-xl transition-colors ${
                        isDark
                          ? 'bg-gray-800 text-white border border-gray-700'
                          : 'bg-white text-gray-900 border border-gray-300'
                      } focus:outline-none`}
                    >
                      {healthPeriods.length === 0 ? (
                        <option value="">回答データなし</option>
                      ) : (
                        healthPeriods.map(period => (
                          <option key={period} value={period}>{period}</option>
                        ))
                      )}
                    </select>
                    <button
                      onClick={() => setShowQuestionEditor(true)}
                      className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors flex items-center gap-2 ${
                        isDark
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-emerald-500 text-white hover:bg-emerald-600'
                      }`}
                    >
                      ✏️ 質問を編集
                    </button>
                  </div>
                </div>
              </div>

              {/* 統計カード */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 回答率 */}
                <div className={`rounded-2xl border p-5 ${
                  isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
                }`}>
                  <div className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    回答率
                  </div>
                  <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {healthResponseRate.rate}%
                  </div>
                  <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {healthResponseRate.completedUsers} / {healthResponseRate.totalUsers}人
                  </div>
                </div>

                {/* 総合スコア */}
                <div className={`rounded-2xl border p-5 ${
                  isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
                }`}>
                  <div className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    総合スコア
                  </div>
                  <div className={`text-3xl font-bold ${
                    Object.values(healthCategoryScores).length > 0
                      ? (Object.values(healthCategoryScores).reduce((a, b) => a + b, 0) / Object.values(healthCategoryScores).length) >= 4
                        ? 'text-green-500'
                        : (Object.values(healthCategoryScores).reduce((a, b) => a + b, 0) / Object.values(healthCategoryScores).length) >= 3
                          ? 'text-yellow-500'
                          : 'text-red-500'
                      : isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {Object.values(healthCategoryScores).length > 0
                      ? (Object.values(healthCategoryScores).reduce((a, b) => a + b, 0) / Object.values(healthCategoryScores).length).toFixed(1)
                      : '-'}
                  </div>
                  <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    5点満点
                  </div>
                </div>

                {/* 回答者数 */}
                <div className={`rounded-2xl border p-5 ${
                  isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
                }`}>
                  <div className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    回答者数
                  </div>
                  <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {healthResponseRate.completedUsers}人
                  </div>
                  <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {healthResults.length}回答
                  </div>
                </div>

                {/* コメント数 */}
                <div className={`rounded-2xl border p-5 ${
                  isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
                }`}>
                  <div className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    コメント数
                  </div>
                  <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {healthComments.length}
                  </div>
                  <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    フリーコメント
                  </div>
                </div>
              </div>

              {/* カテゴリ別スコア */}
              <div className={`rounded-2xl border p-6 ${
                isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
              }`}>
                <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  📊 カテゴリ別スコア
                </h3>
                {Object.keys(healthCategoryScores).length === 0 ? (
                  <p className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    データがありません
                  </p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(healthCategoryScores)
                      .filter(([category]) => category !== 'フリー')
                      .sort((a, b) => b[1] - a[1])
                      .map(([category, score]) => (
                        <div key={category} className="flex items-center gap-4">
                          <div className={`w-24 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {category}
                          </div>
                          <div className="flex-1">
                            <div className={`h-4 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  score >= 4 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                                  score >= 3 ? 'bg-gradient-to-r from-yellow-400 to-orange-400' :
                                  'bg-gradient-to-r from-red-400 to-red-500'
                                }`}
                                style={{ width: `${(score / 5) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div className={`w-12 text-right font-bold ${
                            score >= 4 ? 'text-green-500' :
                            score >= 3 ? 'text-yellow-500' :
                            'text-red-500'
                          }`}>
                            {score.toFixed(1)}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* 部署別スコア */}
              {Object.keys(healthDeptScores).length > 0 && (
                <div className={`rounded-2xl border p-6 ${
                  isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
                }`}>
                  <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    🏢 部署別スコア
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(healthDeptScores)
                      .sort((a, b) => b[1] - a[1])
                      .map(([dept, score]) => (
                        <div 
                          key={dept}
                          className={`p-4 rounded-xl ${
                            isDark ? 'bg-gray-800' : 'bg-gray-50'
                          }`}
                        >
                          <div className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {dept || '未設定'}
                          </div>
                          <div className={`text-2xl font-bold ${
                            score >= 4 ? 'text-green-500' :
                            score >= 3 ? 'text-yellow-500' :
                            'text-red-500'
                          }`}>
                            {score.toFixed(1)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 質問別スコア */}
              <div className={`rounded-2xl border p-6 ${
                isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
              }`}>
                <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  📝 質問別スコア
                </h3>
                {healthQuestionScores.length === 0 ? (
                  <p className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    データがありません
                  </p>
                ) : (
                  <div className="space-y-3">
                    {/* スコアが低い順にソート（問題のある質問を上に） */}
                    {[...healthQuestionScores]
                      .sort((a, b) => a.score - b.score)
                      .map((question, index) => (
                        <div 
                          key={question.id}
                          className={`p-4 rounded-xl ${
                            isDark ? 'bg-gray-800/50' : 'bg-gray-50'
                          } ${question.score < 3 ? (isDark ? 'border border-red-500/30' : 'border border-red-200') : ''}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                                }`}>
                                  {question.category}
                                </span>
                                {question.score < 3 && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-500">
                                    ⚠️ 要注意
                                  </span>
                                )}
                              </div>
                              <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                {question.questionText}
                              </p>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                              <div className={`text-2xl font-bold ${
                                question.score >= 4 ? 'text-green-500' :
                                question.score >= 3 ? 'text-yellow-500' :
                                'text-red-500'
                              }`}>
                                {question.score.toFixed(1)}
                              </div>
                              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {question.responseCount}回答
                              </div>
                            </div>
                          </div>
                          {/* プログレスバー */}
                          <div className="mt-2">
                            <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  question.score >= 4 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                                  question.score >= 3 ? 'bg-gradient-to-r from-yellow-400 to-orange-400' :
                                  'bg-gradient-to-r from-red-400 to-red-500'
                                }`}
                                style={{ width: `${(question.score / 5) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* スコア推移 */}
              <div className={`rounded-2xl border p-6 ${
                isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
              }`}>
                <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  📈 スコア推移
                </h3>
                <div className="relative">
                  {/* Y軸ラベルとグリッド */}
                  <div className="flex">
                    {/* Y軸 */}
                    <div className="flex flex-col justify-between h-48 pr-3 text-right w-8">
                      {[5, 4, 3, 2, 1].map(val => (
                        <span key={val} className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {val}.0
                        </span>
                      ))}
                    </div>
                    
                    {/* グラフエリア */}
                    <div className="flex-1 relative h-48">
                      {/* グリッド線 */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                        {[5, 4, 3, 2, 1].map(val => (
                          <div 
                            key={val} 
                            className={`border-t ${isDark ? 'border-gray-800' : 'border-gray-100'} ${val === 3 ? (isDark ? 'border-gray-700' : 'border-gray-200') : ''}`}
                          />
                        ))}
                      </div>
                      
                      {/* 折れ線グラフ（SVG） - データを月順にソートして描画 */}
                      {(() => {
                        // healthTrendを月順にマッピング（1-12月）
                        const monthlyData = Array(12).fill(null).map((_, i) => {
                          const month = String(i + 1).padStart(2, '0')
                          const found = healthTrend.find(t => t.period.endsWith(`-${month}`))
                          return found ? { ...found, monthIndex: i } : null
                        }).filter(Boolean)
                        
                        if (monthlyData.length === 0) return null
                        
                        return (
                          <>
                            <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                              <defs>
                                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.2"/>
                                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02"/>
                                </linearGradient>
                              </defs>
                              {monthlyData.length > 1 && (
                                <>
                                  {/* エリア塗りつぶし */}
                                  <path
                                    d={`M ${monthlyData.map((item) => {
                                      const x = (item.monthIndex / 11) * 100
                                      const y = 100 - ((item.averageScore - 1) / 4) * 100
                                      return `${x},${y}`
                                    }).join(' L ')} L ${(monthlyData[monthlyData.length - 1].monthIndex / 11) * 100},100 L ${(monthlyData[0].monthIndex / 11) * 100},100 Z`}
                                    fill="url(#areaGradient)"
                                  />
                                  {/* 折れ線 */}
                                  <polyline
                                    points={monthlyData.map((item) => {
                                      const x = (item.monthIndex / 11) * 100
                                      const y = 100 - ((item.averageScore - 1) / 4) * 100
                                      return `${x},${y}`
                                    }).join(' ')}
                                    stroke="#22c55e"
                                    strokeWidth="0.5"
                                    fill="none"
                                  />
                                </>
                              )}
                            </svg>
                            
                            {/* データポイント（CSS配置 - SVGの上に） */}
                            <div className="absolute inset-0 z-10 flex justify-between">
                              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(monthIndex => {
                                const item = monthlyData.find(d => d.monthIndex === monthIndex)
                                if (!item) return <div key={monthIndex} className="w-4" />
                                
                                const yPercent = 100 - ((item.averageScore - 1) / 4) * 100
                                return (
                                  <div key={monthIndex} className="relative w-4">
                                    <div 
                                      className="absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 group"
                                      style={{ top: `${yPercent}%` }}
                                    >
                                      <div className={`w-4 h-4 rounded-full border-[3px] border-green-500 ${isDark ? 'bg-gray-900' : 'bg-white'}`} />
                                      {/* スコア表示（ホバー時） */}
                                      <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity ${
                                        isDark ? 'bg-gray-800 text-green-400' : 'bg-white text-green-600 shadow-lg'
                                      }`}>
                                        {item.averageScore.toFixed(1)}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                  
                  {/* X軸ラベル（1〜12月固定） */}
                  <div className="flex justify-between mt-3 ml-8">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                      const monthStr = String(month).padStart(2, '0')
                      const data = healthTrend.find(t => t.period.endsWith(`-${monthStr}`))
                      return (
                        <div key={month} className="flex flex-col items-center w-8">
                          {data && (
                            <span className={`text-xs font-bold ${
                              data.averageScore >= 4 ? 'text-green-500' :
                              data.averageScore >= 3 ? 'text-yellow-500' :
                              'text-red-500'
                            }`}>
                              {data.averageScore.toFixed(1)}
                            </span>
                          )}
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {month}月
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* フリーコメント */}
              {healthComments.length > 0 && (
                <div className={`rounded-2xl border p-6 ${
                  isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
                }`}>
                  <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    💬 フリーコメント（匿名）
                  </h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {healthComments.map((comment, index) => (
                      <div 
                        key={index}
                        className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}
                      >
                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {comment.free_text}
                        </p>
                        <div className={`flex items-center gap-2 mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {comment.department && (
                            <span className={`px-2 py-0.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                              {comment.department}
                            </span>
                          )}
                          <span>{new Date(comment.created_at).toLocaleDateString('ja-JP')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 質問編集モーダル */}
          {showQuestionEditor && healthSurvey && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowQuestionEditor(false)}
              />
              <div className={`relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl ${
                isDark ? 'bg-gray-900' : 'bg-white'
              }`}>
                {/* ヘッダー */}
                <div className={`px-6 py-4 border-b flex items-center justify-between ${
                  isDark ? 'border-gray-800' : 'border-gray-200'
                }`}>
                  <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ✏️ サーベイ設定
                  </h3>
                  <button
                    onClick={() => setShowQuestionEditor(false)}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                    }`}
                  >
                    ✕
                  </button>
                </div>

                {/* 配信スケジュール設定 */}
                <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                  <h4 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    📅 配信スケジュール
                  </h4>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      サーベイを表示する頻度：
                    </span>
                    <select
                      value={healthSurvey.frequency}
                      onChange={async (e) => {
                        try {
                          const { error } = await supabase
                            .from('health_surveys')
                            .update({ frequency: e.target.value })
                            .eq('id', healthSurvey.id)
                          if (error) throw error
                          await loadHealthSurveyData()
                        } catch (error) {
                          console.error('Error updating frequency:', error)
                          alert('頻度の更新に失敗しました')
                        }
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-xl ${
                        isDark
                          ? 'bg-gray-800 text-white border border-gray-700'
                          : 'bg-white text-gray-900 border border-gray-300'
                      }`}
                    >
                      <option value="weekly">毎週（週1回）</option>
                      <option value="biweekly">隔週（月2回）</option>
                      <option value="monthly">毎月（月1回）</option>
                    </select>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      ※ 出勤時に表示されます
                    </span>
                  </div>
                  <div className={`mt-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    現在の設定: {
                      healthSurvey.frequency === 'weekly' ? '毎週月曜日の初回出勤時' :
                      healthSurvey.frequency === 'biweekly' ? '毎月1日と16日以降の初回出勤時' :
                      '毎月初回の出勤時'
                    }
                  </div>

                  {/* 今すぐ配信ボタン */}
                  <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          🚀 今すぐ配信
                        </div>
                        <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          全員の次回出勤時にサーベイを表示します
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm('全員に対して次回出勤時にサーベイを配信しますか？\n（現在の期間の回答済み状態がリセットされます）')) return
                          try {
                            // 現在の期間の回答済み状態を削除
                            const { error } = await supabase
                              .from('health_survey_completions')
                              .delete()
                              .eq('survey_id', healthSurvey.id)
                              .eq('response_period', selectedHealthPeriod || getCurrentResponsePeriod(healthSurvey.frequency))
                            
                            if (error) throw error
                            
                            alert('配信設定が完了しました！\n全員の次回出勤時にサーベイが表示されます。')
                            await loadHealthSurveyData()
                          } catch (error) {
                            console.error('Error resetting completions:', error)
                            alert('配信設定に失敗しました')
                          }
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors flex items-center gap-2 ${
                          isDark
                            ? 'bg-orange-600 text-white hover:bg-orange-700'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}
                      >
                        🚀 今すぐ全員に配信
                      </button>
                    </div>
                  </div>
                </div>

                {/* 質問リスト */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  <div className="space-y-3">
                    {healthSurvey.questions?.map((question, index) => (
                      <div 
                        key={question.id}
                        className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}
                      >
                        {editingQuestion === question.id ? (
                          /* 編集モード */
                          <div className="space-y-3">
                            <div className="flex gap-3">
                              <select
                                defaultValue={question.category}
                                id={`edit-category-${question.id}`}
                                className={`px-3 py-2 text-sm rounded-lg ${
                                  isDark
                                    ? 'bg-gray-700 text-white border border-gray-600'
                                    : 'bg-white text-gray-900 border border-gray-300'
                                }`}
                              >
                                <option value="仕事">仕事</option>
                                <option value="人間関係">人間関係</option>
                                <option value="健康">健康</option>
                                <option value="成長">成長</option>
                                <option value="承認">承認</option>
                                <option value="支援">支援</option>
                                <option value="フリー">フリー</option>
                              </select>
                              <select
                                defaultValue={question.question_type}
                                id={`edit-type-${question.id}`}
                                className={`px-3 py-2 text-sm rounded-lg ${
                                  isDark
                                    ? 'bg-gray-700 text-white border border-gray-600'
                                    : 'bg-white text-gray-900 border border-gray-300'
                                }`}
                              >
                                <option value="scale">5段階評価</option>
                                <option value="text">自由記述</option>
                              </select>
                            </div>
                            <textarea
                              defaultValue={question.question_text}
                              id={`edit-text-${question.id}`}
                              rows={2}
                              className={`w-full px-3 py-2 text-sm rounded-lg ${
                                isDark
                                  ? 'bg-gray-700 text-white border border-gray-600'
                                  : 'bg-white text-gray-900 border border-gray-300'
                              }`}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const category = document.getElementById(`edit-category-${question.id}`).value
                                  const type = document.getElementById(`edit-type-${question.id}`).value
                                  const text = document.getElementById(`edit-text-${question.id}`).value
                                  handleUpdateQuestion(question.id, {
                                    category,
                                    question_type: type,
                                    question_text: text
                                  })
                                }}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditingQuestion(null)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                                  isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                                }`}
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* 表示モード */
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                                }`}>
                                  {question.category}
                                </span>
                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {question.question_type === 'scale' ? '5段階評価' : '自由記述'}
                                </span>
                              </div>
                              <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                {index + 1}. {question.question_text}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setEditingQuestion(question.id)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                                }`}
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteQuestion(question.id)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-100 text-red-500'
                                }`}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 新規質問追加 */}
                <div className={`px-6 py-4 border-t ${isDark ? 'border-gray-800 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                  <h4 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    ➕ 新しい質問を追加
                  </h4>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <select
                        value={newQuestion.category}
                        onChange={(e) => setNewQuestion({ ...newQuestion, category: e.target.value })}
                        className={`px-3 py-2 text-sm rounded-lg ${
                          isDark
                            ? 'bg-gray-700 text-white border border-gray-600'
                            : 'bg-white text-gray-900 border border-gray-300'
                        }`}
                      >
                        <option value="">カテゴリを選択</option>
                        <option value="仕事">仕事</option>
                        <option value="人間関係">人間関係</option>
                        <option value="健康">健康</option>
                        <option value="成長">成長</option>
                        <option value="承認">承認</option>
                        <option value="支援">支援</option>
                        <option value="フリー">フリー</option>
                      </select>
                      <select
                        value={newQuestion.question_type}
                        onChange={(e) => setNewQuestion({ ...newQuestion, question_type: e.target.value })}
                        className={`px-3 py-2 text-sm rounded-lg ${
                          isDark
                            ? 'bg-gray-700 text-white border border-gray-600'
                            : 'bg-white text-gray-900 border border-gray-300'
                        }`}
                      >
                        <option value="scale">5段階評価</option>
                        <option value="text">自由記述</option>
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newQuestion.question_text}
                        onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                        placeholder="質問文を入力..."
                        className={`flex-1 px-3 py-2 text-sm rounded-lg ${
                          isDark
                            ? 'bg-gray-700 text-white border border-gray-600 placeholder-gray-500'
                            : 'bg-white text-gray-900 border border-gray-300 placeholder-gray-400'
                        }`}
                      />
                      <button
                        onClick={handleAddQuestion}
                        disabled={!newQuestion.category || !newQuestion.question_text}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          !newQuestion.category || !newQuestion.question_text
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-emerald-500 text-white hover:bg-emerald-600'
                        }`}
                      >
                        追加
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className={`rounded-2xl border overflow-hidden ${
          isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    社員情報
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    メールアドレス
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    部署
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    権限
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    登録日
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
                {users.map((user) => (
                  <tr key={user.id} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      <div className="font-medium">{user.name}</div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {user.email}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {user.department || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => {
                          if (window.confirm(`${user.name}さんを${user.role === 'admin' ? '一般ユーザー' : '管理者'}に変更しますか？`)) {
                            handleUpdateUserRole(user.id, user.role === 'admin' ? 'user' : 'admin')
                          }
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {user.role === 'admin' ? '🛡️ 管理者' : '👤 一般'}
                      </button>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {new Date(user.created_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => {
                          if (window.confirm(`${user.name}さんを${user.role === 'admin' ? '一般ユーザー' : '管理者'}に変更しますか？`)) {
                            handleUpdateUserRole(user.id, user.role === 'admin' ? 'user' : 'admin')
                          }
                        }}
                        className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                          isDark
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {user.role === 'admin' ? '👤 一般に変更' : '🛡️ 管理者に変更'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <p>ユーザーデータがありません</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 勤怠データ追加モーダル */}
      {showAddAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* オーバーレイ */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAddAttendanceModal(false)}
          />
          
          {/* モーダル本体 */}
          <div className={`relative w-full max-w-md rounded-2xl shadow-xl ${
            isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white'
          }`}>
            {/* ヘッダー */}
            <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  ➕ 勤怠データを追加
                </h3>
                <button
                  onClick={() => setShowAddAttendanceModal(false)}
                  className={`p-1 rounded-lg transition-colors ${
                    isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                  }`}
                >
                  ✕
                </button>
              </div>
              <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                出勤・退勤を押し忘れた方のデータを手動で追加できます
              </p>
            </div>

            {/* フォーム */}
            <div className="px-6 py-4 space-y-4">
              {/* ユーザー選択 */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  ユーザー <span className="text-red-500">*</span>
                </label>
                <select
                  value={newAttendance.user_id}
                  onChange={(e) => setNewAttendance({ ...newAttendance, user_id: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl transition-colors ${
                    isDark
                      ? 'bg-gray-800 text-white border border-gray-700 focus:border-green-500'
                      : 'bg-white text-gray-900 border border-gray-300 focus:border-green-500'
                  } focus:outline-none focus:ring-2 focus:ring-green-500/20`}
                >
                  <option value="">ユーザーを選択...</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.department || '部署未設定'})
                    </option>
                  ))}
                </select>
              </div>

              {/* 日付 */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  日付 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={newAttendance.date}
                  onChange={(e) => setNewAttendance({ ...newAttendance, date: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl transition-colors ${
                    isDark
                      ? 'bg-gray-800 text-white border border-gray-700 focus:border-green-500'
                      : 'bg-white text-gray-900 border border-gray-300 focus:border-green-500'
                  } focus:outline-none focus:ring-2 focus:ring-green-500/20`}
                />
              </div>

              {/* 出勤・退勤時刻 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    出勤時刻 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={newAttendance.clock_in}
                    onChange={(e) => setNewAttendance({ ...newAttendance, clock_in: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl transition-colors ${
                      isDark
                        ? 'bg-gray-800 text-white border border-gray-700 focus:border-green-500'
                        : 'bg-white text-gray-900 border border-gray-300 focus:border-green-500'
                    } focus:outline-none focus:ring-2 focus:ring-green-500/20`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    退勤時刻
                  </label>
                  <input
                    type="time"
                    value={newAttendance.clock_out}
                    onChange={(e) => setNewAttendance({ ...newAttendance, clock_out: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl transition-colors ${
                      isDark
                        ? 'bg-gray-800 text-white border border-gray-700 focus:border-green-500'
                        : 'bg-white text-gray-900 border border-gray-300 focus:border-green-500'
                    } focus:outline-none focus:ring-2 focus:ring-green-500/20`}
                  />
                </div>
              </div>

              {/* 休憩時間・勤務タイプ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    休憩時間（分）
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newAttendance.break_minutes_used}
                    onChange={(e) => setNewAttendance({ ...newAttendance, break_minutes_used: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 rounded-xl transition-colors ${
                      isDark
                        ? 'bg-gray-800 text-white border border-gray-700 focus:border-green-500'
                        : 'bg-white text-gray-900 border border-gray-300 focus:border-green-500'
                    } focus:outline-none focus:ring-2 focus:ring-green-500/20`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    勤務タイプ
                  </label>
                  <select
                    value={newAttendance.work_type}
                    onChange={(e) => setNewAttendance({ ...newAttendance, work_type: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl transition-colors ${
                      isDark
                        ? 'bg-gray-800 text-white border border-gray-700 focus:border-green-500'
                        : 'bg-white text-gray-900 border border-gray-300 focus:border-green-500'
                    } focus:outline-none focus:ring-2 focus:ring-green-500/20`}
                  >
                    <option value="">未設定</option>
                    <option value="office">🏢 出社</option>
                    <option value="remote">🏠 リモート</option>
                  </select>
                </div>
              </div>

              {/* プレビュー */}
              {newAttendance.clock_in && newAttendance.clock_out && (
                <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                  <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    稼働時間プレビュー
                  </div>
                  <div className={`text-lg font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    {(() => {
                      const clockIn = new Date(`2000-01-01T${newAttendance.clock_in}`)
                      const clockOut = new Date(`2000-01-01T${newAttendance.clock_out}`)
                      const totalMinutes = Math.floor((clockOut - clockIn) / 60000) - (newAttendance.break_minutes_used || 0)
                      const hours = Math.floor(totalMinutes / 60)
                      const mins = totalMinutes % 60
                      return totalMinutes > 0 ? `${hours}時間${mins}分` : '0時間'
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* フッター */}
            <div className={`px-6 py-4 border-t flex justify-end gap-3 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <button
                onClick={() => setShowAddAttendanceModal(false)}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={handleCreateAttendance}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  isDark
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                追加する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
