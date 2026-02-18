import { supabase } from '../../../utils/supabase'
import { getParticipants } from './participant'

/**
 * 班人数から余りなしの候補を計算
 * @param {number} participantCount - 参加人数
 * @returns {Array} 候補一覧 [{size, tables, remainder, recommended}]
 */
export function getSizeOptions(participantCount) {
  const options = []
  for (let size = 3; size <= 6; size++) {
    const remainder = participantCount % size
    const tables = Math.floor(participantCount / size)
    if (tables < 1) continue
    options.push({
      size,
      tables: remainder === 0 ? tables : tables + (remainder >= 3 ? 1 : 0),
      remainder,
      recommended: remainder === 0
    })
  }
  return options
}

/**
 * テーブル作成（参加人数に応じて自動生成）
 * @param {string} eventId - イベントID
 * @param {number} participantCount - 参加人数
 * @param {number} membersPerTable - 1班あたりの人数
 * @returns {Promise<Array>} 作成されたテーブル一覧（capacityは実際の人数）
 */
export async function createTables(eventId, participantCount, membersPerTable = 4) {
  const baseTableCount = Math.floor(participantCount / membersPerTable)
  const remainder = participantCount % membersPerTable

  // テーブルごとのキャパシティを計算
  const capacities = []

  if (remainder === 0) {
    // 余りなし
    for (let i = 0; i < baseTableCount; i++) capacities.push(membersPerTable)
  } else if (remainder === 1) {
    // 1人余り → 最後のテーブルに追加
    for (let i = 0; i < baseTableCount - 1; i++) capacities.push(membersPerTable)
    capacities.push(membersPerTable + 1)
  } else if (remainder === 2) {
    // 2人余り → 最後の2テーブルに1人ずつ追加
    const adjustCount = Math.min(2, baseTableCount)
    for (let i = 0; i < baseTableCount - adjustCount; i++) capacities.push(membersPerTable)
    for (let i = 0; i < adjustCount; i++) capacities.push(membersPerTable + 1)
  } else {
    // 3人以上余り → 別テーブル作成
    for (let i = 0; i < baseTableCount; i++) capacities.push(membersPerTable)
    capacities.push(remainder)
  }

  // 5人以上のテーブルを分割（membersPerTableが4以下の場合）
  if (membersPerTable <= 4) {
    const finalCapacities = []
    for (const cap of capacities) {
      if (cap >= 2 * 3) {
        // 6人以上なら分割（3+3, 3+4, 4+4, etc）
        const half1 = Math.ceil(cap / 2)
        const half2 = cap - half1
        finalCapacities.push(half1, half2)
      } else {
        finalCapacities.push(cap)
      }
    }
    capacities.length = 0
    capacities.push(...finalCapacities)
  }

  // 既存テーブルを削除
  await supabase
    .from('minigame_tables')
    .delete()
    .eq('event_id', eventId)

  const tables = capacities.map((cap, i) => ({
    event_id: eventId,
    table_number: i + 1,
    capacity: cap
  }))

  const { data, error } = await supabase
    .from('minigame_tables')
    .insert(tables)
    .select()

  if (error) throw error
  return data
}

/**
 * 同卓履歴マトリクスを取得
 * @param {string} eventId - イベントID
 * @param {Array} participants - 参加者一覧
 * @returns {Promise<Map>} 同卓回数マトリクス（key: `${id1}_${id2}`, value: count）
 */
async function getSeatingHistoryMatrix(eventId, participants) {
  const { data, error } = await supabase
    .from('minigame_seating_history')
    .select('participant_id_1, participant_id_2')
    .eq('event_id', eventId)

  if (error) throw error

  const matrix = new Map()

  // 初期化
  for (const p1 of participants) {
    for (const p2 of participants) {
      if (p1.id < p2.id) {
        matrix.set(`${p1.id}_${p2.id}`, 0)
      }
    }
  }

  // 履歴からカウント
  for (const record of data || []) {
    const key = record.participant_id_1 < record.participant_id_2
      ? `${record.participant_id_1}_${record.participant_id_2}`
      : `${record.participant_id_2}_${record.participant_id_1}`
    matrix.set(key, (matrix.get(key) || 0) + 1)
  }

  return matrix
}

/**
 * 2人の同卓回数を取得
 */
