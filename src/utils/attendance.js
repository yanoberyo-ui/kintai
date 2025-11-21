import { supabase } from './supabase.js';

/**
 * 今日の勤怠データを取得
 */
export async function getTodayAttendance(userId) {
  // 日本時間で今日の日付を取得（より確実な方法）
  const now = new Date()
  const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
  const today = jstDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('attendances')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
}

/**
 * 出勤打刻
 */
export async function clockIn(userId, workType = null) {
  // 日本時間で今日の日付と現在時刻を取得（より確実な方法）
  const currentTime = new Date()
  const jstDate = new Date(currentTime.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
  const today = jstDate.toISOString().split('T')[0];
  const now = currentTime.toISOString(); // 実際の時刻はUTCで保存

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

  if (error) throw error;

  // ログ記録
  await logAttendanceAction(data.id, 'clock_in', userId, null, { clock_in: now, work_type: workType });

  return data;
}

/**
 * 再出勤（退勤後に再度出勤する）
 */
export async function reClockIn(userId) {
  // 日本時間で今日の日付を取得
  const currentTime = new Date()
  const jstDate = new Date(currentTime.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
  const today = jstDate.toISOString().split('T')[0];

  // 既存の勤怠データを取得
  const existingAttendance = await getTodayAttendance(userId);

  const { data, error } = await supabase
    .from('attendances')
    .update({
      // clock_inは変更しない（最初の出勤時刻を保持）
      clock_out: null,
      status: 'working',
      // 前回の勤務記録は保持
      break_minutes_used: existingAttendance?.break_minutes_used || 0,
      total_work_minutes: existingAttendance?.total_work_minutes || 0
    })
    .eq('user_id', userId)
    .eq('date', today)
    .select()
    .single();

  if (error) throw error;

  // ログ記録
  await logAttendanceAction(data.id, 're_clock_in', userId, existingAttendance, data);

  return data;
}

/**
 * 退勤打刻
 */
export async function clockOut(userId, breakMinutes = 0) {
  // 日本時間で今日の日付と現在時刻を取得（より確実な方法）
  const currentTime = new Date()
  const jstDate = new Date(currentTime.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
  const today = jstDate.toISOString().split('T')[0];
  const now = currentTime.toISOString(); // 実際の時刻はUTCで保存

  // 今日の勤怠データを取得
  const attendance = await getTodayAttendance(userId);
  if (!attendance) {
    throw new Error('出勤打刻がありません');
  }

  // 総勤務時間を計算（分）
  const clockIn = new Date(attendance.clock_in);
  const clockOut = new Date(now);
  const totalMinutes = Math.floor((clockOut - clockIn) / 60000);
  const workMinutes = totalMinutes - breakMinutes;

  const { data, error } = await supabase
    .from('attendances')
    .update({
      clock_out: now,
      break_minutes_used: breakMinutes,
      total_work_minutes: workMinutes,
      status: 'completed'
    })
    .eq('user_id', userId)
    .eq('date', today)
    .select()
    .single();

  if (error) throw error;

  // ログ記録
  await logAttendanceAction(data.id, 'clock_out', userId, attendance, data);

  return data;
}

/**
 * 休憩開始
 */
export async function startBreak(userId) {
  // 日本時間で今日の日付と現在時刻を取得（より確実な方法）
  const currentTime = new Date()
  const jstDate = new Date(currentTime.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
  const today = jstDate.toISOString().split('T')[0];
  const now = currentTime.toISOString(); // 実際の時刻はUTCで保存

  const attendance = await getTodayAttendance(userId);
  if (!attendance) {
    throw new Error('出勤打刻がありません');
  }

  // 休憩時間の上限チェック（60分）
  if (attendance.break_minutes_used >= 60) {
    throw new Error('本日の休憩時間は上限に達しています');
  }

  // 新しい休憩セッションを追加
  const breakSessions = attendance.break_sessions || [];
  breakSessions.push({
    start: now,
    end: null,
    minutes: 0
  });

  const { data, error } = await supabase
    .from('attendances')
    .update({
      break_sessions: breakSessions
    })
    .eq('user_id', userId)
    .eq('date', today)
    .select()
    .single();

  if (error) throw error;

  // ログ記録
  await logAttendanceAction(data.id, 'break_start', userId, attendance, data);

  return data;
}

/**
 * 休憩終了
 */
export async function endBreak(userId) {
  // 日本時間で今日の日付と現在時刻を取得（より確実な方法）
  const currentTime = new Date()
  const jstDate = new Date(currentTime.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9時間
  const today = jstDate.toISOString().split('T')[0];
  const now = currentTime.toISOString(); // 実際の時刻はUTCで保存

  const attendance = await getTodayAttendance(userId);
  if (!attendance) {
    throw new Error('出勤打刻がありません');
  }

  const breakSessions = attendance.break_sessions || [];
  if (breakSessions.length === 0) {
    throw new Error('開始された休憩がありません');
  }

  // 最後の休憩セッションを更新
  const lastSession = breakSessions[breakSessions.length - 1];
  if (lastSession.end) {
    throw new Error('すでに休憩は終了しています');
  }

  const breakStart = new Date(lastSession.start);
  const breakEnd = new Date(now);
  const breakMinutes = Math.floor((breakEnd - breakStart) / 60000);

  // 上限チェック
  const totalBreakMinutes = attendance.break_minutes_used + breakMinutes;
  const finalBreakMinutes = Math.min(totalBreakMinutes, 60);
  const actualBreakMinutes = Math.min(breakMinutes, 60 - attendance.break_minutes_used);

  lastSession.end = now;
  lastSession.minutes = actualBreakMinutes;

  const { data, error } = await supabase
    .from('attendances')
    .update({
      break_sessions: breakSessions,
      break_minutes_used: finalBreakMinutes
    })
    .eq('user_id', userId)
    .eq('date', today)
    .select()
    .single();

  if (error) throw error;

  // ログ記録
  await logAttendanceAction(data.id, 'break_end', userId, attendance, data);

  return data;
}

/**
 * 監査ログの記録
 */
async function logAttendanceAction(attendanceId, actionType, userId, beforeValue, afterValue) {
  await supabase
    .from('attendance_logs')
    .insert({
      attendance_id: attendanceId,
      action_type: actionType,
      modified_by: userId,
      before_value: beforeValue,
      after_value: afterValue
    });
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
