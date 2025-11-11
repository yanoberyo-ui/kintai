import { supabase } from './supabase.js';

/**
 * 今日のTODOリストを取得
 */
export async function getTodayTodoList(userId) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('todo_lists')
    .select(`
      *,
      todo_items (*)
    `)
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
}

/**
 * 今日のTODOリストを作成
 */
export async function createTodayTodoList(userId, title = '今日のtodo') {
  const today = new Date().toISOString().split('T')[0];

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
export async function updateTodoListTitle(listId, title) {
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
 * TODOアイテムを追加
 */
export async function addTodoItemAtPosition(listId, content, indentLevel = 0, afterOrderIndex = null) {
  // 指定位置以降のアイテムのorder_indexを1つずつ増やす
  if (afterOrderIndex !== null) {
    const { data: itemsToUpdate } = await supabase
      .from('todo_items')
      .select('id, order_index')
      .eq('todo_list_id', listId)
      .gt('order_index', afterOrderIndex)
      .order('order_index', { ascending: false });

    // order_indexを更新
    for (const item of itemsToUpdate || []) {
      await supabase
        .from('todo_items')
        .update({ order_index: item.order_index + 1 })
        .eq('id', item.id);
    }
  }

  // 新しいアイテムを挿入
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

export async function addTodoItem(listId, content, indentLevel = 0) {
  // 現在の最大order_indexを取得
  const { data: items } = await supabase
    .from('todo_items')
    .select('order_index')
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
export async function updateTodoItem(itemId, updates) {
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
export async function deleteTodoItem(itemId) {
  const { error } = await supabase
    .from('todo_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
}

/**
 * TODOアイテムの完了状態を切り替え
 */
export async function toggleTodoItem(itemId, isCompleted) {
  return updateTodoItem(itemId, { is_completed: isCompleted });
}

/**
 * 進捗率を計算
 */
export function calculateProgress(items) {
  if (!items || items.length === 0) return 0;

  const completedCount = items.filter(item => item.is_completed).length;
  return Math.round((completedCount / items.length) * 100);
}
