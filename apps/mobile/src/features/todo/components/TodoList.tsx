import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { Card } from '../../../components';
import { useTheme } from '../../../contexts/ThemeContext';
import { spacing, borderRadius } from '../../../theme';
import { supabase } from '../../../services/supabase';
import {
  getTodayTodoList,
  createTodayTodoList,
  addTodoItem,
  addTodoItemAtPosition,
  toggleTodoItem,
  updateTodoItem,
  deleteTodoItem,
  calculateProgress,
  reorderTodoItems,
  carryOverUncompletedTodos,
} from '../utils/todo';
import {
  getRoutineTodos,
  getTodayCompletions,
  addRoutineTodo,
  toggleRoutineTodoCompletion,
  calculateRoutineProgress,
} from '../utils/routineTodo';
import { checkTodoStreakRisk } from '../../pomodoro/utils/streaks';
import { getDailyTodos, getRootsUserByEmail } from '../../../utils/rootsApi';
import { getTodayDate } from '../../../utils/date';

interface TodoItem {
  id: string;
  content: string;
  is_completed: boolean;
  order_index: number;
  indent_level: number;
}

interface RoutineTodoItem {
  id: string;
  content: string;
  order_index: number;
}

interface Completion {
  id: string;
  routine_todo_id: string;
  completed_date: string;
}

interface TodoListProps {
  user: any;
  isDark: boolean;
  onStreakUpdate?: (streaks: any) => void;
}

