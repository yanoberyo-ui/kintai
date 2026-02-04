import { supabase } from '../../../utils/supabase'

/**
 * タイマー開始
 * @param {string} eventId - イベントID
 * @param {number} durationSeconds - タイマー時間（秒）
 * @returns {Promise<Object>} タイマー状態
 */
export async function startTimer(eventId, durationSeconds = 180) {
  // 既存タイマーを確認
  const existing = await getTimerState(eventId)

  if (existing) {
    // 既存タイマーを更新
    const { data, error } = await supabase
      .from('minigame_timer')
      .update({
        started_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        is_running: true
      })
      .eq('event_id', eventId)
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    // 新規タイマー作成
    const { data, error } = await supabase
      .from('minigame_timer')
      .insert({
        event_id: eventId,
        started_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        is_running: true
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}

/**
 * タイマー一時停止
 * 経過時間を計算してduration_secondsを更新
 * @param {string} eventId - イベントID
 * @returns {Promise<Object>} タイマー状態
 */
export async function pauseTimer(eventId) {
  const current = await getTimerState(eventId)
  if (!current || !current.is_running) {
    throw new Error('Timer is not running')
  }

  // 残り時間を計算
  const elapsed = Math.floor((Date.now() - new Date(current.started_at).getTime()) / 1000)
  const remaining = Math.max(0, current.duration_seconds - elapsed)

  const { data, error } = await supabase
    .from('minigame_timer')
    .update({
      is_running: false,
      duration_seconds: remaining,
      started_at: null
    })
    .eq('event_id', eventId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * タイマー再開
 * @param {string} eventId - イベントID
 * @returns {Promise<Object>} タイマー状態
 */
export async function resumeTimer(eventId) {
  const current = await getTimerState(eventId)
  if (!current) {
    throw new Error('Timer not found')
  }
  if (current.is_running) {
    throw new Error('Timer is already running')
  }

  const { data, error } = await supabase
    .from('minigame_timer')
    .update({
      started_at: new Date().toISOString(),
      is_running: true
    })
    .eq('event_id', eventId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * タイマーリセット
 * @param {string} eventId - イベントID
 * @param {number} durationSeconds - リセット後の時間（秒）
 * @returns {Promise<Object>} タイマー状態
 */
export async function resetTimer(eventId, durationSeconds = 180) {
  const existing = await getTimerState(eventId)

  if (existing) {
    const { data, error } = await supabase
      .from('minigame_timer')
      .update({
        started_at: null,
        duration_seconds: durationSeconds,
        is_running: false
      })
      .eq('event_id', eventId)
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('minigame_timer')
      .insert({
        event_id: eventId,
        started_at: null,
        duration_seconds: durationSeconds,
        is_running: false
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// サーバー時刻オフセット（クライアント時刻 - サーバー時刻、ミリ秒）
let serverTimeOffset = 0

/**
 * サーバー時刻オフセットを更新
 * @param {string} serverTimestamp - サーバーからのタイムスタンプ
 */
function updateServerTimeOffset(serverTimestamp) {
  if (serverTimestamp) {
    const serverTime = new Date(serverTimestamp).getTime()
    serverTimeOffset = Date.now() - serverTime
    // オフセットが大きすぎる場合（1分以上）はログ出力
    if (Math.abs(serverTimeOffset) > 60000) {
      console.warn(`Timer: Large server time offset detected: ${serverTimeOffset}ms`)
    }
  }
}

/**
 * タイマー状態取得（サーバー時刻も取得してオフセット計算）
 * @param {string} eventId - イベントID
 * @returns {Promise<Object|null>} タイマー状態
 */
export async function getTimerState(eventId) {
  // サーバー時刻も一緒に取得
  const fetchStart = Date.now()
  const { data, error } = await supabase
    .from('minigame_timer')
    .select('*, updated_at')
    .eq('event_id', eventId)
    .single()
  const fetchEnd = Date.now()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw error
  }

  // updated_atを使ってサーバー時刻オフセットを計算
  // ネットワーク遅延の半分を考慮
  if (data?.updated_at) {
    const networkLatency = fetchEnd - fetchStart
    const adjustedClientTime = fetchStart + networkLatency / 2
    serverTimeOffset = adjustedClientTime - new Date(data.updated_at).getTime()
  }

  return data
}

/**
 * 残り時間を計算（サーバー時刻オフセット考慮）
 * @param {Object} timerState - タイマー状態
 * @returns {number} 残り秒数
 */
export function calculateRemainingSeconds(timerState) {
  if (!timerState) return 0

  if (!timerState.is_running) {
    // 停止中は保存されているduration_secondsがそのまま残り時間
    return timerState.duration_seconds
  }

  // 実行中は経過時間を引く（サーバー時刻オフセットを考慮）
  const serverNow = Date.now() - serverTimeOffset
  const elapsed = Math.floor((serverNow - new Date(timerState.started_at).getTime()) / 1000)
  return Math.max(0, timerState.duration_seconds - elapsed)
}
