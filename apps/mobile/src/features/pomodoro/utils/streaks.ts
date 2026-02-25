import { supabase } from '../../../services/supabase';
import { getTodayDate } from '../../../utils/date';

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function parseJSTDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatJSTDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 出勤ストリークを計算（月〜金の連続出勤日数）
 */
export async function calculateAttendanceStreak(userId: string): Promise<number> {
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

  const today = getTodayDate();
  const todayDate = parseJSTDate(today);

  let streak = 0;
  let currentDate = new Date(todayDate);

  while (!isWeekday(currentDate)) {
    currentDate.setDate(currentDate.getDate() - 1);
  }

  while (true) {
    if (isWeekday(currentDate)) {
      const dateStr = formatJSTDate(currentDate);
      const hasAttendance = attendances?.some((a: any) => a.date === dateStr);

      if (hasAttendance) {
        streak++;
      } else {
        break;
      }
    }

    currentDate.setDate(currentDate.getDate() - 1);

    if (currentDate < ninetyDaysAgo) {
      break;
    }
  }

  return streak;
}

/**
 * TODOストリークを計算（ToDoを出した連続日数、月〜金のみ）
 */
export async function calculateTodoStreak(userId: string): Promise<number> {
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

  const today = getTodayDate();
  const todayDate = parseJSTDate(today);

  let streak = 0;
  let currentDate = new Date(todayDate);

  while (!isWeekday(currentDate)) {
    currentDate.setDate(currentDate.getDate() - 1);
  }

  while (true) {
    if (isWeekday(currentDate)) {
      const dateStr = formatJSTDate(currentDate);
      const todoList = todoLists?.find((t: any) => t.date === dateStr);

      if (todoList && todoList.todo_items && todoList.todo_items.length > 0) {
        streak++;
      } else {
        break;
      }
    }

    currentDate.setDate(currentDate.getDate() - 1);

    if (currentDate < ninetyDaysAgo) {
      break;
    }
  }

  return streak;
}

/**
 * TODOストリークが切れそうかどうかを判定
 */
export async function checkTodoStreakRisk(userId: string) {
  const currentStreak = await calculateTodoStreak(userId);

  if (currentStreak === 0) {
    return { isAtRisk: false, message: '', daysUntilBreak: 0 };
  }

  const today = getTodayDate();
  const todayDate = parseJSTDate(today);
  const todayIsWeekday = isWeekday(todayDate);

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

  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowIsWeekday = isWeekday(tomorrowDate);

  if (todayIsWeekday && !hasTodayTodos) {
    if (todayDate.getDay() === 5) {
      return {
        isAtRisk: true,
        message: `${currentStreak}日間のストリークが切れそうです！今日ToDoを出さないと、来週月曜までストリークが切れてしまいます。`,
        daysUntilBreak: 3
      };
    } else {
      return {
        isAtRisk: true,
        message: `${currentStreak}日間のストリークが切れそうです！今日ToDoを出さないとストリークが切れてしまいます。`,
        daysUntilBreak: 0
      };
    }
  }

  if (tomorrowIsWeekday && !hasTodayTodos) {
    return {
      isAtRisk: true,
      message: `${currentStreak}日間のストリークを続けるには、今日ToDoを出してください！`,
      daysUntilBreak: 1
    };
  }

  return { isAtRisk: false, message: '', daysUntilBreak: 0 };
}

/**
 * 両方のストリークを一度に取得
 */
export async function getStreaks(userId: string) {
  const [attendanceStreak, todoStreak] = await Promise.all([
    calculateAttendanceStreak(userId),
    calculateTodoStreak(userId)
  ]);

  return {
    attendanceStreak,
    todoStreak
  };
}
