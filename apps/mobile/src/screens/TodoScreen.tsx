import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Input, Button, Card } from '../components';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';

interface TodoItem {
  id: string;
  todo_list_id: string;
  content: string;
  is_completed: boolean;
  order_index: number;
  indent_level: number;
  created_at: string;
}

interface TodoList {
  id: string;
  user_id: string;
  date: string;
  title: string;
  todo_items: TodoItem[];
}

function getTodayDate(): string {
  const now = new Date();
  // 3:00am切り替え（Web版と同じロジック）
  const adjusted = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const year = adjusted.getFullYear();
  const month = String(adjusted.getMonth() + 1).padStart(2, '0');
  const day = String(adjusted.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function TodoScreen() {
  const { user } = useAuth();
  const [todoList, setTodoList] = useState<TodoList | null>(null);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const createTodayList = async (): Promise<string | null> => {
    if (!user) return null;

    try {
      const today = getTodayDate();
      const { data, error } = await supabase
        .from('todo_lists')
        .insert({
          user_id: user.id,
          date: today,
          title: '今日のtodo',
        })
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating todo list:', error);
      return null;
    }
  };

  const fetchTodayList = useCallback(async () => {
    if (!user) return;

    try {
      const today = getTodayDate();
      const { data, error } = await supabase
        .from('todo_lists')
        .select(`
          *,
          todo_items (
            id, todo_list_id, content, is_completed,
            order_index, indent_level, created_at
          )
        `)
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // order_indexでソート
        if (data.todo_items) {
          data.todo_items.sort((a: TodoItem, b: TodoItem) => a.order_index - b.order_index);
        }
        setTodoList(data);
      } else {
        // リストが無ければ自動作成（Web版と同じ動作）
        const newListId = await createTodayList();
        if (newListId) {
          setTodoList({
            id: newListId,
            user_id: user.id,
            date: today,
            title: '今日のtodo',
            todo_items: [],
          });
        }
      }
    } catch (error) {
      console.error('Error fetching todo list:', error);
      Alert.alert('エラー', 'TODOの取得に失敗しました');
    } finally {
      setInitialLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTodayList();
  }, [fetchTodayList]);

  const handleAddTodo = async () => {
    if (!newTodo.trim() || !user) return;

    setLoading(true);
    try {
      let listId = todoList?.id;

      // リストがなければ作成
      if (!listId) {
        listId = await createTodayList() ?? undefined;
        if (!listId) return;
      }

      // 現在の最大order_indexを取得
      const maxOrder = todoList?.todo_items?.length
        ? Math.max(...todoList.todo_items.map(i => i.order_index))
        : -1;

      const { error } = await supabase
        .from('todo_items')
        .insert({
          todo_list_id: listId,
          content: newTodo.trim(),
          is_completed: false,
          order_index: maxOrder + 1,
          indent_level: 0,
        });

      if (error) throw error;

      setNewTodo('');
      await fetchTodayList();
    } catch (error) {
      console.error('Error adding todo:', error);
      Alert.alert('エラー', 'TODOの追加に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTodo = async (id: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('todo_items')
        .update({ is_completed: !isCompleted })
        .eq('id', id);

      if (error) throw error;
      await fetchTodayList();
    } catch (error) {
      console.error('Error toggling todo:', error);
      Alert.alert('エラー', 'TODOの更新に失敗しました');
    }
  };

  const handleDeleteTodo = async (id: string) => {
    Alert.alert(
      '削除確認',
      'このTODOを削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('todo_items')
                .delete()
                .eq('id', id);

              if (error) throw error;
              await fetchTodayList();
            } catch (error) {
              console.error('Error deleting todo:', error);
              Alert.alert('エラー', 'TODOの削除に失敗しました');
            }
          },
        },
      ]
    );
  };

  const items = todoList?.todo_items || [];
  const incompleteItems = items.filter(t => !t.is_completed);
  const completedItems = items.filter(t => t.is_completed);

  const renderTodoItem = ({ item }: { item: TodoItem }) => (
    <TouchableOpacity
      style={[styles.todoItem, { marginLeft: (item.indent_level || 0) * 16 }]}
      onPress={() => handleToggleTodo(item.id, item.is_completed)}
      onLongPress={() => handleDeleteTodo(item.id)}
    >
      <View style={styles.todoContent}>
        <View style={[styles.checkbox, item.is_completed && styles.checkboxChecked]}>
          {item.is_completed && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.todoText, item.is_completed && styles.todoTextCompleted]}>
          {item.content}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (initialLoading) {
    return (
      <View style={[styles.container, styles.emptyState]}>
        <Text style={styles.emptyText}>読み込み中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card style={styles.inputCard}>
        <Input
          value={newTodo}
          onChangeText={setNewTodo}
          placeholder="新しいTODOを入力"
          style={styles.input}
        />
        <Button
          title="追加"
          onPress={handleAddTodo}
          loading={loading}
          disabled={!newTodo.trim()}
        />
      </Card>

      {incompleteItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>未完了 ({incompleteItems.length})</Text>
          <FlatList
            data={incompleteItems}
            keyExtractor={(item) => item.id}
            renderItem={renderTodoItem}
            scrollEnabled={false}
          />
        </View>
      )}

      {completedItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>完了 ({completedItems.length})</Text>
          <FlatList
            data={completedItems}
            keyExtractor={(item) => item.id}
            renderItem={renderTodoItem}
            scrollEnabled={false}
          />
        </View>
      )}

      {items.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>TODOがありません</Text>
          <Text style={styles.emptySubtext}>上のフォームから追加してください</Text>
        </View>
      )}

      <Text style={styles.hint}>
        長押しで削除できます
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  inputCard: {
    marginBottom: 24,
  },
  input: {
    marginBottom: 0,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#111827',
  },
  todoItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  todoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  todoText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  todoTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 16,
  },
});
