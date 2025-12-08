import { supabase } from './supabase.js';
import { getTodayDate } from './date.js';

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
 * DateオブジェクトからJST基準の日付文字列を取得（YYYY-MM-DD形式）
 * toISOString()はUTC基準なので、JST基準で日付文字列を作成する
 */
function formatJSTDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  // 3:00amに日付が切り替わる「今日」の日付を取得
  const today = getTodayDate();
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
      const dateStr = formatJSTDate(currentDate);
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
 * TODOストリークを計算（ToDoを出した連続日数、月〜金のみ）
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

  // 3:00amに日付が切り替わる「今日」の日付を取得
  const today = getTodayDate();
  const todayDate = parseJSTDate(today);

  let streak = 0;
  let currentDate = new Date(todayDate);

  // 今日が土日の場合、前の金曜から開始
  while (!isWeekday(currentDate)) {
    currentDate.setDate(currentDate.getDate() - 1);
  }

  // 連続した平日でToDoを出した日をカウント
  while (true) {
    if (isWeekday(currentDate)) {
      const dateStr = formatJSTDate(currentDate);
      const todoList = todoLists?.find(t => t.date === dateStr);

      // ToDoリストが存在し、ToDoアイテムが1つ以上ある場合
      if (todoList && todoList.todo_items && todoList.todo_items.length > 0) {
        streak++;
      } else {
        // ToDoを出していない平日があったら終了
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
 * TODOストリークが切れそうかどうかを判定
 * @returns {Object} { isAtRisk: boolean, message: string, daysUntilBreak: number }
 */
export async function checkTodoStreakRisk(userId) {
  // 現在のストリークを取得
  const currentStreak = await calculateTodoStreak(userId);
  
  // ストリークが0の場合は警告不要
  if (currentStreak === 0) {
    return { isAtRisk: false, message: '', daysUntilBreak: 0 };
  }

  // 3:00amに日付が切り替わる「今日」の日付を取得
  const today = getTodayDate();
  const todayDate = parseJSTDate(today);

  // 今日が平日かどうか
  const todayIsWeekday = isWeekday(todayDate);

  // 今日のToDoリストを取得
  const { data: todayTodoList } = await supabase
    .from('todo_lists')
    .select(`
      date,
      todo_items (*)
    `)
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  const hasTodayTodos = todayTodoList && todayTodoList.todo_items && todayTodoList.todo_items.length > 0;

  // 明日の日付を計算
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowIsWeekday = isWeekday(tomorrowDate);

  // 警告条件：
  // 1. 今日が平日で、まだToDoを出していない
  // 2. または、今日が金曜で、まだToDoを出していない（来週月曜までストリークが切れる）
  if (todayIsWeekday && !hasTodayTodos) {
    // 今日が金曜の場合
    if (todayDate.getDay() === 5) {
      return {
        isAtRisk: true,
        message: `⚠️ ${currentStreak}日間のストリークが切れそうです！今日ToDoを出さないと、来週月曜までストリークが切れてしまいます。`,
        daysUntilBreak: 3 // 土日を挟んで月曜まで
      };
    } else {
      return {
        isAtRisk: true,
        message: `⚠️ ${currentStreak}日間のストリークが切れそうです！今日ToDoを出さないとストリークが切れてしまいます。`,
        daysUntilBreak: 0 // 今日
      };
    }
  }

  // 明日が平日で、今日ToDoを出していない場合（明日出さないとストリークが切れる）
  if (tomorrowIsWeekday && !hasTodayTodos) {
    return {
      isAtRisk: true,
      message: `⚠️ ${currentStreak}日間のストリークを続けるには、今日ToDoを出してください！`,
      daysUntilBreak: 1 // 明日
    };
  }

  return { isAtRisk: false, message: '', daysUntilBreak: 0 };
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
