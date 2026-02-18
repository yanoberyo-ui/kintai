import React, { useState, useEffect } from 'react';
import { View, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Button, Card } from '../components/native';
import RoutineTodoList from '../components/RoutineTodoList.native';
import TodoList from '../components/TodoList.native';
import { supabase } from '../services/supabase.native';
import { useAuth } from '../hooks/useAuth';
import { useLocation } from '../hooks/useLocation';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { addToOfflineQueue } from '../services/offlineStorage';
import { useTheme } from '../contexts/ThemeContext';
import { spacing } from '../theme';

type AttendanceStatus = 'not_clocked_in' | 'clocked_in' | 'clocked_out';

interface TodayRecord {
  id: string;
  clock_in: string;
  clock_out: string | null;
  date: string;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { getCurrentLocation } = useLocation();
  const { isConnected } = useNetworkStatus();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<AttendanceStatus>('not_clocked_in');
  const [todayRecord, setTodayRecord] = useState<TodayRecord | null>(null);
  const [elapsedTime, setElapsedTime] = useState('0:00');
  const [routineCompleted, setRoutineCompleted] = useState(0);
  const [routineTotal, setRoutineTotal] = useState(0);
  const [todoCompleted, setTodoCompleted] = useState(0);
  const [todoTotal, setTodoTotal] = useState(0);

