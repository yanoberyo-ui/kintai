import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Card } from './native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { spacing } from '../theme';
import {
  getTodayTodoList,
  createTodayTodoList,
  addTodoItem,
  toggleTodoItem,
  deleteTodoItem,
  calculateProgress,
  carryOverUncompletedTodos,
} from '../../../features/todo/utils/todo.native';

interface TodoItem {
  id: string;
  content: string;
  is_completed: boolean;
  order_index: number;
  indent_level: number;
}

interface TodoList {
  id: string;
  title: string;
  date: string;
  todo_items: TodoItem[];
}

interface Props {
  onProgressChange?: (completed: number, total: number) => void;
}

export default function TodoList({ onProgressChange }: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [todoList, setTodoList] = useState<TodoList | null>(null);
  const [newTodoContent, setNewTodoContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentIndentLevel, setCurrentIndentLevel] = useState(0);
  const [insertingAtIndex, setInsertingAtIndex] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      loadTodoList();
    }
  }, [user]);

  useEffect(() => {
    if (todoList?.todo_items && onProgressChange) {
      const completed = todoList.todo_items.filter((item) => item.is_completed).length;
      const total = todoList.todo_items.length;
      onProgressChange(completed, total);
    }
  }, [todoList, onProgressChange]);

  const loadTodoList = async () => {
    if (!user) return;

    try {
      let list = await getTodayTodoList(user.id);

      if (!list) {
        // 今日のリストがない場合は作成
        list = await createTodayTodoList(user.id);

        // 前日の未完了TODOを引き継ぎ
        const carriedCount = await carryOverUncompletedTodos(user.id, list.id);
        if (carriedCount > 0) {
          // 引き継ぎ後、リストを再取得
          list = await getTodayTodoList(user.id);
        }
      }

      setTodoList(list);
    } catch (error) {
      console.error('Error loading todo list:', error);
      Alert.alert('エラー', 'TODOリストの取得に失敗しました');
    }
  };

  const handleAddTodo = async (content: string, indentLevel: number = 0, afterIndex: number | null = null) => {
    if (!todoList || !content.trim()) return;

    try {
      const { addTodoItemAtPosition } = await import('../utils/todo.native');

      if (afterIndex !== null) {
        // 指定位置に挿入
        await addTodoItemAtPosition(todoList.id, content.trim(), indentLevel, afterIndex);
      } else {
        // 末尾に追加
        await addTodoItem(todoList.id, content.trim(), indentLevel);
      }

      // 挿入モードを解除
      setInsertingAtIndex(null);
      await loadTodoList();
    } catch (error) {
      console.error('Error adding todo:', error);
      Alert.alert('エラー', 'TODOの追加に失敗しました');
      // エラーが発生した場合も挿入モードを解除して、通常の状態に戻す
      setInsertingAtIndex(null);
    }
  };

  const handleToggleTodo = async (itemId: string, isCompleted: boolean) => {
    try {
      await toggleTodoItem(itemId, !isCompleted);
      await loadTodoList();
    } catch (error) {
      console.error('Error toggling todo:', error);
      Alert.alert('エラー', 'TODOの更新に失敗しました');
    }
  };

  const handleUpdateTodo = async (itemId: string, content: string) => {
    try {
      const { updateTodoItem } = await import('../utils/todo.native');
      await updateTodoItem(itemId, { content });
      await loadTodoList();
    } catch (error) {
      console.error('Error updating todo:', error);
      Alert.alert('エラー', 'TODOの更新に失敗しました');
    }
  };

  if (!todoList) {
    return null;
  }

  return (
    <Card>
      <Text style={[styles.title, { color: colors.text.primary }]}>本日のToDo</Text>
      <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
        今日やるべきタスク
      </Text>

      <View style={styles.todoItemsContainer}>
        {todoList.todo_items && todoList.todo_items.length > 0 ? (
          todoList.todo_items.map((item, index) => (
            <React.Fragment key={item.id}>
              <TodoItemRow
                item={item}
                colors={colors}
                onToggle={handleToggleTodo}
                onUpdate={handleUpdateTodo}
              />

              {/* 挿入ボタンまたは挿入用入力欄 */}
              {insertingAtIndex === item.order_index ? (
                <NewTaskInput
                  colors={colors}
                  onAdd={(content: string, indent: number) => handleAddTodo(content, indent, item.order_index)}
                  onCancel={() => setInsertingAtIndex(null)}
                  indentLevel={currentIndentLevel}
                  onIndentChange={setCurrentIndentLevel}
                  autoFocus
                />
              ) : (
                <TouchableOpacity
                  style={styles.insertButton}
                  onPress={() => setInsertingAtIndex(item.order_index)}
                >
                  <Text style={[styles.insertButtonText, { color: colors.text.secondary }]}>+</Text>
                </TouchableOpacity>
              )}
            </React.Fragment>
          ))
        ) : null}

        {/* 新規タスク追加欄（末尾） */}
        {insertingAtIndex === null && (
          <NewTaskInput
            colors={colors}
            onAdd={handleAddTodo}
            indentLevel={currentIndentLevel}
            onIndentChange={setCurrentIndentLevel}
          />
        )}
      </View>
    </Card>
  );
}

