import { supabase } from '../../../utils/supabase'

/**
 * ミッション一覧取得
 * @returns {Promise<Array>} ミッション一覧
 */
export async function getMissions() {
  const { data, error } = await supabase
    .from('minigame_missions')
    .select('*')
    .order('difficulty', { ascending: true })

  if (error) throw error
  return data || []
}

/**
 * 参加者にミッション配布（ランダムに3つ）
 * @param {string} eventId - イベントID
 * @param {string} participantId - 参加者ID
 * @param {Array} otherMembers - 同席メンバーリスト（{name}置換用）
 * @returns {Promise<Array>} 配布されたミッション
 */
export async function assignMissions(eventId, participantId, otherMembers = []) {
  // 既に配布済みかチェック
  const existing = await getParticipantMissions(eventId, participantId)
  if (existing.length > 0) {
    return existing
  }

  // 全ミッション取得
  const missions = await getMissions()
  if (missions.length === 0) {
    throw new Error('No missions available')
  }

  // ランダムに3つ選択（ミッションが3つ未満の場合は全て）
  const shuffled = [...missions].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, Math.min(3, shuffled.length))

  // 配布レコード作成（{name}をランダムな同席メンバーで置換）
  const records = selected.map(mission => {
    let targetParticipantId = null

    // {name}プレースホルダーがある場合、ランダムなメンバーを選択
    if (mission.content.includes('{name}') && otherMembers.length > 0) {
      const randomMember = otherMembers[Math.floor(Math.random() * otherMembers.length)]
      targetParticipantId = randomMember.id
    }

    return {
      event_id: eventId,
      participant_id: participantId,
      mission_id: mission.id,
      target_participant_id: targetParticipantId,
      completed: false
    }
  })

  const { data, error } = await supabase
    .from('minigame_participant_missions')
    .insert(records)
    .select(`
      *,
      mission:minigame_missions(*),
      target:minigame_participants!target_participant_id(id, name)
    `)

  if (error) throw error
  return data
}

/**
 * 参加者のミッション取得
 * @param {string} eventId - イベントID
 * @param {string} participantId - 参加者ID
 * @returns {Promise<Array>} ミッション一覧
 */
export async function getParticipantMissions(eventId, participantId) {
  const { data, error } = await supabase
    .from('minigame_participant_missions')
    .select(`
      *,
      mission:minigame_missions(*),
      target:minigame_participants!target_participant_id(id, name)
    `)
    .eq('event_id', eventId)
    .eq('participant_id', participantId)

  if (error) throw error
  return data || []
}

/**
 * ミッション完了マーク
 * @param {string} participantMissionId - 参加者ミッションID
 * @returns {Promise<Object>} 更新されたレコード
 */
export async function completeMission(participantMissionId) {
  const { data, error } = await supabase
    .from('minigame_participant_missions')
    .update({ completed: true })
    .eq('id', participantMissionId)
    .select(`
      *,
      mission:minigame_missions(*),
      target:minigame_participants!target_participant_id(id, name)
    `)
    .single()

  if (error) throw error
  return data
}

/**
 * ミッション完了を取り消し
 * @param {string} participantMissionId - 参加者ミッションID
 * @returns {Promise<Object>} 更新されたレコード
 */
export async function uncompleteMission(participantMissionId) {
  const { data, error } = await supabase
    .from('minigame_participant_missions')
    .update({ completed: false })
    .eq('id', participantMissionId)
    .select(`
      *,
      mission:minigame_missions(*),
      target:minigame_participants!target_participant_id(id, name)
    `)
    .single()

  if (error) throw error
  return data
}

/**
 * ミッションの回答を保存
 * @param {string} participantMissionId - 参加者ミッションID
 * @param {string} answer - 回答テキスト
 * @returns {Promise<Object>} 更新されたレコード
 */
export async function updateMissionAnswer(participantMissionId, answer) {
  const { data, error } = await supabase
    .from('minigame_participant_missions')
    .update({ answer })
    .eq('id', participantMissionId)
    .select(`
      *,
      mission:minigame_missions(*),
      target:minigame_participants!target_participant_id(id, name)
    `)
    .single()

  if (error) throw error
  return data
}

/**
 * イベント全体のミッション状況取得（管理者用）
 * @param {string} eventId - イベントID
 * @returns {Promise<Object>} 参加者ごとのミッション状況
 */
export async function getAllMissionStatus(eventId) {
  const { data, error } = await supabase
    .from('minigame_participant_missions')
    .select(`
      *,
      mission:minigame_missions(*),
      participant:minigame_participants!participant_id(id, name),
      target:minigame_participants!target_participant_id(id, name)
    `)
    .eq('event_id', eventId)
    .order('participant_id')

  if (error) throw error

  // 参加者ごとにグループ化
  const grouped = {}
  for (const m of data || []) {
    const pId = m.participant?.id
    if (!pId) continue
    if (!grouped[pId]) {
      grouped[pId] = {
        participant: m.participant,
        missions: [],
        completedCount: 0,
        totalCount: 0
      }
    }
    grouped[pId].missions.push(m)
    grouped[pId].totalCount++
    if (m.completed) grouped[pId].completedCount++
  }

  // 全体統計
  const allMissions = data || []
  const totalCompleted = allMissions.filter(m => m.completed).length
  const totalMissions = allMissions.length

  return {
    participants: Object.values(grouped),
    totalCompleted,
    totalMissions,
    completionRate: totalMissions > 0 ? Math.round((totalCompleted / totalMissions) * 100) : 0
  }
}
