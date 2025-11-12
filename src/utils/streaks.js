import { supabase } from './supabase.js';
import { calculateProgress } from './todo.js';

/**
 * 曜日が月〜金かどうかをチェック
 */
function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5; // 1=月曜, 5=金曜
}

/**
 * 日付文字列から日本時間のDateオブジェクトを作成
 */
function parseJSTDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 出勤ストリークを計算（月〜金の連続出勤日数）
 */
export async function calculateAttendanceStreak(userId) {
  // 過去90日分のデータを取得（十分な範囲）
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const startDate = ninetyDaysAgo.toISOString().split('T')[0];

  const { data: attendances, error } = await supabase
    .from('attendances')
    .select('date, status')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('date', startDate)
    .order('date', { ascending: false });

  if (error) throw error;

  // 今日の日付（日本時間）
  const now = new Date();
  const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const today = jstNow.toISOString().split('T')[0];
  const todayDate = parseJSTDate(today);

  let streak = 0;
  let currentDate = new Date(todayDate);

  // 今日が土日の場合、前の金曜から開始
  while (!isWeekday(currentDate)) {
    currentDate.setDate(currentDate.getDate() - 1);
  }

  // 連続した平日の出勤をカウント
  while (true) {
    if (isWeekday(currentDate)) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const hasAttendance = attendances?.some(a => a.date === dateStr);

      if (hasAttendance) {
        streak++;
      } else {
        break; // 出勤していない平日があったら終了
      }
    }

    // 前の日へ
    currentDate.setDate(currentDate.getDate() - 1);

    // 過去90日以上遡らない
    if (currentDate < ninetyDaysAgo) {
      break;
    }
  }

  return streak;
}

/**
 * TODO達成率ストリークを計算（90%以上の連続日数）
 */
export async function calculateTodoStreak(userId) {
  // 過去90日分のデータを取得
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const startDate = ninetyDaysAgo.toISOString().split('T')[0];

  const { data: todoLists, error } = await supabase
    .from('todo_lists')
    .select(`
      date,
      todo_items (*)
    `)
    .eq('user_id', userId)
    .gte('date', startDate)
    .order('date', { ascending: false });

  if (error) throw error;

  // 今日の日付（日本時間）
  const now = new Date();
  const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const today = jstNow.toISOString().split('T')[0];
  const todayDate = parseJSTDate(today);

  let streak = 0;
  let currentDate = new Date(todayDate);

  // 今日が土日の場合、前の金曜から開始
  while (!isWeekday(currentDate)) {
    currentDate.setDate(currentDate.getDate() - 1);
  }

  // 連続した平日で90%以上達成をカウント
  while (true) {
    if (isWeekday(currentDate)) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const todoList = todoLists?.find(t => t.date === dateStr);

      if (todoList && todoList.todo_items && todoList.todo_items.length > 0) {
        const progress = calculateProgress(todoList.todo_items);
        if (progress >= 90) {
          streak++;
        } else {
          break; // 90%未満の日があったら終了
        }
      } else {
        // TODOが存在しない日は0%とみなしてストリーク終了
        break;
      }
    }

    // 前の日へ
    currentDate.setDate(currentDate.getDate() - 1);

    // 過去90日以上遡らない
    if (currentDate < ninetyDaysAgo) {
      break;
    }
  }

  return streak;
}

/**
 * 両方のストリークを一度に取得
 */
export async function getStreaks(userId) {
  const [attendanceStreak, todoStreak] = await Promise.all([
    calculateAttendanceStreak(userId),
    calculateTodoStreak(userId)
  ]);

  return {
    attendanceStreak,
    todoStreak
  };
}
