import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Card } from '../../../components';
import { useTheme } from '../../../contexts/ThemeContext';
import { spacing, borderRadius } from '../../../theme';
import { supabase } from '../../../services/supabase';

interface WeeklyTask {
  id: string;
  user_id: string;
  title: string;
  deadline: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

interface WeeklyTasksSectionProps {
  user: any;
  isDark: boolean;
}

export default function WeeklyTasksSection({ user, isDark }: WeeklyTasksSectionProps) {
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTasks = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('weekly_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('deadline', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error loading weekly tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [user?.id]);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !user?.id) return;

    setSaving(true);
    try {
      // デフォルトの期限は翌日の同じ時刻
      const deadline = newTaskDeadline || getDefaultDeadline();

      const { error } = await supabase
        .from('weekly_tasks')
        .insert({
          user_id: user.id,
          title: newTaskTitle.trim(),
          deadline: deadline,
          completed: false
        });

      if (error) throw error;

      setNewTaskTitle('');
      setNewTaskDeadline('');
      setShowAddForm(false);
      await loadTasks();
    } catch (error) {
      console.error('Error adding weekly task:', error);
      Alert.alert('エラー', 'タスクの追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async (taskId: string, currentCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('weekly_tasks')
        .update({ completed: !currentCompleted, updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;
      await loadTasks();
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    Alert.alert(
      '削除確認',
      'このタスクを削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('weekly_tasks')
                .delete()
                .eq('id', taskId);

              if (error) throw error;
              await loadTasks();
            } catch (error) {
              console.error('Error deleting task:', error);
            }
          },
        },
      ]
    );
  };

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const isOverdue = date < now;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return {
      text: `${month}/${day} ${hours}:${minutes}`,
      isOverdue
    };
  };

  const getDefaultDeadline = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setSeconds(0, 0);
    return tomorrow.toISOString();
  };

  const uncompletedCount = tasks.filter(t => !t.completed).length;

  if (loading) {
    return (
      <Card>
        <View style={styles.loadingContainer}>
          <View style={[styles.loadingBar, { backgroundColor: isDark ? '#1F2937' : '#E5E7EB' }]} />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      {/* ヘッダー */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEmoji}>📅</Text>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            今週のタスク
          </Text>
          <View style={[styles.countBadge, { backgroundColor: isDark ? '#1F2937' : '#E5E7EB' }]}>
            <Text style={[styles.countBadgeText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {uncompletedCount}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}
          onPress={() => {
            setShowAddForm(!showAddForm);
            if (!newTaskDeadline) {
              setNewTaskDeadline('');
            }
          }}
        >
          <Text style={[styles.addButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* 追加フォーム */}
      {showAddForm && (
        <View style={[styles.addForm, { backgroundColor: isDark ? 'rgba(31,41,55,0.5)' : 'rgba(243,244,246,0.5)' }]}>
          <TextInput
            style={[styles.addFormInput, {
              backgroundColor: isDark ? '#111827' : '#FFFFFF',
              borderColor: isDark ? '#374151' : '#D1D5DB',
              color: isDark ? '#FFFFFF' : '#111827',
            }]}
            value={newTaskTitle}
            onChangeText={setNewTaskTitle}
            placeholder="タスク名を入力..."
            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            autoFocus
          />
          <View style={styles.addFormButtons}>
            <TouchableOpacity
              style={[styles.formButton, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}
              onPress={() => {
                setShowAddForm(false);
                setNewTaskTitle('');
                setNewTaskDeadline('');
              }}
            >
              <Text style={[styles.formButtonText, { color: isDark ? '#D1D5DB' : '#374151' }]}>
                キャンセル
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formButton, {
                backgroundColor: isDark ? '#FFFFFF' : '#111827',
                opacity: saving || !newTaskTitle.trim() ? 0.5 : 1,
              }]}
              onPress={handleAddTask}
              disabled={saving || !newTaskTitle.trim()}
            >
              <Text style={[styles.formButtonText, { color: isDark ? '#111827' : '#FFFFFF', fontWeight: '700' }]}>
                {saving ? '追加中...' : '追加'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* タスクリスト */}
      <View style={styles.taskList}>
        {tasks.length === 0 ? (
          <Text style={[styles.emptyText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
            今週のタスクはありません
          </Text>
        ) : (
          tasks.map(task => {
            const deadline = formatDeadline(task.deadline);
            return (
              <TouchableOpacity
                key={task.id}
                style={[
                  styles.taskItem,
                  task.completed && styles.taskItemCompleted,
                ]}
                onLongPress={() => handleDeleteTask(task.id)}
                activeOpacity={0.7}
              >
                {/* チェックボックス */}
                <TouchableOpacity
                  style={[styles.checkbox, {
                    backgroundColor: task.completed ? '#10B981' : 'transparent',
                    borderColor: task.completed ? '#10B981' : (isDark ? '#4B5563' : '#D1D5DB'),
                  }]}
                  onPress={() => handleToggleComplete(task.id, task.completed)}
                >
                  {task.completed && (
                    <Text style={styles.checkboxCheck}>✓</Text>
                  )}
                </TouchableOpacity>

                {/* タスク名 */}
                <Text style={[
                  styles.taskTitle,
                  { color: isDark ? '#FFFFFF' : '#111827' },
                  task.completed && styles.taskTitleCompleted,
                ]}>
                  {task.title}
                </Text>

                {/* 期限バッジ */}
                <View style={[styles.deadlineBadge, {
                  backgroundColor: deadline.isOverdue && !task.completed
                    ? (isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)')
                    : (isDark ? '#1F2937' : '#E5E7EB'),
                }]}>
                  <Text style={[styles.deadlineText, {
                    color: deadline.isOverdue && !task.completed
                      ? (isDark ? '#F87171' : '#DC2626')
                      : (isDark ? '#9CA3AF' : '#6B7280'),
                  }]}>
                    {deadline.text}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: spacing.md,
  },
  loadingBar: {
    height: 24,
    width: 120,
    borderRadius: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  countBadgeText: {
    fontSize: 12,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 20,
    fontWeight: '400',
  },
  // 追加フォーム
  addForm: {
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  addFormInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  addFormButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  formButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  formButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // タスクリスト
  taskList: {},
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    marginBottom: 4,
  },
  taskItemCompleted: {
    opacity: 0.5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  taskTitle: {
    flex: 1,
    fontSize: 15,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  deadlineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: spacing.sm,
  },
  deadlineText: {
    fontSize: 12,
  },
});