  // 進捗を計算
  const totalTasks = routineTotal + todoTotal;
  const completedTasks = routineCompleted + todoCompleted;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const fetchTodayRecord = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTodayRecord(data);
        setCurrentStatus(data.clock_out ? 'clocked_out' : 'clocked_in');
      } else {
        setTodayRecord(null);
        setCurrentStatus('not_clocked_in');
      }
    } catch (error: any) {
      console.error('Error fetching today record:', error);
      Alert.alert('エラー', '勤怠記録の取得に失敗しました');
    }
  };

  useEffect(() => {
    fetchTodayRecord();
  }, [user]);

  // 勤務時間の経過を1秒ごとに更新
  useEffect(() => {
    if (currentStatus !== 'clocked_in' || !todayRecord) {
      setElapsedTime('0:00');
      return;
    }

    const updateElapsedTime = () => {
      const clockIn = new Date(todayRecord.clock_in);
      const now = new Date();
      const diff = now.getTime() - clockIn.getTime();

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setElapsedTime(`${hours}:${String(minutes).padStart(2, '0')}`);
    };

    updateElapsedTime();
    const interval = setInterval(updateElapsedTime, 1000);

    return () => clearInterval(interval);
  }, [currentStatus, todayRecord]);

  const handleClockIn = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      // 位置情報を取得
      const location = await getCurrentLocation();

      const record = {
        user_id: user.id,
        date: today,
        clock_in: now,
        clock_in_location: location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        } : null,
      };

      if (!isConnected) {
        // オフラインの場合はキューに追加
        await addToOfflineQueue({
          type: 'clock_in',
          data: record,
          timestamp: now,
        });
        Alert.alert('オフライン', 'データは後で同期されます');
        setLoading(false);
        return;
      }

      // オンラインの場合は即座に送信
      const { error } = await supabase
        .from('attendances')
        .insert(record);

      if (error) throw error;

      Alert.alert('成功', '出勤打刻しました');
      await fetchTodayRecord();
    } catch (error: any) {
      console.error('Clock in error:', error);
      Alert.alert('エラー', '出勤打刻に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!user || !todayRecord) return;

    setLoading(true);
    try {
      const now = new Date().toISOString();

      // 位置情報を取得
      const location = await getCurrentLocation();

      const updateData = {
        clock_out: now,
        clock_out_location: location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        } : null,
      };

      if (!isConnected) {
        // オフラインの場合はキューに追加
        await addToOfflineQueue({
          type: 'clock_out',
          data: { id: todayRecord.id, ...updateData },
          timestamp: now,
        });
        Alert.alert('オフライン', 'データは後で同期されます');
        setLoading(false);
        return;
      }

      // オンラインの場合は即座に送信
      const { error } = await supabase
        .from('attendances')
        .update(updateData)
        .eq('id', todayRecord.id);

      if (error) throw error;

      Alert.alert('成功', '退勤打刻しました');
      await fetchTodayRecord();
    } catch (error: any) {
      console.error('Clock out error:', error);
      Alert.alert('エラー', '退勤打刻に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTodayRecord();
    setRefreshing(false);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      <Card>
        <Text style={[styles.greeting, { color: colors.text.primary }]}>こんにちは</Text>
        <Text style={[styles.email, { color: colors.text.secondary }]}>{user?.email}</Text>
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: colors.text.primary }]}>本日の勤怠</Text>

        {currentStatus === 'not_clocked_in' && (
          <>
            <Text style={[styles.statusText, { color: colors.text.secondary }]}>未出勤</Text>
            <Button title="出勤" onPress={handleClockIn} loading={loading} />
          </>
        )}

        {currentStatus === 'clocked_in' && todayRecord && (
          <>
            <View style={styles.centerContainer}>
              <Text style={[styles.statusBadge, { color: colors.background, backgroundColor: colors.text.primary }]}>勤務中</Text>
            </View>

            <Text style={[styles.timeRangeText, { color: colors.text.secondary }]}>
              {formatTime(todayRecord.clock_in)} - 退在
            </Text>

            <Text style={[styles.elapsedTime, { color: colors.text.primary }]}>{elapsedTime}</Text>
            <Text style={[styles.elapsedLabel, { color: colors.text.secondary }]}>勤務時間</Text>

            <Button title="退勤する" onPress={handleClockOut} loading={loading} />
          </>
        )}

        {currentStatus === 'clocked_out' && todayRecord && (
          <>
            <Text style={[styles.statusText, styles.statusCompleted, { color: colors.success }]}>勤務終了</Text>
            <Text style={[styles.timeText, { color: colors.text.primary }]}>
              出勤時刻: {formatTime(todayRecord.clock_in)}
            </Text>
            <Text style={[styles.timeText, { color: colors.text.primary }]}>
              退勤時刻: {todayRecord.clock_out ? formatTime(todayRecord.clock_out) : '-'}
            </Text>
          </>
        )}
      </Card>

      <Card>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressTitle, { color: colors.text.primary }]}>
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}のToDo
          </Text>
          <Text style={[styles.progressBadge, { color: colors.text.primary }]}>
            {progress}%
          </Text>
        </View>

        <View style={styles.progressInfo}>
          <Text style={[styles.progressLabel, { color: colors.text.secondary }]}>進捗</Text>
          <Text style={[styles.progressCount, { color: colors.text.secondary }]}>
            {completedTasks} / {totalTasks} タスク完了
          </Text>
        </View>
        <View style={[styles.progressBarContainer, { backgroundColor: colors.text.secondary + '20' }]}>
          <View
            style={[
              styles.progressBarFill,
              { backgroundColor: colors.text.primary, width: `${progress}%` },
            ]}
          />
        </View>
      </Card>

      <RoutineTodoList onProgressChange={(completed, total) => {
        setRoutineCompleted(completed);
        setRoutineTotal(total);
      }} />

      <TodoList onProgressChange={(completed, total) => {
        setTodoCompleted(completed);
        setTodoTotal(total);
      }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  statusText: {
    fontSize: 16,
    marginBottom: spacing.md,
  },
  statusWorking: {
    fontWeight: '600',
  },
  statusCompleted: {
    fontWeight: '600',
  },
  timeText: {
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  navButton: {
    marginBottom: spacing.md,
  },
  centerContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusBadge: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  timeRangeText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  elapsedTime: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  elapsedLabel: {
    fontSize: 14,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  progressBadge: {
    fontSize: 18,
    fontWeight: '700',
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressCount: {
    fontSize: 12,
  },
  progressBarContainer: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
});
