import { supabase } from '../../../utils/supabase'

/**
 * イベント作成
 * @param {string} name - イベント名
 * @param {string} description - 説明
 * @returns {Promise<Object>} 作成されたイベント
 */
export async function createEvent(name, description = '') {
  const { data, error } = await supabase
    .from('minigame_events')
    .insert({
      name,
      description,
      status: 'waiting'
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * イベント一覧取得
 * @returns {Promise<Array>} イベント一覧
 */
export async function getEvents() {
  const { data, error } = await supabase
    .from('minigame_events')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

/**
 * イベント取得
 * @param {string} eventId - イベントID
 * @returns {Promise<Object>} イベント
 */
export async function getEvent(eventId) {
  const { data, error } = await supabase
    .from('minigame_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (error) throw error
  return data
}

/**
 * イベントステータス更新
 * @param {string} eventId - イベントID
 * @param {string} status - 新しいステータス (waiting/active/finished)
 * @returns {Promise<Object>} 更新されたイベント
 */
export async function updateEventStatus(eventId, status) {
  if (!['waiting', 'active', 'finished'].includes(status)) {
    throw new Error('Invalid status. Must be one of: waiting, active, finished')
  }

  const { data, error } = await supabase
    .from('minigame_events')
    .update({ status })
    .eq('id', eventId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * イベント削除
 * @param {string} eventId - イベントID
 * @returns {Promise<void>}
 */
export async function deleteEvent(eventId) {
  const { error } = await supabase
    .from('minigame_events')
    .delete()
    .eq('id', eventId)

  if (error) throw error
}
