import { supabase } from '../services/supabase.native';
import { getTodayDate, getYesterdayDate } from './date.js';

/**
 * 今日のTODOリストを取得
 */
export async function getTodayTodoList(userId) {
  // 3:00amに日付が切り替わる「今日」の日付を取得
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

  // todo_itemsをorder_indexでソート
  if (data && data.todo_items) {
    data.todo_items.sort((a, b) => a.order_index - b.order_index);
  }

  return data;
}

/**
 * 今日のTODOリストを作成
 */
/**
 * 前日のTODOリストを取得
 */
export async function getYesterdayTodoList(userId) {
  // 3:00amに日付が切り替わる「昨日」の日付を取得
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
export async function carryOverUncompletedTodos(userId, newListId) {
  const yesterdayList = await getYesterdayTodoList(userId);
  
  if (!yesterdayList || !yesterdayList.todo_items) {
    return 0; // 引き継ぎなし
  }

  // 未完了のアイテムのみフィルタ
  const uncompletedItems = yesterdayList.todo_items
    .filter(item => !item.is_completed)
    .sort((a, b) => a.order_index - b.order_index);

  if (uncompletedItems.length === 0) {
    return 0;
  }

  // 新しいリストに未完了アイテムをコピー
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
export async function createTodayTodoList(userId, title = '今日のtodo') {
  // 3:00amに日付が切り替わる「今日」の日付を取得
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

    // order_indexを並列で一括更新
    const updatePromises = (itemsToUpdate || []).map(item =>
      supabase
        .from('todo_items')
        .update({ order_index: item.order_index + 1 })
        .eq('id', item.id)
    );
    await Promise.all(updatePromises);
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

/**
 * TODOアイテムの並び順を更新
 * @param {Array} items - 新しい順序のアイテム配列
 */
export async function reorderTodoItems(items) {
  // 各アイテムのorder_indexを更新
  const updates = items.map((item, index) =>
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
 * 子タスクを取得（インデントレベルに基づいて直後の子孫を取得）
 * @param {Array} items - order_indexでソート済みの全アイテム配列
 * @param {string} parentId - 親アイテムのID
 * @returns {Array} - 子タスクの配列
 */
export function getChildTasks(items, parentId) {
  const parentItem = items.find(item => item.id === parentId);
  if (!parentItem) {
    return [];
  }

  const parentIndex = items.findIndex(item => item.id === parentId);
  const parentIndentLevel = parentItem.indent_level || 0;
  const children = [];

  // 親の直後から、インデントレベルが親より大きいアイテムを子とする
  for (let i = parentIndex + 1; i < items.length; i++) {
    const item = items[i];
    const itemIndentLevel = item.indent_level || 0;

    // インデントレベルが親以下になったら終了
    if (itemIndentLevel <= parentIndentLevel) {
      break;
    }

    children.push(item);
  }

  return children;
}
