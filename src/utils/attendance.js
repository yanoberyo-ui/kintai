import { supabase } from './supabase.js';
import { getTodayDate } from './date.js';

/**
 * 今日の勤怠データを取得
 */
export async function getTodayAttendance(userId) {
  // 3:00amに日付が切り替わる「今日」の日付を取得
  const today = getTodayDate();

  const { data, error } = await supabase
    .from('attendances')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 出勤打刻
 */
export async function clockIn(userId, workType = null) {
  // 3:00amに日付が切り替わる「今日」の日付を取得
  const today = getTodayDate();
  const now = new Date().toISOString(); // 実際の時刻はUTCで保存

  const attendanceData = {
    user_id: userId,
    date: today,
    clock_in: now,
    status: 'working'
  }

  // work_typeが指定されている場合は追加
  if (workType) {
    attendanceData.work_type = workType
  }

  const { data, error } = await supabase
    .from('attendances')
    .upsert(attendanceData, {
      onConflict: 'user_id,date'
    })
    .select()
    .single();

  if (error) {
    console.error('出勤記録の保存エラー:', error);
    throw new Error(`出勤記録の保存に失敗しました: ${error.message}`);
  }

  // ログ記録（エラーが発生しても出勤記録の保存には影響しない）
  try {
    await logAttendanceAction(data.id, 'clock_in', userId, null, { clock_in: now, work_type: workType });
  } catch (logError) {
    console.error('ログ記録エラー（出勤記録は保存済み）:', logError);
    // ログ記録のエラーは無視して続行
  }

  return data;
}

/**
 * 再出勤（退勤後に再度出勤する）
 */
export async function reClockIn(userId, workType = null) {
  // 3:00amに日付が切り替わる「今日」の日付を取得
  const today = getTodayDate();
  const now = new Date().toISOString(); // 再出勤時刻をUTCで保存

  // 既存の勤怠データを取得
  const existingAttendance = await getTodayAttendance(userId);

  const updateData = {
      // clock_inは変更しない（最初の出勤時刻を保持）
      clock_out: null,
      last_clock_out: now, // 再出勤時刻を保存（退勤時にここから計算する）
      status: 'working',
      // 前回の勤務記録は保持
      break_minutes_used: existingAttendance?.break_minutes_used || 0,
      total_work_minutes: existingAttendance?.total_work_minutes || 0
  }

  // work_typeが指定されている場合は更新
  if (workType) {
    updateData.work_type = workType
  }

  const { data, error } = await supabase
    .from('attendances')
    .update(updateData)
    .eq('user_id', userId)
    .eq('date', today)
    .select()
    .single();

  if (error) {
    console.error('再出勤記録の更新エラー:', error);
    throw new Error(`再出勤記録の更新に失敗しました: ${error.message}`);
  }

  // ログ記録（エラーが発生しても再出勤記録の更新には影響しない）
  try {
    await logAttendanceAction(data.id, 're_clock_in', userId, existingAttendance, data);
  } catch (logError) {
    console.error('ログ記録エラー（再出勤記録は更新済み）:', logError);
    // ログ記録のエラーは無視して続行
  }

  return data;
}

/**
 * 退勤打刻
 * 中抜け時間は自動的に休憩時間として計算される
 * @param {string} userId - ユーザーID
 * @param {number} additionalBreakMinutes - 追加の休憩時間（分）
 */
export async function clockOut(userId, additionalBreakMinutes = 0) {
  // 3:00amに日付が切り替わる「今日」の日付を取得
  const today = getTodayDate();
  const now = new Date().toISOString(); // 実際の時刻はUTCで保存

  // 今日の勤怠データを取得
  const attendance = await getTodayAttendance(userId);
  if (!attendance) {
    throw new Error('出勤打刻がありません');
  }

  // 中抜け時間を自動計算（break_sessionsから）
  const breakSessions = attendance.break_sessions || [];
  let totalBreakMinutes = additionalBreakMinutes; // 追加の休憩時間を初期値とする
  
  for (const session of breakSessions) {
    if (session.end) {
      // 完了した中抜けセッションの時間を加算
      totalBreakMinutes += session.minutes || 0;
    } else {
      // 未完了の中抜けセッションがある場合は、現在時刻までを計算
      const breakStart = new Date(session.start);
      const breakEnd = new Date(now);
      const breakMinutes = Math.floor((breakEnd - breakStart) / 60000);
      totalBreakMinutes += breakMinutes;
      
      // 未完了セッションを完了にする
      session.end = now;
      session.minutes = breakMinutes;
    }
  }

  // 最後の勤務セッションの時間を計算
  let lastWorkStart;
  if (breakSessions.length > 0) {
    // 最後の中抜け終了時刻から
    const lastSession = breakSessions[breakSessions.length - 1];
    lastWorkStart = new Date(lastSession.end);
  } else if (attendance.last_clock_out) {
    // 再出勤後の場合
    lastWorkStart = new Date(attendance.last_clock_out);
  } else {
    // 最初の出勤時刻から
    lastWorkStart = new Date(attendance.clock_in);
  }
  
  const clockOutTime = new Date(now);
  const lastSessionMinutes = Math.floor((clockOutTime - lastWorkStart) / 60000);
  
  // 総勤務時間 = 前回までの勤務時間 + 最後のセッションの時間 - 追加休憩時間
  const previousWorkMinutes = attendance.total_work_minutes || 0;
  const totalWorkMinutes = Math.max(0, previousWorkMinutes + lastSessionMinutes - additionalBreakMinutes);

  const { data, error } = await supabase
    .from('attendances')
    .update({
      clock_out: now,
      break_sessions: breakSessions, // 未完了セッションを更新
      break_minutes_used: totalBreakMinutes, // 中抜け時間を自動計算
      total_work_minutes: totalWorkMinutes,
      status: 'completed',
      last_clock_out: null // 退勤時はlast_clock_outをクリア
    })
    .eq('user_id', userId)
    .eq('date', today)
    .select()
    .single();

  if (error) {
    console.error('退勤記録の更新エラー:', error);
    throw new Error(`退勤記録の更新に失敗しました: ${error.message}`);
  }

  // ログ記録（エラーが発生しても退勤記録の更新には影響しない）
  try {
    await logAttendanceAction(data.id, 'clock_out', userId, attendance, data);
  } catch (logError) {
    console.error('ログ記録エラー（退勤記録は更新済み）:', logError);
    // ログ記録のエラーは無視して続行
  }

  return data;
}

/**
 * 中抜け開始
 */
export async function startBreak(userId) {
  // 3:00amに日付が切り替わる「今日」の日付を取得
  const today = getTodayDate();
  const now = new Date().toISOString(); // 実際の時刻はUTCで保存

  const attendance = await getTodayAttendance(userId);
  if (!attendance) {
    throw new Error('出勤打刻がありません');
  }

  // 既に中抜け中でないかチェック
  const breakSessions = attendance.break_sessions || [];
  if (breakSessions.length > 0) {
    const lastSession = breakSessions[breakSessions.length - 1];
    if (!lastSession.end) {
      throw new Error('既に中抜け中です');
    }
  }

  // 中抜け開始前の勤務時間を計算して保存
  let lastWorkStart;
  if (breakSessions.length > 0) {
    // 前回の中抜け終了時刻から
    const lastSession = breakSessions[breakSessions.length - 1];
    lastWorkStart = new Date(lastSession.end);
  } else if (attendance.last_clock_out) {
    // 再出勤時刻から
    lastWorkStart = new Date(attendance.last_clock_out);
  } else {
    // 最初の出勤時刻から
    lastWorkStart = new Date(attendance.clock_in);
  }
  
  const breakStartTime = new Date(now);
  const currentSessionMinutes = Math.max(0, Math.floor((breakStartTime - lastWorkStart) / 60000));
  const totalWorkMinutes = (attendance.total_work_minutes || 0) + currentSessionMinutes;

  // 新しい中抜けセッションを追加
  breakSessions.push({
    start: now,
    end: null,
    minutes: 0
  });

  const { data, error } = await supabase
    .from('attendances')
    .update({
      break_sessions: breakSessions,
      total_work_minutes: totalWorkMinutes
    })
    .eq('user_id', userId)
    .eq('date', today)
    .select()
    .single();

  if (error) {
    console.error('中抜け開始記録の更新エラー:', error);
    throw new Error(`中抜け開始記録の更新に失敗しました: ${error.message}`);
  }

  // ログ記録（エラーが発生しても中抜け記録の更新には影響しない）
  try {
    await logAttendanceAction(data.id, 'break_start', userId, attendance, data);
  } catch (logError) {
    console.error('ログ記録エラー（中抜け記録は更新済み）:', logError);
    // ログ記録のエラーは無視して続行
  }

  return data;
}

/**
 * 中抜け終了（戻り）
 */
export async function endBreak(userId) {
  // 3:00amに日付が切り替わる「今日」の日付を取得
  const today = getTodayDate();
  const now = new Date().toISOString(); // 実際の時刻はUTCで保存

  const attendance = await getTodayAttendance(userId);
  if (!attendance) {
    throw new Error('出勤打刻がありません');
  }

  const breakSessions = attendance.break_sessions || [];
  if (breakSessions.length === 0) {
    throw new Error('中抜け記録がありません');
  }

  // 最後の中抜けセッションを更新
  const lastSession = breakSessions[breakSessions.length - 1];
  if (lastSession.end) {
    throw new Error('既に戻り済みです');
  }

  const breakStart = new Date(lastSession.start);
  const breakEnd = new Date(now);
  const breakMinutes = Math.floor((breakEnd - breakStart) / 60000);

  // 中抜け時間を記録（上限なし）
  const totalBreakMinutes = (attendance.break_minutes_used || 0) + breakMinutes;

  lastSession.end = now;
  lastSession.minutes = breakMinutes;

  const { data, error } = await supabase
    .from('attendances')
    .update({
      break_sessions: breakSessions,
      break_minutes_used: totalBreakMinutes
    })
    .eq('user_id', userId)
    .eq('date', today)
    .select()
    .single();

  if (error) {
    console.error('中抜け終了記録の更新エラー:', error);
    throw new Error(`中抜け終了記録の更新に失敗しました: ${error.message}`);
  }

  // ログ記録（エラーが発生しても中抜け記録の更新には影響しない）
  try {
    await logAttendanceAction(data.id, 'break_end', userId, attendance, data);
  } catch (logError) {
    console.error('ログ記録エラー（中抜け記録は更新済み）:', logError);
    // ログ記録のエラーは無視して続行
  }

  return data;
}

/**
 * 監査ログの記録
 */
async function logAttendanceAction(attendanceId, actionType, userId, beforeValue, afterValue) {
  const { error } = await supabase
    .from('attendance_logs')
    .insert({
      attendance_id: attendanceId,
      action_type: actionType,
      modified_by: userId,
      before_value: beforeValue,
      after_value: afterValue
    });
  
  if (error) {
    // エラーを投げて、呼び出し元で処理できるようにする
    throw error;
  }
}

/**
 * 現在の状態を取得
 */
export function getAttendanceStatus(attendance) {
  if (!attendance) return 'not_started';
  if (attendance.clock_out) return 'completed';

  const breakSessions = attendance.break_sessions || [];
  const lastSession = breakSessions[breakSessions.length - 1];

  if (lastSession && !lastSession.end) {
    return 'on_break';
  }

  return 'working';
}
