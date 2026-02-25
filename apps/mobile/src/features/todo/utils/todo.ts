import { supabase } from '../../../services/supabase';
import { getTodayDate, getYesterdayDate } from '../../../utils/date';

/**
 * 今日のTODOリストを取得
 */
export async function getTodayTodoList(userId: string) {
  const today = getTodayDate();

  const { data, error } = await supabase
    .from('todo_lists')
    .select(`
      *,
      todo_items (
        id,
        todo_list_id,
        content,
        is_completed,
        order_index,
        indent_level,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (data && data.todo_items) {
    data.todo_items.sort((a: any, b: any) => a.order_index - b.order_index);
  }

  return data;
}

/**
 * 前日のTODOリストを取得
 */
export async function getYesterdayTodoList(userId: string) {
  const yesterdayStr = getYesterdayDate();

  const { data, error } = await supabase
    .from('todo_lists')
    .select(`
      *,
      todo_items (*)
    `)
    .eq('user_id', userId)
    .eq('date', yesterdayStr)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
}

/**
 * 前日の未完了TODOを引き継ぐ
 */
export async function carryOverUncompletedTodos(userId: string, newListId: string) {
  const yesterdayList = await getYesterdayTodoList(userId);

  if (!yesterdayList || !yesterdayList.todo_items) {
    return 0;
  }

  const uncompletedItems = yesterdayList.todo_items
    .filter((item: any) => !item.is_completed)
    .sort((a: any, b: any) => a.order_index - b.order_index);

  if (uncompletedItems.length === 0) {
    return 0;
  }

  for (let i = 0; i < uncompletedItems.length; i++) {
    const item = uncompletedItems[i];
    await supabase
      .from('todo_items')
      .insert({
        todo_list_id: newListId,
        content: item.content,
        order_index: i,
        indent_level: item.indent_level || 0,
        is_completed: false
      });
  }

  return uncompletedItems.length;
}

/**
 * 今日のTODOリストを作成
 */
export async function createTodayTodoList(userId: string, title: string = '今日のtodo') {
  const today = getTodayDate();

  const { data, error } = await supabase
    .from('todo_lists')
    .insert({
      user_id: userId,
      date: today,
      title: title
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * TODOリストのタイトルを更新
 */
export async function updateTodoListTitle(listId: string, title: string) {
  const { data, error } = await supabase
    .from('todo_lists')
    .update({ title })
    .eq('id', listId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * TODOアイテムを指定位置に追加
 */
export async function addTodoItemAtPosition(listId: string, content: string, indentLevel: number = 0, afterOrderIndex: number | null = null) {
  if (afterOrderIndex !== null) {
    const { data: itemsToUpdate } = await supabase
      .from('todo_items')
      .select('id, order_index')
      .eq('todo_list_id', listId)
      .gt('order_index', afterOrderIndex)
      .order('order_index', { ascending: false });

    const updatePromises = (itemsToUpdate || []).map((item: any) =>
      supabase
        .from('todo_items')
        .update({ order_index: item.order_index + 1 })
        .eq('id', item.id)
    );
    await Promise.all(updatePromises);
  }

  const newOrderIndex = afterOrderIndex !== null ? afterOrderIndex + 1 :
    (await supabase
      .from('todo_items')
      .select('order_index')
      .eq('todo_list_id', listId)
      .order('order_index', { ascending: false })
      .limit(1)
      .then(({ data }) => data && data.length > 0 ? data[0].order_index + 1 : 0));

  const { data, error } = await supabase
    .from('todo_items')
    .insert({
      todo_list_id: listId,
      content: content,
      order_index: newOrderIndex,
      indent_level: indentLevel
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function addTodoItem(listId: string, content: string, indentLevel: number = 0) {
  const { data: items } = await supabase
    .from('todo_items')
    .select('*')
    .eq('todo_list_id', listId)
    .order('order_index', { ascending: false })
    .limit(1);

  const maxOrder = items && items.length > 0 ? items[0].order_index : -1;

  const { data, error } = await supabase
    .from('todo_items')
    .insert({
      todo_list_id: listId,
      content: content,
      order_index: maxOrder + 1,
      indent_level: indentLevel
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * TODOアイテムを更新
 */
export async function updateTodoItem(itemId: string, updates: Record<string, any>) {
  const { data, error } = await supabase
    .from('todo_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * TODOアイテムを削除
 */
export async function deleteTodoItem(itemId: string) {
  const { error } = await supabase
    .from('todo_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
}

/**
 * TODOアイテムの完了状態を切り替え
 */
export async function toggleTodoItem(itemId: string, isCompleted: boolean) {
  return updateTodoItem(itemId, { is_completed: isCompleted });
}

/**
 * 進捗率を計算
 */
export function calculateProgress(items: any[]): number {
  if (!items || items.length === 0) return 0;

  const completedCount = items.filter((item: any) => item.is_completed).length;
  return Math.round((completedCount / items.length) * 100);
}

/**
 * TODOアイテムの並び順を更新
 */
export async function reorderTodoItems(items: any[]) {
  const updates = items.map((item: any, index: number) =>
    supabase
      .from('todo_items')
      .update({
        order_index: index,
        indent_level: item.indent_level || 0
      })
      .eq('id', item.id)
  );

  await Promise.all(updates);
}

/**
 * 子タスクを取得
 */
export function getChildTasks(items: any[], parentId: string) {
  const parentItem = items.find((item: any) => item.id === parentId);
  if (!parentItem) {
    return [];
  }

  const parentIndex = items.findIndex((item: any) => item.id === parentId);
  const parentIndentLevel = parentItem.indent_level || 0;
  const children: any[] = [];

  for (let i = parentIndex + 1; i < items.length; i++) {
    const item = items[i];
    const itemIndentLevel = item.indent_level || 0;

    if (itemIndentLevel <= parentIndentLevel) {
      break;
    }

    children.push(item);
  }

  return children;
}
