import { supabase } from './supabase'

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

/**
 * Googleアクセストークンを取得（必要に応じてリフレッシュ）
 */
export const getGoogleAccessToken = async () => {
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error) {
    console.error('[Google Calendar] セッション取得エラー:', error)
    return null
  }
  
  if (!session) {
    console.warn('[Google Calendar] セッションがありません。ログインしてください。')
    return null
  }
  
  console.log('[Google Calendar] セッション情報:', {
    provider: session.user?.app_metadata?.provider,
    hasProviderToken: !!session.provider_token,
    hasProviderRefreshToken: !!session.provider_refresh_token,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'N/A',
  })
  
  if (!session.provider_token) {
    console.error('[Google Calendar] provider_tokenがありません。', {
      hint: 'Googleでログインし直すか、Calendar APIスコープが許可されているか確認してください。',
      currentProvider: session.user?.app_metadata?.provider,
      email: session.user?.email,
    })
    return null
  }
  
  console.log('[Google Calendar] アクセストークン取得成功')
  return session.provider_token
}

/**
 * Googleカレンダーからイベントを取得
 */
export const fetchGoogleCalendarEvents = async (accessToken, timeMin, timeMax) => {
  if (!accessToken) return []
  
  try {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100',
    })
    
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    
    if (!response.ok) {
      if (response.status === 401) {
        console.error('Google token expired')
        return []
      }
      throw new Error(`Google Calendar API error: ${response.status}`)
    }
    
    const data = await response.json()
    return data.items || []
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error)
    return []
  }
}

/**
 * GoogleカレンダーイベントをKintaiスケジュール形式に変換
 */
export const convertGoogleEventToSchedule = (event, userId) => {
  const startTime = event.start?.dateTime || event.start?.date
  const endTime = event.end?.dateTime || event.end?.date
  
  // 終日イベントの場合はスキップ
  if (!event.start?.dateTime) {
    return null
  }
  
  return {
    id: `google_${event.id}`,
    google_event_id: event.id,
    user_id: userId,
    title: event.summary || '(タイトルなし)',
    description: event.description || '',
    start_time: startTime,
    end_time: endTime,
    color: getColorFromGoogleColor(event.colorId),
    synced_from_google: true,
    google_link: event.htmlLink,
    // Googleカレンダーのステータス
    status: event.status,
  }
}

/**
 * GoogleカレンダーにイベントをPOST
 */
