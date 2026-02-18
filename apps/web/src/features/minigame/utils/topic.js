import { supabase } from '../../../utils/supabase'

/**
 * お題一覧取得
 * @returns {Promise<Array>} お題一覧
 */
export async function getTopics() {
  const { data, error } = await supabase
    .from('minigame_topics')
    .select('*')
    .order('category', { ascending: true })

  if (error) throw error
  return data || []
}

/**
 * お題を引く（テーブル単位、同じラウンドで同じお題は出ない）
 * @param {string} eventId - イベントID
 * @param {string} tableId - テーブルID
 * @param {number} roundNumber - ラウンド番号
 * @returns {Promise<Object>} 引いたお題
 */
export async function drawTopic(eventId, tableId, roundNumber) {
  // 既に引いたお題があるかチェック
  const drawn = await getDrawnTopics(eventId, tableId, roundNumber)

  // このラウンドで既に引いたお題IDのリスト
  const drawnTopicIds = drawn.map(d => d.topic_id)

  // 全お題取得
  const allTopics = await getTopics()
  if (allTopics.length === 0) {
    throw new Error('No topics available')
  }

  // まだ引いていないお題をフィルタ
  const availableTopics = allTopics.filter(t => !drawnTopicIds.includes(t.id))

  // 全て引いた場合はランダムに1つ返す（リセット）
  const topics = availableTopics.length > 0 ? availableTopics : allTopics

  // ランダムに1つ選択
  const topic = topics[Math.floor(Math.random() * topics.length)]

  // 引いた履歴を保存
  const { data, error } = await supabase
    .from('minigame_topic_draws')
    .insert({
      event_id: eventId,
      table_id: tableId,
      round_number: roundNumber,
      topic_id: topic.id,
      drawn_at: new Date().toISOString()
    })
    .select(`
      *,
      topic:minigame_topics(*)
    `)
    .single()

  if (error) throw error
  return data
}

/**
 * テーブルの引いたお題履歴取得
 * @param {string} eventId - イベントID
 * @param {string} tableId - テーブルID
 * @param {number} roundNumber - ラウンド番号
 * @returns {Promise<Array>} 引いたお題履歴
 */
export async function getDrawnTopics(eventId, tableId, roundNumber) {
  const { data, error } = await supabase
    .from('minigame_topic_draws')
    .select(`
      *,
      topic:minigame_topics(*)
    `)
    .eq('event_id', eventId)
    .eq('table_id', tableId)
    .eq('round_number', roundNumber)
    .order('drawn_at', { ascending: true })

  if (error) throw error
  return data || []
}

/**
 * テーブルの最新のお題を取得
 * @param {string} eventId - イベントID
 * @param {string} tableId - テーブルID
 * @param {number} roundNumber - ラウンド番号
 * @returns {Promise<Object|null>} 最新のお題またはnull
 */
export async function getLatestTopic(eventId, tableId, roundNumber) {
  const { data, error } = await supabase
    .from('minigame_topic_draws')
    .select(`
      *,
      topic:minigame_topics(*)
    `)
    .eq('event_id', eventId)
    .eq('table_id', tableId)
    .eq('round_number', roundNumber)
    .order('drawn_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw error
  }
  return data
}