function getPairCount(matrix, id1, id2) {
  const key = id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`
  return matrix.get(key) || 0
}

/**
 * 席分け実行
 * グリーディ法で同卓回数最小化
 * @param {string} eventId - イベントID
 * @param {number} roundNumber - ラウンド番号
 * @returns {Promise<Array>} 席配置結果
 */
export async function assignSeating(eventId, roundNumber, membersPerTable = 4) {
  // 参加者取得
  const participants = await getParticipants(eventId)
  if (participants.length === 0) {
    throw new Error('No participants found')
  }

  // テーブル作成/取得
  const tables = await createTables(eventId, participants.length, membersPerTable)

  // 同卓履歴マトリクス取得
  const matrix = await getSeatingHistoryMatrix(eventId, participants)

  // シャッフル
  const shuffled = [...participants].sort(() => Math.random() - 0.5)

  // グリーディ法で席配置
  const assignments = []
  const assigned = new Set()

  for (const table of tables) {
    const tableMembers = []

    // 各テーブルに人を割り当て
    while (tableMembers.length < table.capacity && assigned.size < shuffled.length) {
      let bestCandidate = null
      let bestScore = Infinity

      for (const participant of shuffled) {
        if (assigned.has(participant.id)) continue

        // このテーブルの既存メンバーとの同卓回数の合計を計算
        let score = 0
        for (const member of tableMembers) {
          score += getPairCount(matrix, participant.id, member.id)
        }

        if (score < bestScore) {
          bestScore = score
          bestCandidate = participant
        }
      }

      if (bestCandidate) {
        tableMembers.push(bestCandidate)
        assigned.add(bestCandidate.id)
      } else {
        break
      }
    }

    // 席配置レコード作成
    for (const member of tableMembers) {
      assignments.push({
        event_id: eventId,
        round_number: roundNumber,
        table_id: table.id,
        participant_id: member.id
      })
    }
  }

  // 既存の席配置を削除
  await supabase
    .from('minigame_seating')
    .delete()
    .eq('event_id', eventId)
    .eq('round_number', roundNumber)

  // 新しい席配置を保存
  const { data: seatingData, error: seatingError } = await supabase
    .from('minigame_seating')
    .insert(assignments)
    .select()

  if (seatingError) throw seatingError

  // 同卓履歴を保存
  const historyRecords = []
  for (const table of tables) {
    const tableAssignments = assignments.filter(a => a.table_id === table.id)
    for (let i = 0; i < tableAssignments.length; i++) {
      for (let j = i + 1; j < tableAssignments.length; j++) {
        const id1 = tableAssignments[i].participant_id
        const id2 = tableAssignments[j].participant_id
        historyRecords.push({
          event_id: eventId,
          participant_id_1: id1 < id2 ? id1 : id2,
          participant_id_2: id1 < id2 ? id2 : id1,
          round_number: roundNumber
        })
      }
    }
  }

  if (historyRecords.length > 0) {
    const { error: historyError } = await supabase
      .from('minigame_seating_history')
      .insert(historyRecords)

    if (historyError) throw historyError
  }

  return seatingData
}

/**
 * 現在の席配置取得
 * @param {string} eventId - イベントID
 * @param {number} roundNumber - ラウンド番号
 * @param {boolean} confirmedOnly - 確定済みのみ取得するか（参加者側はtrue、管理者側はfalse）
 * @returns {Promise<Array>} 席配置（テーブルごとにグループ化）
 */
export async function getCurrentSeating(eventId, roundNumber, confirmedOnly = false) {
  let query = supabase
    .from('minigame_seating')
    .select(`
      *,
      table:minigame_tables(*),
      participant:minigame_participants(*)
    `)
    .eq('event_id', eventId)
    .eq('round_number', roundNumber)
    .order('table_id')

  if (confirmedOnly) {
    query = query.eq('is_confirmed', true)
  }

  const { data, error } = await query

  if (error) throw error

  // テーブルごとにグループ化（seating_idとis_confirmedも含める）
  const grouped = {}
  let isConfirmed = false
  for (const seat of data || []) {
    const tableId = seat.table_id
    if (!grouped[tableId]) {
      grouped[tableId] = {
        table: seat.table,
        participants: [],
        isConfirmed: seat.is_confirmed
      }
    }
    grouped[tableId].participants.push({
      ...seat.participant,
      seating_id: seat.id
    })
    isConfirmed = seat.is_confirmed
  }

  const result = Object.values(grouped).sort((a, b) => a.table.table_number - b.table.table_number)
  // メタ情報として確定状態を付加
  result.isConfirmed = isConfirmed
  return result
}

/**
 * 最新のラウンド番号を取得
 * @param {string} eventId - イベントID
 * @returns {Promise<number>} 最新のラウンド番号（なければ0）
 */
export async function getLatestRoundNumber(eventId) {
  const { data, error } = await supabase
    .from('minigame_seating')
    .select('round_number')
    .eq('event_id', eventId)
    .order('round_number', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return 0
    }
    throw error
  }

  return data?.round_number || 0
}

/**
 * 席配置を確定する
 * @param {string} eventId - イベントID
 * @param {number} roundNumber - ラウンド番号
 * @returns {Promise<Array>} 更新された席配置
 */
export async function confirmSeating(eventId, roundNumber) {
  const { data, error } = await supabase
    .from('minigame_seating')
    .update({ is_confirmed: true })
    .eq('event_id', eventId)
    .eq('round_number', roundNumber)
    .select()

  if (error) throw error
  return data
}

/**
 * 2人の参加者の席を入れ替える
 * @param {string} seatingId1 - 席配置ID1
 * @param {string} seatingId2 - 席配置ID2
 * @returns {Promise<Array>} 更新された席配置
 */
export async function swapParticipants(seatingId1, seatingId2) {
  // 両方の席配置を取得
  const { data: seats, error: fetchError } = await supabase
    .from('minigame_seating')
    .select('*')
    .in('id', [seatingId1, seatingId2])

  if (fetchError) throw fetchError
  if (seats.length !== 2) {
    throw new Error('Invalid seating IDs')
  }

  const seat1 = seats.find(s => s.id === seatingId1)
  const seat2 = seats.find(s => s.id === seatingId2)

  // 参加者IDを入れ替え
  const { data: updated1, error: error1 } = await supabase
    .from('minigame_seating')
    .update({ participant_id: seat2.participant_id })
    .eq('id', seatingId1)
    .select()
    .single()

  if (error1) throw error1

  const { data: updated2, error: error2 } = await supabase
    .from('minigame_seating')
    .update({ participant_id: seat1.participant_id })
    .eq('id', seatingId2)
    .select()
    .single()

  if (error2) throw error2

  return [updated1, updated2]
}

/**
 * 席配置の確定状態を取得
 * @param {string} eventId - イベントID
 * @param {number} roundNumber - ラウンド番号
 * @returns {Promise<boolean>} 確定済みかどうか
 */
export async function isSeatingConfirmed(eventId, roundNumber) {
  const { data, error } = await supabase
    .from('minigame_seating')
    .select('is_confirmed')
    .eq('event_id', eventId)
    .eq('round_number', roundNumber)
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return false
    }
    throw error
  }

  return data?.is_confirmed || false
}
