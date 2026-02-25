import React, { useState, useCallback } from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { spacing } from '../theme';
import AttendanceCard from '../features/attendance/components/AttendanceCard';
import TodoList from '../features/todo/components/TodoList';
import WeeklyTasksSection from '../features/todo/components/WeeklyTasksSection';

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleStreakUpdate = useCallback((streaks: { attendanceStreak: number; todoStreak: number }) => {
    // ストリーク更新時の処理（ヘッダーバッジ等に反映可能）
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // refreshKeyを変更して全コンポーネントをリロード
    setRefreshKey(prev => prev + 1);
    // 少し待ってからリフレッシュ状態を解除
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  if (!user) return null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={isDark ? '#FFFFFF' : '#111827'}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <AttendanceCard
        key={`attendance-${refreshKey}`}
        user={user}
        isDark={isDark}
        onStreakUpdate={handleStreakUpdate}
      />

      <TodoList
        key={`todo-${refreshKey}`}
        user={user}
        isDark={isDark}
        onStreakUpdate={handleStreakUpdate}
      />

      <WeeklyTasksSection
        key={`weekly-${refreshKey}`}
        user={user}
        isDark={isDark}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
});
