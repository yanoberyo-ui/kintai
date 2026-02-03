import { supabase } from '../../../utils/supabase'

/**
 * チェックイン（参加者登録）
 * session_idはlocalStorageで管理される想定
 * @param {string} eventId - イベントID
 * @param {string} name - 参加者名
 * @param {string} sessionId - セッションID
 * @returns {Promise<Object>} 登録された参加者
 */
export async function checkIn(eventId, name, sessionId) {
  // 既に登録済みかチェック
  const existing = await getParticipantBySession(eventId, sessionId)
  if (existing) {
    // 既存の参加者を返す（名前更新はしない）
    return existing
  }

  const { data, error } = await supabase
    .from('minigame_participants')
    .insert({
      event_id: eventId,
      name,
      session_id: sessionId,
      checked_in_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 参加者一覧取得
 * @param {string} eventId - イベントID
 * @returns {Promise<Array>} 参加者一覧
 */
export async function getParticipants(eventId) {
  const { data, error } = await supabase
    .from('minigame_participants')
    .select('*')
    .eq('event_id', eventId)
    .order('checked_in_at', { ascending: true })

  if (error) throw error
  return data
}

/**
 * session_idから参加者取得
 * @param {string} eventId - イベントID
 * @param {string} sessionId - セッションID
 * @returns {Promise<Object|null>} 参加者またはnull
 */
export async function getParticipantBySession(eventId, sessionId) {
  const { data, error } = await supabase
    .from('minigame_participants')
    .select('*')
    .eq('event_id', eventId)
    .eq('session_id', sessionId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // データなし
      return null
    }
    throw error
  }
  return data
}

/**
 * 参加者削除（管理者用）
 * @param {string} participantId - 参加者ID
 * @returns {Promise<void>}
 */
export async function deleteParticipant(participantId) {
  const { error } = await supabase
    .from('minigame_participants')
    .delete()
    .eq('id', participantId)

  if (error) throw error
}

/**
 * 参加者数取得
 * @param {string} eventId - イベントID
 * @returns {Promise<number>} 参加者数
 */
export async function getParticipantCount(eventId) {
  const { count, error } = await supabase
    .from('minigame_participants')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)

  if (error) throw error
  return count || 0
}

/**
 * ログインユーザーで参加登録
 * session_idにuser_idを使用して既存ロジックを再利用
 * @param {string} eventId - イベントID
 * @param {string} userId - ユーザーID
 * @param {string} name - 参加者名
 * @returns {Promise<Object>} 登録された参加者
 */
export async function checkInWithUser(eventId, userId, name) {
  // user_idをsession_idとして使用
  return checkIn(eventId, name, `user_${userId}`)
}

/**
 * ユーザーIDから参加者取得
 * @param {string} eventId - イベントID
 * @param {string} userId - ユーザーID
 * @returns {Promise<Object|null>} 参加者またはnull
 */
export async function getParticipantByUserId(eventId, userId) {
  return getParticipantBySession(eventId, `user_${userId}`)
}
