import { supabase } from './supabase.js';

/**
 * 過去90日分の勤怠データを取得してヒートマップ用に整形
 */
export async function getHeatmapData(userId) {
  // シンプルに現在のUTC時刻から日本時間（UTC+9）を計算
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000; // 9時間をミリ秒に変換
  const jstTime = new Date(now.getTime() + jstOffset);
  
  // 今日の日付（JST）
  const today = new Date(Date.UTC(
    jstTime.getUTCFullYear(),
    jstTime.getUTCMonth(),
    jstTime.getUTCDate()
  ));
  
  // 90日前
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(today.getDate() - 89);

  // YYYY-MM-DD形式に変換
  const formatDate = (date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const startDate = formatDate(ninetyDaysAgo);
  const endDate = formatDate(today);
  
  console.log('Fetching heatmap data from', startDate, 'to', endDate);

  // 勤怠データを取得
  const { data: attendances, error } = await supabase
    .from('attendances')
    .select('date, status, clock_in, clock_out, break_minutes_used')
    .eq('user_id', userId)
    .gte('date', startDate)
    .order('date', { ascending: true });

  if (error) {
    console.error('Supabase error details:', JSON.stringify(error, null, 2));
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error hint:', error.hint);
    throw error;
  }
  
  console.log('Fetched attendances:', attendances?.length || 0);

  // 日付ごとのマップを作成
  const attendanceMap = {};
  attendances?.forEach(att => {
    if (att.clock_in) {
      // 勤務時間を計算（分）
      const clockIn = new Date(`${att.date}T${att.clock_in}`);
      
      // 出勤中の場合は現在時刻まで、退勤済みの場合は退勤時刻まで
      let clockOut;
      if (att.status === 'completed' && att.clock_out) {
        clockOut = new Date(`${att.date}T${att.clock_out}`);
      } else {
        // 出勤中の場合は現在時刻（JST）
        const now = new Date();
        const jstOffset = 9 * 60 * 60 * 1000;
        clockOut = new Date(now.getTime() + jstOffset);
      }
      
      const workMinutes = Math.floor((clockOut - clockIn) / 1000 / 60) - (att.break_minutes_used || 0);
      const workHours = workMinutes / 60;

      attendanceMap[att.date] = {
        workHours: workHours,
        // レベル分け: 0=出勤なし, 1=1-4h, 2=4-8h, 3=8-10h, 4=10h以上
        level: workHours === 0 ? 0
             : workHours < 4 ? 1
             : workHours < 8 ? 2
             : workHours < 10 ? 3
             : 4
      };
    }
  });

  // 90日分の配列を作成
  const heatmapData = [];
  const currentDate = new Date(ninetyDaysAgo);

  for (let i = 0; i < 90; i++) {
    const dateStr = formatDate(currentDate);
    const dayOfWeek = currentDate.getUTCDay(); // 0=日曜, 6=土曜

    heatmapData.push({
      date: dateStr,
      dayOfWeek: dayOfWeek,
      level: attendanceMap[dateStr]?.level || 0,
      workHours: attendanceMap[dateStr]?.workHours || 0
    });

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  console.log('Heatmap data generated:', heatmapData.length, 'days');
  console.log('Start date:', heatmapData[0]?.date, 'End date:', heatmapData[heatmapData.length - 1]?.date);

  return heatmapData;
}
