import { supabase } from './supabase'

/**
 * 現在の回答期間を取得（YYYY-MM形式）
 * 月初は1日から、週初は月曜日から計算
 */
export const getCurrentResponsePeriod = (frequency = 'monthly') => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  
  if (frequency === 'monthly') {
    return `${year}-${month}`
  } else if (frequency === 'weekly') {
    // 週番号を計算
    const startOfYear = new Date(year, 0, 1)
    const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000))
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7)
    return `${year}-W${String(weekNumber).padStart(2, '0')}`
  } else if (frequency === 'biweekly') {
    // 隔週（月の前半/後半）
    const half = now.getDate() <= 15 ? '1' : '2'
    return `${year}-${month}-${half}`
  }
  
  return `${year}-${month}`
}

/**
 * アクティブなサーベイを取得
 */
export const getActiveSurvey = async () => {
  try {
    const { data, error } = await supabase
      .from('health_surveys')
      .select(`
        *,
        questions:health_survey_questions(*)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        // データなし
        console.log('No active survey found')
        return null
      }
      console.error('Error fetching survey:', error)
      return null // エラー時もnullを返す（出勤処理を止めない）
    }
    
    // 質問を順番にソート
    if (data?.questions) {
      data.questions.sort((a, b) => a.order_index - b.order_index)
    }
    
    return data
  } catch (error) {
    console.error('Unexpected error in getActiveSurvey:', error)
    return null
  }
}

/**
 * ユーザーがサーベイに回答済みかチェック
 */
export const hasCompletedSurvey = async (userId, surveyId, frequency = 'monthly') => {
  try {
    const period = getCurrentResponsePeriod(frequency)
    
    const { data, error } = await supabase
      .from('health_survey_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('survey_id', surveyId)
      .eq('response_period', period)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking completion:', error)
      return true // エラー時は回答済み扱い（サーベイ表示をスキップ）
    }
    
    return !!data
  } catch (error) {
    console.error('Unexpected error in hasCompletedSurvey:', error)
    return true // エラー時は回答済み扱い
  }
}

/**
 * サーベイ表示が必要かチェック（出勤時に呼び出す）
 */
export const shouldShowSurvey = async (userId) => {
  try {
    const survey = await getActiveSurvey()
    if (!survey) return { shouldShow: false, survey: null }
    
    const completed = await hasCompletedSurvey(userId, survey.id, survey.frequency)
    if (completed) return { shouldShow: false, survey: null }
    
    return { shouldShow: true, survey }
  } catch (error) {
    console.error('Error checking survey status:', error)
    return { shouldShow: false, survey: null }
  }
}

/**
 * サーベイ回答を保存（完全匿名）
 */
export const submitSurveyResponses = async (surveyId, responses, department, userId, frequency = 'monthly') => {
  const period = getCurrentResponsePeriod(frequency)
  
  // 回答データを作成（user_idは含めない = 完全匿名）
  const responseRecords = responses.map(response => ({
    survey_id: surveyId,
    question_id: response.questionId,
    department: department || null,
    score: response.score || null,
    free_text: response.freeText || null,
    response_period: period
  }))
  
  // 回答を保存
  const { error: responseError } = await supabase
    .from('health_survey_responses')
    .insert(responseRecords)
  
  if (responseError) throw responseError
  
  // 回答済みフラグを保存（回答内容とは別テーブルで管理）
  const { error: completionError } = await supabase
    .from('health_survey_completions')
    .insert({
      user_id: userId,
      survey_id: surveyId,
      response_period: period
    })
  
  if (completionError) throw completionError
  
  return true
}

/**
 * サーベイ結果を集計（管理者用）
 */
export const getSurveyResults = async (surveyId, period = null) => {
  let query = supabase
    .from('health_survey_responses')
    .select(`
      *,
      question:health_survey_questions(*)
    `)
    .eq('survey_id', surveyId)
  
  if (period) {
    query = query.eq('response_period', period)
  }
  
  const { data, error } = await query
  
  if (error) throw error
  
  return data
}

/**
 * カテゴリ別平均スコアを計算
 */
export const calculateCategoryScores = (responses) => {
  const categoryScores = {}
  
  responses.forEach(response => {
    if (response.score && response.question?.category) {
      const category = response.question.category
      if (!categoryScores[category]) {
        categoryScores[category] = { total: 0, count: 0 }
      }
      categoryScores[category].total += response.score
      categoryScores[category].count += 1
    }
  })
  
  // 平均を計算
  const result = {}
  Object.keys(categoryScores).forEach(category => {
    const { total, count } = categoryScores[category]
    result[category] = count > 0 ? Math.round((total / count) * 10) / 10 : 0
  })
  
  return result
}

/**
 * 部署別スコアを計算
 */
export const calculateDepartmentScores = (responses) => {
  const deptScores = {}
  
  responses.forEach(response => {
    if (response.score && response.department) {
      const dept = response.department
      if (!deptScores[dept]) {
        deptScores[dept] = { total: 0, count: 0 }
      }
      deptScores[dept].total += response.score
      deptScores[dept].count += 1
    }
  })
  
  // 平均を計算
  const result = {}
  Object.keys(deptScores).forEach(dept => {
    const { total, count } = deptScores[dept]
    result[dept] = count > 0 ? Math.round((total / count) * 10) / 10 : 0
  })
  
  return result
}

/**
 * 期間別スコア推移を取得
 */
export const getScoreTrend = async (surveyId, periods = 6) => {
  const { data, error } = await supabase
    .from('health_survey_responses')
    .select('score, response_period')
    .eq('survey_id', surveyId)
    .not('score', 'is', null)
    .order('response_period', { ascending: false })
  
  if (error) throw error
  
  // 期間ごとに集計
  const periodScores = {}
  data.forEach(response => {
    const period = response.response_period
    if (!periodScores[period]) {
      periodScores[period] = { total: 0, count: 0 }
    }
    periodScores[period].total += response.score
    periodScores[period].count += 1
  })
  
  // 最新N期間の平均スコアを返す
  const sortedPeriods = Object.keys(periodScores).sort().reverse().slice(0, periods)
  
  return sortedPeriods.map(period => ({
    period,
    averageScore: Math.round((periodScores[period].total / periodScores[period].count) * 10) / 10,
    responseCount: periodScores[period].count
  })).reverse()
}

/**
 * 回答率を計算
 */
export const getResponseRate = async (surveyId, period) => {
  // 総ユーザー数を取得
  const { count: totalUsers, error: userError } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
  
  if (userError) throw userError
  
  // 質問数を取得
  const { count: questionCount, error: questionError } = await supabase
    .from('health_survey_questions')
    .select('id', { count: 'exact', head: true })
    .eq('survey_id', surveyId)
    .eq('question_type', 'scale') // scaleタイプのみカウント
  
  if (questionError) throw questionError
  
  // 回答数から推定回答者数を計算（より正確）
  const { count: responseCount, error: responseError } = await supabase
    .from('health_survey_responses')
    .select('id', { count: 'exact', head: true })
    .eq('survey_id', surveyId)
    .eq('response_period', period)
    .not('score', 'is', null)
  
  if (responseError) throw responseError
  
  // 回答数 ÷ 質問数 = 推定回答者数
  const estimatedRespondents = questionCount > 0 ? Math.round(responseCount / questionCount) : 0
  
  return {
    totalUsers: totalUsers || 0,
    completedUsers: estimatedRespondents,
    rate: totalUsers > 0 ? Math.round((estimatedRespondents / totalUsers) * 100) : 0
  }
}

/**
 * フリーコメントを取得
 */
export const getFreeComments = async (surveyId, period = null) => {
  let query = supabase
    .from('health_survey_responses')
    .select('free_text, department, created_at')
    .eq('survey_id', surveyId)
    .not('free_text', 'is', null)
    .neq('free_text', '')
    .order('created_at', { ascending: false })
  
  if (period) {
    query = query.eq('response_period', period)
  }
  
  const { data, error } = await query
  
  if (error) throw error
  
  return data
}

/**
 * 利用可能な回答期間のリストを取得
 */
export const getAvailablePeriods = async (surveyId) => {
  const { data, error } = await supabase
    .from('health_survey_responses')
    .select('response_period')
    .eq('survey_id', surveyId)
  
  if (error) throw error
  
  // ユニークな期間を抽出してソート
  const periods = [...new Set(data.map(d => d.response_period))].sort().reverse()
  
  return periods
}
