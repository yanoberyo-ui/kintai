import { supabase } from '../../../services/supabase';
import { getTodayDate } from '../../../utils/date';

/**
 * 今日の勤怠データを取得
 */
export async function getTodayAttendance(userId: string) {
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
export async function clockIn(userId: string, workType: string | null = null) {
  const today = getTodayDate();
  const now = new Date().toISOString();

  const attendanceData: any = {
    user_id: userId,
    date: today,
    clock_in: now,
    status: 'working'
  };

  if (workType) {
    attendanceData.work_type = workType;
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

  try {
    await logAttendanceAction(data.id, 'clock_in', userId, null, { clock_in: now, work_type: workType });
  } catch (logError) {
    console.error('ログ記録エラー（出勤記録は保存済み）:', logError);
  }

  return data;
}

/**
 * 再出勤（退勤後に再度出勤する）
 */
export async function reClockIn(userId: string, workType: string | null = null) {
  const today = getTodayDate();
  const now = new Date().toISOString();

  const existingAttendance = await getTodayAttendance(userId);

  const updateData: any = {
    clock_out: null,
    last_clock_out: now,
    status: 'working',
    break_minutes_used: existingAttendance?.break_minutes_used || 0,
    total_work_minutes: existingAttendance?.total_work_minutes || 0
  };

  if (workType) {
    updateData.work_type = workType;
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

  try {
    await logAttendanceAction(data.id, 're_clock_in', userId, existingAttendance, data);
  } catch (logError) {
    console.error('ログ記録エラー（再出勤記録は更新済み）:', logError);
  }

  return data;
}

/**
 * 退勤打刻
 */
export async function clockOut(userId: string, additionalBreakMinutes: number = 0) {
  const today = getTodayDate();
  const now = new Date().toISOString();

  const attendance = await getTodayAttendance(userId);
  if (!attendance) {
    throw new Error('出勤打刻がありません');
  }

  const breakSessions = attendance.break_sessions || [];
  let totalBreakMinutes = additionalBreakMinutes;

  for (const session of breakSessions) {
    if (session.end) {
      totalBreakMinutes += session.minutes || 0;
    } else {
      const breakStart = new Date(session.start);
      const breakEnd = new Date(now);
      const breakMinutes = Math.floor((breakEnd.getTime() - breakStart.getTime()) / 60000);
      totalBreakMinutes += breakMinutes;

      session.end = now;
      session.minutes = breakMinutes;
    }
  }

  let lastWorkStart: Date;

  if (attendance.last_clock_out) {
    const lastClockOut = new Date(attendance.last_clock_out);

    const breakAfterReClockIn = breakSessions.filter((session: any) => {
      const sessionStart = new Date(session.start);
      return sessionStart > lastClockOut;
    });

    if (breakAfterReClockIn.length > 0) {
      const lastSession = breakAfterReClockIn[breakAfterReClockIn.length - 1];
      lastWorkStart = new Date(lastSession.end);
    } else {
      lastWorkStart = lastClockOut;
    }
  } else if (breakSessions.length > 0) {
    const lastSession = breakSessions[breakSessions.length - 1];
    lastWorkStart = new Date(lastSession.end);
  } else {
    lastWorkStart = new Date(attendance.clock_in);
  }

  const clockOutTime = new Date(now);
  const lastSessionMinutes = Math.floor((clockOutTime.getTime() - lastWorkStart.getTime()) / 60000);

  const previousWorkMinutes = attendance.total_work_minutes || 0;
  const totalWorkMinutes = Math.max(0, previousWorkMinutes + lastSessionMinutes - additionalBreakMinutes);

  const { data, error } = await supabase
    .from('attendances')
    .update({
      clock_out: now,
      break_sessions: breakSessions,
      break_minutes_used: totalBreakMinutes,
      total_work_minutes: totalWorkMinutes,
      status: 'completed',
      last_clock_out: null
    })
    .eq('user_id', userId)
    .eq('date', today)
    .select()
    .single();

  if (error) {
    console.error('退勤記録の更新エラー:', error);
    throw new Error(`退勤記録の更新に失敗しました: ${error.message}`);
  }

  try {
    await logAttendanceAction(data.id, 'clock_out', userId, attendance, data);
  } catch (logError) {
    console.error('ログ記録エラー（退勤記録は更新済み）:', logError);
  }

  return data;
}

/**
 * 中抜け開始
 */
export async function startBreak(userId: string) {
  const today = getTodayDate();
  const now = new Date().toISOString();

  const attendance = await getTodayAttendance(userId);
  if (!attendance) {
    throw new Error('出勤打刻がありません');
  }

  const breakSessions = attendance.break_sessions || [];
  if (breakSessions.length > 0) {
    const lastSession = breakSessions[breakSessions.length - 1];
    if (!lastSession.end) {
      throw new Error('既に中抜け中です');
    }
  }

  let lastWorkStart: Date;
  if (breakSessions.length > 0) {
    const lastSession = breakSessions[breakSessions.length - 1];
    lastWorkStart = new Date(lastSession.end);
  } else if (attendance.last_clock_out) {
    lastWorkStart = new Date(attendance.last_clock_out);
  } else {
    lastWorkStart = new Date(attendance.clock_in);
  }

  const breakStartTime = new Date(now);
  const currentSessionMinutes = Math.max(0, Math.floor((breakStartTime.getTime() - lastWorkStart.getTime()) / 60000));
  const totalWorkMinutes = (attendance.total_work_minutes || 0) + currentSessionMinutes;

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

  try {
    await logAttendanceAction(data.id, 'break_start', userId, attendance, data);
  } catch (logError) {
    console.error('ログ記録エラー（中抜け記録は更新済み）:', logError);
  }

  return data;
}

/**
 * 中抜け終了（戻り）
 */
export async function endBreak(userId: string) {
  const today = getTodayDate();
  const now = new Date().toISOString();

  const attendance = await getTodayAttendance(userId);
  if (!attendance) {
    throw new Error('出勤打刻がありません');
  }

  const breakSessions = attendance.break_sessions || [];
  if (breakSessions.length === 0) {
    throw new Error('中抜け記録がありません');
  }

  const lastSession = breakSessions[breakSessions.length - 1];
  if (lastSession.end) {
    throw new Error('既に戻り済みです');
  }

  const breakStart = new Date(lastSession.start);
  const breakEnd = new Date(now);
  const breakMinutes = Math.floor((breakEnd.getTime() - breakStart.getTime()) / 60000);

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

  try {
    await logAttendanceAction(data.id, 'break_end', userId, attendance, data);
  } catch (logError) {
    console.error('ログ記録エラー（中抜け記録は更新済み）:', logError);
  }

  return data;
}

/**
 * 監査ログの記録
 */
async function logAttendanceAction(attendanceId: string, actionType: string, userId: string, beforeValue: any, afterValue: any) {
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
    throw error;
  }
}

/**
 * 現在の状態を取得
 */
export function getAttendanceStatus(attendance: any): string {
  if (!attendance) return 'not_started';
  if (attendance.clock_out) return 'completed';

  const breakSessions = attendance.break_sessions || [];
  const lastSession = breakSessions[breakSessions.length - 1];

  if (lastSession && !lastSession.end) {
    return 'on_break';
  }

  return 'working';
}
