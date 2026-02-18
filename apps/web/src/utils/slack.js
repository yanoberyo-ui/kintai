import { supabase } from './supabase.js';

/**
 * Slack通知を送信（出勤・退勤のみ）
 */
export async function sendSlackNotification(type, userData, attendanceData) {
  try {
    // タイムアウト付きで送信（5秒）
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Slack通知がタイムアウトしました')), 5000)
    );
    
    const invokePromise = supabase.functions.invoke('notify-slack', {
      body: {
        type: type, // 'clock_in', 'clock_out', 'break_start', 'break_end'
        user_id: userData.id,
        user_name: userData.name,
        timestamp: new Date().toISOString(),
        work_duration: attendanceData.total_work_minutes || 0,
        break_duration: attendanceData.break_minutes_used || 0,
        actual_work_duration: attendanceData.total_work_minutes || 0
      }
    });

    const { data, error } = await Promise.race([invokePromise, timeoutPromise]);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Slack通知の送信に失敗:', error);
    // Slack通知の失敗は重大なエラーではないため、エラーをスローしない
  }
}