export default function TodoList({ user, isDark, onStreakUpdate }: TodoListProps) {
  const { colors } = useTheme();
  const [todoList, setTodoList] = useState<any>(null);
  const [routineTodos, setRoutineTodos] = useState<RoutineTodoItem[]>([]);
  const [routineCompletions, setRoutineCompletions] = useState<Completion[]>([]);
  const [newTodoContent, setNewTodoContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentIndentLevel, setCurrentIndentLevel] = useState(0);
  const [insertingAtIndex, setInsertingAtIndex] = useState<number | null>(null);
  const [streakRisk, setStreakRisk] = useState<any>(null);
  const [rootsTodos, setRootsTodos] = useState<any[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  const loadAllData = async () => {
    await Promise.all([
      loadTodoList(),
      loadRoutineData(),
      loadStreakRisk(),
      loadRootsTodos(),
    ]);
  };

  const loadTodoList = async () => {
    if (!user) return;

    try {
      let list = await getTodayTodoList(user.id);

      if (!list) {
        list = await createTodayTodoList(user.id);
        const carriedCount = await carryOverUncompletedTodos(user.id, list.id);
        if (carriedCount > 0) {
          list = await getTodayTodoList(user.id);
        }
      }

      setTodoList(list);

      // 100%完了チェック
      if (list?.todo_items && list.todo_items.length > 0) {
        const progress = calculateProgress(list.todo_items);
        if (progress === 100) {
          triggerConfetti();
        }
      }
    } catch (error) {
      console.error('Error loading todo list:', error);
    }
  };

  const loadRoutineData = async () => {
    if (!user) return;

    try {
      const [todosData, completionsData] = await Promise.all([
        getRoutineTodos(user.id),
        getTodayCompletions(user.id),
      ]);

      setRoutineTodos(todosData);
      setRoutineCompletions(completionsData);
    } catch (error) {
      console.error('Error loading routine todos:', error);
    }
  };

  const loadStreakRisk = async () => {
    if (!user) return;

    try {
      const risk = await checkTodoStreakRisk(user.id);
      setStreakRisk(risk);
    } catch (error) {
      console.error('Error checking streak risk:', error);
    }
  };

  const loadRootsTodos = async () => {
    if (!user?.email) return;

    try {
      const rootsUser = await getRootsUserByEmail(user.email);
      if (rootsUser) {
        const todos = await getDailyTodos(rootsUser.id);
        setRootsTodos(todos);
      }
    } catch (error) {
      // Roots API接続失敗は静かに無視
      console.log('Roots API not available:', error);
    }
  };

  const triggerConfetti = () => {
    setShowConfetti(true);
    confettiAnim.setValue(0);
    Animated.timing(confettiAnim, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: true,
    }).start(() => setShowConfetti(false));
  };

  const handleAddTodo = async (content: string, indentLevel: number = 0, afterIndex: number | null = null) => {
    if (!todoList || !content.trim()) return;

    try {
      if (afterIndex !== null) {
        await addTodoItemAtPosition(todoList.id, content.trim(), indentLevel, afterIndex);
      } else {
        await addTodoItem(todoList.id, content.trim(), indentLevel);
      }

      setInsertingAtIndex(null);
      await loadTodoList();
    } catch (error) {
      console.error('Error adding todo:', error);
      Alert.alert('エラー', 'TODOの追加に失敗しました');
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
      await updateTodoItem(itemId, { content });
      await loadTodoList();
    } catch (error) {
      console.error('Error updating todo:', error);
      Alert.alert('エラー', 'TODOの更新に失敗しました');
    }
  };

  const handleDeleteTodo = async (itemId: string) => {
    try {
      await deleteTodoItem(itemId);
      await loadTodoList();
    } catch (error) {
      console.error('Error deleting todo:', error);
      Alert.alert('エラー', 'TODOの削除に失敗しました');
    }
  };

  const handleToggleRoutine = async (todoId: string) => {
    if (!user) return;

    const isCompleted = routineCompletions.some(c => c.routine_todo_id === todoId);

    try {
      await toggleRoutineTodoCompletion(user.id, todoId, isCompleted);
      await loadRoutineData();
    } catch (error) {
      console.error('Error toggling routine todo:', error);
      Alert.alert('エラー', 'ルーチンTODOの更新に失敗しました');
    }
  };

  const handleAddRoutine = async (content: string) => {
    if (!user || !content.trim()) return;

    try {
      await addRoutineTodo(user.id, content.trim());
      await loadRoutineData();
    } catch (error) {
      console.error('Error adding routine todo:', error);
      Alert.alert('エラー', 'ルーチンTODOの追加に失敗しました');
    }
  };

  const handleUpdateRoutine = async (todoId: string, content: string) => {
    if (!user) return;

    try {
      await supabase
        .from('routine_todos')
        .update({ content })
        .eq('id', todoId)
        .eq('user_id', user.id);
      await loadRoutineData();
    } catch (error) {
      console.error('Error updating routine todo:', error);
    }
  };

  // プログレス計算
  const items = todoList?.todo_items || [];
  const progress = calculateProgress(items);
  const routineProgress = calculateRoutineProgress(routineTodos, routineCompletions);
  const totalItems = items.length + routineTodos.length;
  const totalCompleted = items.filter((i: any) => i.is_completed).length + routineCompletions.length;
  const totalProgress = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0;

  const isRoutineCompleted = (todoId: string) => {
    return routineCompletions.some(c => c.routine_todo_id === todoId);
  };

  return (
    <Card>
      {/* ストリーク警告バナー */}
      {streakRisk?.isAtRisk && (
        <View style={[styles.streakWarning, { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)' }]}>
          <Text style={[styles.streakWarningText, { color: isDark ? '#FBBF24' : '#D97706' }]}>
            {streakRisk.message}
          </Text>
        </View>
      )}

      {/* ヘッダー + プログレスバー */}
      <Text style={[styles.title, { color: colors.text.primary }]}>本日のToDo</Text>

      {totalItems > 0 && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}>
            <View style={[styles.progressFill, {
              width: `${totalProgress}%`,
              backgroundColor: totalProgress === 100 ? '#10B981' : (isDark ? '#FFFFFF' : '#111827'),
            }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.text.secondary }]}>
            {totalCompleted}/{totalItems} ({totalProgress}%)
          </Text>
        </View>
      )}

      {/* ルーティンTODOセクション */}
      {routineTodos.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            定常ToDo
          </Text>
          {routineTodos.map(todo => (
            <RoutineTodoItemRow
              key={todo.id}
              todo={todo}
              colors={colors}
              isCompleted={isRoutineCompleted(todo.id)}
              onToggle={handleToggleRoutine}
              onUpdate={handleUpdateRoutine}
            />
          ))}
        </View>
      )}

      {/* 今日のTODOセクション */}
      <View style={styles.section}>
        {routineTodos.length > 0 && (
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            今日のToDo
          </Text>
        )}
        <View style={styles.todoItemsContainer}>
          {items.length > 0 ? (
            items.map((item: TodoItem, index: number) => (
              <React.Fragment key={item.id}>
                <TodoItemRow
                  item={item}
                  colors={colors}
                  onToggle={handleToggleTodo}
                  onUpdate={handleUpdateTodo}
                  onDelete={handleDeleteTodo}
                />

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

          {insertingAtIndex === null && (
            <NewTaskInput
              colors={colors}
              onAdd={handleAddTodo}
              indentLevel={currentIndentLevel}
              onIndentChange={setCurrentIndentLevel}
            />
          )}
        </View>
      </View>

      {/* Roots連携TODO（読み取り専用） */}
      {rootsTodos.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            開発TODO（Roots）
          </Text>
          {rootsTodos.map((todo: any) => (
            <View key={todo.id} style={styles.rootsTodoItem}>
              <View style={[styles.rootsCheckbox, {
                backgroundColor: todo.isCompleted ? colors.text.secondary : 'transparent',
                borderColor: colors.text.secondary,
              }]}>
                {todo.isCompleted && (
                  <Text style={{ color: colors.background, fontSize: 10 }}>✓</Text>
                )}
              </View>
              <Text style={[
                styles.rootsTodoText,
                { color: colors.text.primary },
                todo.isCompleted && styles.todoContentCompleted,
              ]}>
                {todo.title}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* 定常TODO追加 */}
      <View style={styles.section}>
        <NewRoutineTaskInput colors={colors} onAdd={handleAddRoutine} />
      </View>
    </Card>
  );
}

// 既存のTODOアイテム表示コンポーネント
function TodoItemRow({ item, colors, onToggle, onUpdate, onDelete }: any) {
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

  const handleLongPress = () => {
    Alert.alert(
      'タスク操作',
      item.content,
      [
        { text: '削除', style: 'destructive', onPress: () => onDelete(item.id) },
        { text: 'キャンセル', style: 'cancel' },
      ]
    );
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
          style={[styles.todoContent, { color: colors.text.primary }]}
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
          onLongPress={handleLongPress}
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

// ルーティンTODOアイテム
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
          style={[styles.todoContent, { color: colors.text.primary }]}
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

// 新規タスク入力
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
      setTimeout(() => inputRef.current?.focus(), 100);
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
      <View style={[styles.newTaskIcon, { backgroundColor: colors.text.primary }]}>
        <Text style={[styles.newTaskIconText, { color: colors.background }]}>▶</Text>
      </View>

      <TextInput
        ref={inputRef}
        style={[styles.newTaskInput, { color: colors.text.primary }]}
        placeholder=""
        placeholderTextColor={colors.text.secondary}
        value={content}
        onChangeText={setContent}
        onSubmitEditing={handleSubmit}
        editable={!isSubmitting}
        returnKeyType="done"
      />

      {onCancel && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={[styles.cancelBtnText, { color: colors.text.secondary }]}>×</Text>
        </TouchableOpacity>
      )}

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

// 定常TODO用の新規タスク入力
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
    <View style={styles.newRoutineContainer}>
      <TextInput
        ref={inputRef}
        style={[styles.newRoutineInput, { color: colors.text.primary }]}
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
  // ストリーク警告
  streakWarning: {
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  streakWarningText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  // プログレス
  progressContainer: {
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'right',
  },
  // セクション
  section: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
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
  // 新規タスク入力
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
  cancelBtn: {
    padding: spacing.xs,
  },
  cancelBtnText: {
    fontSize: 24,
    fontWeight: '400',
  },
  // ルーティンTODO新規入力
  newRoutineContainer: {
    paddingVertical: spacing.xs,
  },
  newRoutineInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  // Roots連携TODO
  rootsTodoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rootsCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  rootsTodoText: {
    flex: 1,
    fontSize: 14,
  },
});
