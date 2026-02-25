import { supabase } from '../../../services/supabase';
import { getTodayDate } from '../../../utils/date';

/**
 * すべてのルーチンTODOを取得
 */
export async function getRoutineTodos(userId: string) {
  const { data, error } = await supabase
    .from('routine_todos')
    .select('*')
    .eq('user_id', userId)
    .order('order_index', { ascending: true });

  if (error) throw error;

  return data || [];
}

/**
 * 今日の完了記録を取得
 */
export async function getTodayCompletions(userId: string) {
  const today = getTodayDate();

  const { data, error } = await supabase
    .from('routine_todo_completions')
    .select('*')
    .eq('user_id', userId)
    .eq('completed_date', today);

  if (error) throw error;

  return data || [];
}

/**
 * ルーチンTODOを追加
 */
export async function addRoutineTodo(userId: string, content: string) {
  const { data: todos } = await supabase
    .from('routine_todos')
    .select('order_index')
    .eq('user_id', userId)
    .order('order_index', { ascending: false })
    .limit(1);

  const maxOrder = todos && todos.length > 0 ? todos[0].order_index : -1;

  const { data, error } = await supabase
    .from('routine_todos')
    .insert({
      user_id: userId,
      content: content,
      order_index: maxOrder + 1
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * ルーチンTODOを削除
 */
export async function deleteRoutineTodo(todoId: string) {
  const { error } = await supabase
    .from('routine_todos')
    .delete()
    .eq('id', todoId);

  if (error) throw error;
}

/**
 * ルーチンTODOの完了状態を切り替え
 */
export async function toggleRoutineTodoCompletion(userId: string, todoId: string, isCompleted: boolean) {
  const today = getTodayDate();

  if (isCompleted) {
    const { error } = await supabase
      .from('routine_todo_completions')
      .delete()
      .eq('user_id', userId)
      .eq('routine_todo_id', todoId)
      .eq('completed_date', today);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('routine_todo_completions')
      .insert({
        user_id: userId,
        routine_todo_id: todoId,
        completed_date: today
      });

    if (error) throw error;
  }
}

/**
 * ルーチンTODOの完了状態を計算
 */
export function calculateRoutineProgress(todos: any[], completions: any[]): number {
  if (!todos || todos.length === 0) return 0;

  const completedCount = completions.length;
  return Math.round((completedCount / todos.length) * 100);
}
