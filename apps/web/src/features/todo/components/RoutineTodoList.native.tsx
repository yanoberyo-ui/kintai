import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Card } from './native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { spacing } from '../theme';
import { supabase } from '../services/supabase.native';
import {
  getRoutineTodos,
  getTodayCompletions,
  addRoutineTodo,
  toggleRoutineTodoCompletion,
} from '../../../features/todo/utils/routineTodo.native';

interface RoutineTodo {
  id: string;
  content: string;
  order_index: number;
}

interface Completion {
  id: string;
  routine_todo_id: string;
  completed_date: string;
}

interface Props {
  onProgressChange?: (completed: number, total: number) => void;
}

export default function RoutineTodoList({ onProgressChange }: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [todos, setTodos] = useState<RoutineTodo[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (onProgressChange) {
      const completed = completions.length;
      const total = todos.length;
      onProgressChange(completed, total);
    }
  }, [todos, completions, onProgressChange]);

  const loadData = async () => {
    if (!user) return;

    try {
      const [todosData, completionsData] = await Promise.all([
        getRoutineTodos(user.id),
        getTodayCompletions(user.id),
      ]);

      setTodos(todosData);
      setCompletions(completionsData);
    } catch (error) {
      console.error('Error loading routine todos:', error);
      Alert.alert('エラー', 'ルーチンTODOの取得に失敗しました');
    }
  };

  const handleAddTodo = async (content: string) => {
    if (!user || !content.trim()) return;

    try {
      await addRoutineTodo(user.id, content.trim());
      await loadData();
    } catch (error) {
      console.error('Error adding routine todo:', error);
      Alert.alert('エラー', 'ルーチンTODOの追加に失敗しました');
    }
  };

  const handleToggleTodo = async (todoId: string) => {
    if (!user) return;

    const isCompleted = completions.some((c) => c.routine_todo_id === todoId);

    try {
      await toggleRoutineTodoCompletion(user.id, todoId, isCompleted);
      await loadData();
    } catch (error) {
      console.error('Error toggling routine todo:', error);
      Alert.alert('エラー', 'ルーチンTODOの更新に失敗しました');
    }
  };

  const handleUpdateTodo = async (todoId: string, content: string) => {
    if (!user) return;

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { error } = await supabase
        .from('routine_todos')
        .update({ content })
        .eq('id', todoId)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Error updating routine todo:', error);
      Alert.alert('エラー', 'ルーチンTODOの更新に失敗しました');
    }
  };

  const isCompleted = (todoId: string) => {
    return completions.some((c) => c.routine_todo_id === todoId);
  };

  return (
    <Card>
      <Text style={[styles.title, { color: colors.text.primary }]}>定常ToDo</Text>
      <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
        毎日繰り返すタスク（完了状態は毎日リセットされます）
      </Text>

      <View style={styles.todoItemsContainer}>
        {todos.map((todo) => (
          <RoutineTodoItemRow
            key={todo.id}
            todo={todo}
            colors={colors}
            isCompleted={isCompleted(todo.id)}
            onToggle={handleToggleTodo}
            onUpdate={handleUpdateTodo}
          />
        ))}

        {/* 定常タスク追加欄 */}
        <NewRoutineTaskInput colors={colors} onAdd={handleAddTodo} />
      </View>
    </Card>
  );
}

// 定常TODOアイテム表示コンポーネント
function RoutineTodoItemRow({ todo, colors, isCompleted, onToggle, onUpdate }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(todo.content);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editContent.trim() && editContent !== todo.content) {
      await onUpdate(todo.id, editContent.trim());
    }
    setIsEditing(false);
  };

  return (
    <View style={styles.todoItem}>
      <TouchableOpacity
        style={styles.todoCheckbox}
        onPress={() => onToggle(todo.id)}
      >
        <View
          style={[
            styles.checkboxButton,
            {
              backgroundColor: isCompleted
                ? colors.text.secondary
                : colors.text.primary,
            },
          ]}
        >
          {isCompleted ? (
            <Text style={[styles.checkmarkIcon, { color: colors.background }]}>✓</Text>
          ) : (
            <Text style={[styles.arrowIcon, { color: colors.background }]}>▶</Text>
          )}
        </View>
      </TouchableOpacity>

      {isEditing ? (
        <TextInput
          ref={inputRef}
          style={[
            styles.todoContent,
            { color: colors.text.primary },
          ]}
          value={editContent}
          onChangeText={setEditContent}
          onBlur={handleSave}
          onSubmitEditing={handleSave}
          returnKeyType="done"
        />
      ) : (
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => setIsEditing(true)}
        >
          <Text
            style={[
              styles.todoContent,
              { color: colors.text.primary },
              isCompleted && styles.todoContentCompleted,
            ]}
          >
            {todo.content}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// 定常TODO用の新規タスク入力（placeholderあり）
function NewRoutineTaskInput({ colors, onAdd }: any) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAdd(content);
      setContent('');
      inputRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.newTaskContainer}>
      <TextInput
        ref={inputRef}
        style={[
          styles.newRoutineTaskInput,
          { color: colors.text.primary },
        ]}
        placeholder="定常タスクを追加..."
        placeholderTextColor={colors.text.secondary}
        value={content}
        onChangeText={setContent}
        onSubmitEditing={handleSubmit}
        editable={!isSubmitting}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 12,
    marginBottom: spacing.md,
  },
  todoItemsContainer: {
    marginBottom: spacing.sm,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  todoCheckbox: {
    marginRight: spacing.sm,
  },
  checkboxButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkIcon: {
    fontSize: 14,
    fontWeight: '600',
  },
  arrowIcon: {
    fontSize: 12,
    fontWeight: '600',
  },
  todoContent: {
    flex: 1,
    fontSize: 16,
  },
  todoContentCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  newTaskContainer: {
    paddingVertical: spacing.xs,
  },
  newRoutineTaskInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
});