// 既存のTODOアイテム表示コンポーネント
function TodoItemRow({ item, colors, onToggle, onUpdate }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(item.content);
  const [localIndent, setLocalIndent] = useState(item.indent_level || 0);
  const inputRef = useRef<TextInput>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setLocalIndent(item.indent_level || 0);
  }, [item.indent_level]);

  const handleTouchStart = (e: any) => {
    if (isEditing) return;
    touchStartX.current = e.nativeEvent.pageX;
    touchStartY.current = e.nativeEvent.pageY;
    setIsDragging(false);
  };

  const handleTouchMove = (e: any) => {
    if (isEditing) return;
    const deltaX = e.nativeEvent.pageX - touchStartX.current;
    const deltaY = Math.abs(e.nativeEvent.pageY - touchStartY.current);

    if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > deltaY) {
      setIsDragging(true);
    }
  };

  const handleTouchEnd = async (e: any) => {
    if (isEditing || !isDragging) {
      setIsDragging(false);
      return;
    }

    const deltaX = e.nativeEvent.pageX - touchStartX.current;
    let newIndent = localIndent;

    if (deltaX > 50 && localIndent < 3) {
      newIndent = localIndent + 1;
      setLocalIndent(newIndent);
    } else if (deltaX < -50 && localIndent > 0) {
      newIndent = localIndent - 1;
      setLocalIndent(newIndent);
    }

    if (newIndent !== localIndent) {
      try {
        const { updateTodoItem } = await import('../utils/todo.native');
        await updateTodoItem(item.id, { indent_level: newIndent });
      } catch (error) {
        console.error('Error updating indent:', error);
      }
    }

    setIsDragging(false);
  };

  const handleSave = async () => {
    if (editContent.trim() && editContent !== item.content) {
      await onUpdate(item.id, editContent.trim());
    }
    setIsEditing(false);
  };

  return (
    <View
      style={[styles.todoItem, { marginLeft: localIndent * 20 }]}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <TouchableOpacity
        style={styles.todoCheckbox}
        onPress={() => onToggle(item.id, item.is_completed)}
      >
        <View
          style={[
            styles.checkboxButton,
            {
              backgroundColor: item.is_completed
                ? colors.text.secondary
                : colors.text.primary,
            },
          ]}
        >
          {item.is_completed ? (
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
              item.is_completed && styles.todoContentCompleted,
            ]}
          >
            {item.content}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// 新規タスク入力コンポーネント（Web版と同じデザイン）
function NewTaskInput({ colors, onAdd, indentLevel, onIndentChange, onCancel, autoFocus }: any) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localIndent, setLocalIndent] = useState(indentLevel || 0);
  const inputRef = useRef<TextInput>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setLocalIndent(indentLevel || 0);
  }, [indentLevel]);

  useEffect(() => {
    if (autoFocus) {
      // 少し遅延させてフォーカス
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [autoFocus]);

  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
    touchStartY.current = e.nativeEvent.pageY;
    setIsDragging(false);
  };

  const handleTouchMove = (e: any) => {
    const deltaX = e.nativeEvent.pageX - touchStartX.current;
    const deltaY = Math.abs(e.nativeEvent.pageY - touchStartY.current);

    if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > deltaY) {
      setIsDragging(true);
    }
  };

  const handleTouchEnd = (e: any) => {
    if (!isDragging) return;

    const deltaX = e.nativeEvent.pageX - touchStartX.current;

    if (deltaX > 50 && localIndent < 3) {
      const newIndent = localIndent + 1;
      setLocalIndent(newIndent);
      onIndentChange?.(newIndent);
    } else if (deltaX < -50 && localIndent > 0) {
      const newIndent = localIndent - 1;
      setLocalIndent(newIndent);
      onIndentChange?.(newIndent);
    }

    setIsDragging(false);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // 内容が空でキャンセルハンドラーがある場合はキャンセル
    if (!content.trim() && onCancel) {
      onCancel();
      return;
    }

    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await onAdd(content, localIndent);
      setContent('');
      if (!onCancel) {
        // 通常の追加欄の場合のみフォーカスを維持
        inputRef.current?.focus();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View
      style={[styles.newTaskContainer, { marginLeft: localIndent * 20 }]}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 左側の丸いアイコン */}
      <View
        style={[
          styles.newTaskIcon,
          {
            backgroundColor: colors.text.primary,
          },
        ]}
      >
        <Text style={[styles.newTaskIconText, { color: colors.background }]}>
          ▶
        </Text>
      </View>

      <TextInput
        ref={inputRef}
        style={[
          styles.newTaskInput,
          { color: colors.text.primary },
        ]}
        placeholder=""
        placeholderTextColor={colors.text.secondary}
        value={content}
        onChangeText={setContent}
        onSubmitEditing={handleSubmit}
        editable={!isSubmitting}
        returnKeyType="done"
      />

      {/* キャンセルボタン（挿入モードの場合のみ） */}
      {onCancel && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text.secondary }]}>×</Text>
        </TouchableOpacity>
      )}

      {/* インデント表示 */}
      {localIndent > 0 && (
        <View style={styles.indentIndicator}>
          <Text style={[styles.indentText, { color: colors.text.secondary }]}>
            {'→'.repeat(localIndent)}
          </Text>
        </View>
      )}
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
    fontSize: 14,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  newTaskIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  newTaskIconText: {
    fontSize: 12,
    fontWeight: '600',
  },
  newTaskInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  indentIndicator: {
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  indentText: {
    fontSize: 10,
  },
  insertButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginVertical: spacing.xs / 2,
  },
  insertButtonText: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.5,
  },
  cancelButton: {
    padding: spacing.xs,
  },
  cancelButtonText: {
    fontSize: 24,
    fontWeight: '400',
  },
});