export const createGoogleCalendarEvent = async (accessToken, schedule) => {
  if (!accessToken) return null
  
  try {
    const event = {
      summary: schedule.title,
      description: schedule.description || '',
      start: {
        dateTime: new Date(schedule.start_time).toISOString(),
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: new Date(schedule.end_time).toISOString(),
        timeZone: 'Asia/Tokyo',
      },
      colorId: getGoogleColorIdFromHex(schedule.color),
    }
    
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    )
    
    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status}`)
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating Google Calendar event:', error)
    return null
  }
}

/**
 * Googleカレンダーのイベントを更新
 */
export const updateGoogleCalendarEvent = async (accessToken, eventId, updates) => {
  if (!accessToken || !eventId) return null
  
  try {
    // まず既存のイベントを取得
    const getResponse = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    
    if (!getResponse.ok) {
      throw new Error(`Failed to get event: ${getResponse.status}`)
    }
    
    const existingEvent = await getResponse.json()
    
    // 更新内容をマージ
    const updatedEvent = {
      ...existingEvent,
      summary: updates.title || existingEvent.summary,
      description: updates.description || existingEvent.description,
      colorId: updates.color ? getGoogleColorIdFromHex(updates.color) : existingEvent.colorId,
    }
    
    if (updates.start_time) {
      updatedEvent.start = {
        dateTime: new Date(updates.start_time).toISOString(),
        timeZone: 'Asia/Tokyo',
      }
    }
    
    if (updates.end_time) {
      updatedEvent.end = {
        dateTime: new Date(updates.end_time).toISOString(),
        timeZone: 'Asia/Tokyo',
      }
    }
    
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedEvent),
      }
    )
    
    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error updating Google Calendar event:', error)
    return null
  }
}

/**
 * Googleカレンダーのイベントを削除
 */
export const deleteGoogleCalendarEvent = async (accessToken, eventId) => {
  if (!accessToken || !eventId) return false
  
  try {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    
    return response.ok || response.status === 404 // 既に削除済みでもOK
  } catch (error) {
    console.error('Error deleting Google Calendar event:', error)
    return false
  }
}

/**
 * タスク完了時にGoogleカレンダーの色を変更
 */
export const markGoogleEventAsCompleted = async (accessToken, eventId) => {
  if (!accessToken || !eventId) return null
  
  try {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          colorId: '8', // グレー（完了色）
        }),
      }
    )
    
    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error marking Google event as completed:', error)
    return null
  }
}

/**
 * Googleカレンダーの色IDからHEX色に変換
 */
const getColorFromGoogleColor = (colorId) => {
  const colorMap = {
    '1': '#7986cb', // ラベンダー
    '2': '#33b679', // セージ
    '3': '#8e24aa', // グレープ
    '4': '#e67c73', // フラミンゴ
    '5': '#f6bf26', // バナナ
    '6': '#f4511e', // タンジェリン
    '7': '#039be5', // ピーコック
    '8': '#616161', // グラファイト（完了色）
    '9': '#3f51b5', // ブルーベリー
    '10': '#0b8043', // バジル
    '11': '#d50000', // トマト
  }
  return colorMap[colorId] || '#3b82f6' // デフォルトは青
}

/**
 * HEX色からGoogleカレンダーの色IDに変換
 */
const getGoogleColorIdFromHex = (hexColor) => {
  // 近い色を探す簡易マッピング
  const hex = hexColor?.toLowerCase() || ''
  
  if (hex.includes('ef4444') || hex.includes('dc2626') || hex.includes('d50000')) return '11' // 赤系
  if (hex.includes('f97316') || hex.includes('ea580c') || hex.includes('f4511e')) return '6' // オレンジ系
  if (hex.includes('eab308') || hex.includes('f6bf26')) return '5' // 黄色系
  if (hex.includes('22c55e') || hex.includes('16a34a') || hex.includes('33b679')) return '2' // 緑系
  if (hex.includes('3b82f6') || hex.includes('2563eb') || hex.includes('039be5')) return '7' // 青系
  if (hex.includes('8b5cf6') || hex.includes('7c3aed') || hex.includes('8e24aa')) return '3' // 紫系
  if (hex.includes('ec4899') || hex.includes('db2777') || hex.includes('e67c73')) return '4' // ピンク系
  if (hex.includes('6b7280') || hex.includes('616161')) return '8' // グレー系
  
  return '7' // デフォルトは青
}

/**
 * Googleカレンダー連携が有効かどうか確認
 */
export const isGoogleCalendarEnabled = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('google_calendar_enabled')
      .eq('id', userId)
      .single()
    
    // カラムがない場合はエラーになるので、falseを返す
    if (error) {
      console.warn('google_calendar_enabled column may not exist:', error.message)
      return false
    }
    
    return data?.google_calendar_enabled || false
  } catch (e) {
    console.warn('Error checking Google Calendar enabled:', e)
    return false
  }
}

/**
 * Googleカレンダー連携を有効/無効にする
 */
export const setGoogleCalendarEnabled = async (userId, enabled) => {
  try {
    const { error } = await supabase
      .from('users')
      .update({ google_calendar_enabled: enabled })
      .eq('id', userId)
    
    if (error) {
      console.warn('Failed to update google_calendar_enabled:', error.message)
      // カラムがない場合は、localStorage にフォールバック
      localStorage.setItem(`google_calendar_enabled_${userId}`, JSON.stringify(enabled))
      return true
    }
    
    return true
  } catch (e) {
    console.warn('Error setting Google Calendar enabled:', e)
    localStorage.setItem(`google_calendar_enabled_${userId}`, JSON.stringify(enabled))
    return true
  }
}

/**
 * Googleカレンダー連携状態を取得（localStorageフォールバック付き）
 */
export const getGoogleCalendarEnabledWithFallback = async (userId) => {
  // まずDBを試す
  const dbEnabled = await isGoogleCalendarEnabled(userId)
  if (dbEnabled) return true
  
  // localStorageフォールバック
  try {
    const stored = localStorage.getItem(`google_calendar_enabled_${userId}`)
    return stored ? JSON.parse(stored) : false
  } catch {
    return false
  }
}
