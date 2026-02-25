import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { Modal } from '../../../components';
import { useTheme } from '../../../contexts/ThemeContext';
import { spacing, borderRadius } from '../../../theme';
import { supabase } from '../../../services/supabase';
import {
  getTodayAttendance,
  clockIn,
  clockOut,
  reClockIn,
  startBreak,
  endBreak,
  getAttendanceStatus,
} from '../utils/attendance';
import { sendSlackNotification } from '../../../utils/slack';
import { getTodayDate } from '../../../utils/date';
import { getStreaks } from '../../pomodoro/utils/streaks';
import { getTodayTodoList } from '../../todo/utils/todo';

interface AttendanceCardProps {
  user: any;
  isDark: boolean;
  onStreakUpdate?: (streaks: { attendanceStreak: number; todoStreak: number }) => void;
  onRefresh?: () => void;
}

export default function AttendanceCard({ user, isDark, onStreakUpdate, onRefresh }: AttendanceCardProps) {
  const { colors } = useTheme();
  const [attendance, setAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userProfile, setUserProfile] = useState<any>(null);

  // モーダル状態
  const [showWorkTypeModal, setShowWorkTypeModal] = useState(false);
  const [showReClockInWorkTypeModal, setShowReClockInWorkTypeModal] = useState(false);
  const [showBreakMinutesModal, setShowBreakMinutesModal] = useState(false);
  const [additionalBreakMinutes, setAdditionalBreakMinutes] = useState('');
  const [showBirthdayPopup, setShowBirthdayPopup] = useState(false);
  const [birthdayData, setBirthdayData] = useState<{ isCurrentUser: boolean; members: any[] }>({ isCurrentUser: false, members: [] });
  const [showStreakNotification, setShowStreakNotification] = useState(false);
  const [streakNotificationType, setStreakNotificationType] = useState<string | null>(null);
  const [streakValue, setStreakValue] = useState(0);
  const [showOvertimeAlert, setShowOvertimeAlert] = useState(false);
  const [overtimeAlertShown, setOvertimeAlertShown] = useState(false);
  const [showAIFeedbackPopup, setShowAIFeedbackPopup] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<any>(null);

  // アニメーション
  const streakAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    loadAttendance();
    loadUserProfile();

    const updateJSTTime = () => {
      const jstTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
      setCurrentTime(jstTime);
    };

    updateJSTTime();
    const timer = setInterval(updateJSTTime, 1000);
    return () => clearInterval(timer);
  }, [user]);

  // 15時間超過チェック
  useEffect(() => {
    if (!attendance?.clock_in || attendance?.clock_out || overtimeAlertShown) return;

    const checkOvertime = () => {
      const jstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
      const clockInTime = new Date(attendance.clock_in);
      const diffMinutes = Math.floor((jstNow.getTime() - clockInTime.getTime()) / 1000 / 60);
      const diffHours = diffMinutes / 60;

      if (diffHours >= 15) {
        setShowOvertimeAlert(true);
        setOvertimeAlertShown(true);
      }
    };

    const overtimeTimer = setInterval(checkOvertime, 60000);
    checkOvertime();
    return () => clearInterval(overtimeTimer);
  }, [attendance, overtimeAlertShown]);

  const loadAttendance = async () => {
    try {
      const data = await getTodayAttendance(user.id);
      setAttendance(data);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const handleClockIn = () => {
    setShowWorkTypeModal(true);
  };

  const confirmClockIn = async (workType: string) => {
    try {
      setLoading(true);
      setShowWorkTypeModal(false);

      const result = await clockIn(user.id, workType);
      await loadAttendance();

      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();

      // Slack通知
      sendSlackNotification(
        'clock_in',
        { id: user.id, name: userData?.name || user.email },
        result
      ).catch(err => console.error('Slack通知エラー:', err));

      // 誕生日チェック
      await checkBirthdays();

      // ストリーク通知
      const streaks = await getStreaks(user.id);
      if (streaks.attendanceStreak > 0) {
        setStreakValue(streaks.attendanceStreak);
        setStreakNotificationType('clockin');
        showStreakAnimation();
      }

      if (onStreakUpdate) {
        onStreakUpdate(streaks);
      }
    } catch (error: any) {
      console.error('Error clocking in:', error);
      Alert.alert('エラー', `出勤記録の保存に失敗しました: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const checkBirthdays = async () => {
    try {
      const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));

      const { data: members, error } = await supabase
        .from('users')
        .select('*');

      if (error) throw error;

      const todayBirthdays: any[] = [];
      let isCurrentUserBirthday = false;

      (members || []).forEach((member: any) => {
        if (!member.birthday) return;

        const birthday = new Date(member.birthday);
        const birthdayThisYear = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());

        if (birthdayThisYear.toDateString() === today.toDateString()) {
          if (member.id === user.id) {
            isCurrentUserBirthday = true;
          } else {
            todayBirthdays.push(member);
          }
        }
      });

      if (isCurrentUserBirthday || todayBirthdays.length > 0) {
        setBirthdayData({ isCurrentUser: isCurrentUserBirthday, members: todayBirthdays });
        setShowBirthdayPopup(true);
      }
    } catch (error) {
      console.error('Error checking birthdays:', error);
    }
  };

  const handleClockOut = () => {
    setShowAIFeedbackPopup(false);
    setAdditionalBreakMinutes('');
    setShowBreakMinutesModal(true);
  };

  const handleClockOutConfirm = async () => {
    setShowBreakMinutesModal(false);

    try {
      setLoading(true);
      const breakMinutesValue = parseInt(additionalBreakMinutes) || 0;
      const result = await clockOut(user.id, breakMinutesValue);
      await loadAttendance();

      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();

      // Slack通知
      sendSlackNotification(
        'clock_out',
        { id: user.id, name: userData?.name || user.email },
        result
      ).catch(err => console.error('Slack通知エラー:', err));

      // ストリーク通知（TODO連続）
      const streaks = await getStreaks(user.id);
      if (streaks.todoStreak > 0) {
        setStreakValue(streaks.todoStreak);
        setStreakNotificationType('clockout');
        showStreakAnimation();
      }

      if (onStreakUpdate) {
        onStreakUpdate(streaks);
      }
    } catch (error: any) {
      console.error('Error clocking out:', error);
      Alert.alert('エラー', `退勤に失敗しました: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReClockIn = () => {
    setShowReClockInWorkTypeModal(true);
  };

  const confirmReClockIn = async (workType: string) => {
    try {
      setLoading(true);
      setShowReClockInWorkTypeModal(false);
      const result = await reClockIn(user.id, workType);
      await loadAttendance();

      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();

      sendSlackNotification(
        'clock_in',
        { id: user.id, name: userData?.name || user.email },
        result
      ).catch(err => console.error('Slack通知エラー:', err));
    } catch (error: any) {
      console.error('Error re-clocking in:', error);
      Alert.alert('エラー', `再出勤に失敗しました: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartBreak = async () => {
    try {
      setLoading(true);
      await startBreak(user.id);
      await loadAttendance();
    } catch (error: any) {
      console.error('Error starting break:', error);
      Alert.alert('エラー', error.message || '中抜け開始に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleEndBreak = async () => {
    try {
      setLoading(true);

      // リモート出勤の場合は出社に変更するか確認
      if (attendance?.work_type === 'remote') {
        Alert.alert(
          '勤務タイプ変更',
          'リモートから戻りますか？',
          [
            {
              text: 'リモートのまま',
              onPress: async () => {
                await endBreak(user.id);
                await loadAttendance();
                setLoading(false);
              },
            },
            {
              text: '出社に変更',
              onPress: async () => {
                await endBreak(user.id);
                const today = getTodayDate();
                await supabase
                  .from('attendances')
                  .update({ work_type: 'office' })
                  .eq('user_id', user.id)
                  .eq('date', today);
                await loadAttendance();
                setLoading(false);
              },
            },
          ]
        );
      } else {
        await endBreak(user.id);
        await loadAttendance();
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error ending break:', error);
      Alert.alert('エラー', error.message || '戻りに失敗しました');
      setLoading(false);
    }
  };

  const showStreakAnimation = () => {
    setShowStreakNotification(true);
    streakAnim.setValue(0);
    Animated.sequence([
      Animated.timing(streakAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(streakAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => setShowStreakNotification(false));
  };

  const getStatus = () => {
    if (!attendance || !attendance.clock_in) return 'not_started';
    if (attendance.clock_out) return 'completed';
    return 'working';
  };

  const isOnBreak = () => {
    if (!attendance?.break_sessions || attendance.break_sessions.length === 0) return false;
    const lastSession = attendance.break_sessions[attendance.break_sessions.length - 1];
    return lastSession && !lastSession.end;
  };

  const getWorkSessions = () => {
    if (!attendance?.clock_in) return [];

    const sessions: { start: string; end: string | null }[] = [];
    const clockInTimeStr = formatTime(attendance.clock_in);

    if (!attendance.break_sessions || attendance.break_sessions.length === 0) {
      sessions.push({
        start: clockInTimeStr,
        end: attendance.clock_out ? formatTime(attendance.clock_out) : null
      });
    } else {
      let currentStart = clockInTimeStr;

      for (const breakSession of attendance.break_sessions) {
        const breakStart = formatTime(breakSession.start);
        sessions.push({ start: currentStart, end: breakStart });

        if (breakSession.end) {
          currentStart = formatTime(breakSession.end);
        } else {
          currentStart = '';
        }
      }

      if (currentStart) {
        sessions.push({
          start: currentStart,
          end: attendance.clock_out ? formatTime(attendance.clock_out) : null
        });
      }
    }

    return sessions;
  };

  const getWorkDuration = () => {
    if (!attendance?.clock_in) return '0:00';

    if (attendance.clock_out) {
      const totalMinutes = attendance.total_work_minutes || 0;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    }

    const jstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    let totalMinutes = attendance.total_work_minutes || 0;

    if (isOnBreak()) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    }

    let lastWorkStart: Date;

    if (attendance.break_sessions && attendance.break_sessions.length > 0) {
      const lastSession = attendance.break_sessions[attendance.break_sessions.length - 1];
      if (lastSession.end) {
        lastWorkStart = new Date(lastSession.end);
      } else {
        lastWorkStart = new Date(attendance.clock_in);
      }
    } else if (attendance.last_clock_out) {
      lastWorkStart = new Date(attendance.last_clock_out);
    } else {
      lastWorkStart = new Date(attendance.clock_in);
    }

    const currentSessionMinutes = Math.max(0, Math.floor((jstNow.getTime() - lastWorkStart!.getTime()) / 1000 / 60));
    totalMinutes += currentSessionMinutes;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '--:--';

    const utcDate = new Date(dateString);
    const jstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));

    const hours = jstDate.getUTCHours();
    const minutes = jstDate.getUTCMinutes();

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const status = getStatus();

  const getStatusBadgeStyle = () => {
    if (status === 'working' && !isOnBreak()) {
      return {
        backgroundColor: isDark ? '#FFFFFF' : '#111827',
        textColor: isDark ? '#111827' : '#FFFFFF',
      };
    }
    return {
      backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
      textColor: isDark ? '#9CA3AF' : '#6B7280',
    };
  };

  const getStatusText = () => {
    if (status === 'not_started') return '未出勤';
    if (status === 'working') return isOnBreak() ? '中抜け中' : '出勤中';
    return '退勤済み';
  };

  const badgeStyle = getStatusBadgeStyle();

  return (
    <View style={[styles.card, {
      backgroundColor: isDark ? 'rgba(17,24,39,0.8)' : 'rgba(255,255,255,0.8)',
      borderColor: isDark ? 'rgba(55,65,81,0.5)' : 'rgba(229,231,235,0.5)',
    }]}>
      {/* ストリーク通知 */}
      {showStreakNotification && (
        <Animated.View
          style={[
            styles.streakNotification,
            {
              backgroundColor: isDark ? 'rgba(17,24,39,0.95)' : 'rgba(255,255,255,0.95)',
              borderColor: isDark ? 'rgba(55,65,81,0.5)' : 'rgba(229,231,235,0.5)',
              opacity: streakAnim,
              transform: [{
                translateY: streakAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, 0],
                }),
              }],
            },
          ]}
        >
          <Text style={styles.streakEmoji}>
            {streakNotificationType === 'clockin' ? '🔥' : '🎯'}
          </Text>
          <View>
            <Text style={[styles.streakLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {streakNotificationType === 'clockin' ? '連続出勤' : 'TODO連続'}
            </Text>
            <Text style={[styles.streakCount, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              {streakValue}日目！
            </Text>
          </View>
        </Animated.View>
      )}

      <View style={styles.content}>
        {/* ステータスバッジ */}
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: badgeStyle.backgroundColor }]}>
            <Text style={[styles.badgeText, { color: badgeStyle.textColor }]}>
              {getStatusText()}
            </Text>
          </View>
        </View>

        {/* 時刻表示 */}
        {status !== 'not_started' && (
          <View style={styles.timeSection}>
            <Text style={[styles.sessionTimes, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {getWorkSessions().map((session, index) => (
                `${index > 0 ? ' ' : ''}${session.start}-${session.end || '現在'}`
              )).join('')}
              {isOnBreak() ? ' (中抜け中)' : ''}
            </Text>
            <Text style={[styles.workDuration, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              {getWorkDuration()}
            </Text>
            <Text style={[styles.durationLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              勤務時間
            </Text>
          </View>
        )}

        {/* アクションボタン */}
        <View style={styles.actionSection}>
          {status === 'not_started' && (
            <TouchableOpacity
              style={[styles.mainButton, {
                backgroundColor: isDark ? '#FFFFFF' : '#111827',
              }]}
              onPress={handleClockIn}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color={isDark ? '#111827' : '#FFFFFF'} />
              ) : (
                <Text style={[styles.mainButtonText, { color: isDark ? '#111827' : '#FFFFFF' }]}>
                  🌅 出勤する
                </Text>
              )}
            </TouchableOpacity>
          )}

          {status === 'working' && (
            <View style={styles.workingButtonsContainer}>
              {/* 中抜け/戻りボタン */}
              {isOnBreak() ? (
                <TouchableOpacity
                  style={[styles.breakButton, { backgroundColor: '#10B981' }]}
                  onPress={handleEndBreak}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.breakButtonText}>🔙 戻る</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.breakButton, { backgroundColor: '#F59E0B' }]}
                  onPress={handleStartBreak}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.breakButtonText}>🚶 中抜け</Text>
                </TouchableOpacity>
              )}

              {/* 退勤ボタン */}
              <TouchableOpacity
                style={[styles.mainButton, {
                  backgroundColor: isDark ? '#FFFFFF' : '#111827',
                }]}
                onPress={handleClockOut}
                disabled={loading}
                activeOpacity={0.7}
              >
                {loading ? (
                  <ActivityIndicator color={isDark ? '#111827' : '#FFFFFF'} />
                ) : (
                  <Text style={[styles.mainButtonText, { color: isDark ? '#111827' : '#FFFFFF' }]}>
                    🌆 退勤する
                  </Text>
                )}
              </TouchableOpacity>

              {isOnBreak() && (
                <Text style={[styles.breakNote, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  ※ 中抜け時間は自動的に休憩時間として計算されます
                </Text>
              )}
            </View>
          )}

          {status === 'completed' && (
            <View style={styles.completedSection}>
              <View style={[styles.completedCard, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
                <Text style={[styles.completedTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  本日の勤務は終了しました
                </Text>
                <Text style={[styles.completedSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  お疲れ様でした！
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.reClockInButton]}
                onPress={handleReClockIn}
                disabled={loading}
                activeOpacity={0.7}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.reClockInButtonText}>🔄 再出勤する</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* 勤務タイプ選択モーダル */}
      <Modal
        visible={showWorkTypeModal}
        onClose={() => setShowWorkTypeModal(false)}
        title="出勤タイプを選択"
      >
        <Text style={[styles.modalDescription, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
          今日の勤務タイプを選択してください
        </Text>
        <View style={styles.workTypeButtons}>
          <TouchableOpacity
            style={[styles.workTypeButton, { backgroundColor: '#3B82F6' }]}
            onPress={() => confirmClockIn('remote')}
            disabled={loading}
          >
            <Text style={styles.workTypeButtonText}>🏠 リモート</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.workTypeButton, { backgroundColor: '#10B981' }]}
            onPress={() => confirmClockIn('office')}
            disabled={loading}
          >
            <Text style={styles.workTypeButtonText}>🏢 出社</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => setShowWorkTypeModal(false)}
        >
          <Text style={[styles.cancelButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            キャンセル
          </Text>
        </TouchableOpacity>
      </Modal>

      {/* 再出勤タイプ選択モーダル */}
      <Modal
        visible={showReClockInWorkTypeModal}
        onClose={() => setShowReClockInWorkTypeModal(false)}
        title="再出勤タイプを選択"
      >
        <Text style={[styles.modalDescription, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
          再出勤の勤務タイプを選択してください
        </Text>
        <View style={styles.workTypeButtons}>
          <TouchableOpacity
            style={[styles.workTypeButton, { backgroundColor: '#3B82F6' }]}
            onPress={() => confirmReClockIn('remote')}
            disabled={loading}
          >
            <Text style={styles.workTypeButtonText}>🏠 リモート</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.workTypeButton, { backgroundColor: '#10B981' }]}
            onPress={() => confirmReClockIn('office')}
            disabled={loading}
          >
            <Text style={styles.workTypeButtonText}>🏢 出社</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => setShowReClockInWorkTypeModal(false)}
        >
          <Text style={[styles.cancelButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            キャンセル
          </Text>
        </TouchableOpacity>
      </Modal>

      {/* 休憩時間入力モーダル */}
      <Modal
        visible={showBreakMinutesModal}
        onClose={() => setShowBreakMinutesModal(false)}
        title="🌆 退勤確認"
      >
        <Text style={[styles.modalDescription, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
          中抜け時間は自動的に計算されます。{'\n'}休憩時間を入力してください（必須）。
        </Text>
        <View style={styles.breakInputContainer}>
          <Text style={[styles.breakInputLabel, { color: isDark ? '#D1D5DB' : '#374151' }]}>
            休憩時間（分）<Text style={{ color: '#EF4444' }}> ※必須</Text>
          </Text>
          <TextInput
            style={[styles.breakInput, {
              backgroundColor: isDark ? '#374151' : '#F9FAFB',
              borderColor: isDark ? '#4B5563' : '#D1D5DB',
              color: isDark ? '#FFFFFF' : '#111827',
            }]}
            value={additionalBreakMinutes}
            onChangeText={(text) => {
              const value = text.replace(/[^0-9]/g, '');
              const numValue = value === '' ? '' : String(parseInt(value, 10));
              setAdditionalBreakMinutes(numValue);
            }}
            placeholder="休憩なしの場合は 0 を入力"
            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            keyboardType="numeric"
          />
          {additionalBreakMinutes === '' && (
            <Text style={styles.breakInputError}>
              休憩時間を入力してください（休憩なしの場合は 0 を入力）
            </Text>
          )}
          {additionalBreakMinutes !== '' && (
            <Text style={[styles.breakInputHint, { color: isDark ? '#6B7280' : '#6B7280' }]}>
              例: 昼休憩60分、その他の休憩時間など
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.clockOutConfirmButton, {
            opacity: additionalBreakMinutes === '' ? 0.5 : 1,
          }]}
          onPress={handleClockOutConfirm}
          disabled={loading || additionalBreakMinutes === ''}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.clockOutConfirmButtonText}>退勤する</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => setShowBreakMinutesModal(false)}
        >
          <Text style={[styles.cancelButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            キャンセル
          </Text>
        </TouchableOpacity>
      </Modal>

      {/* 誕生日ポップアップ */}
      <Modal
        visible={showBirthdayPopup}
        onClose={() => setShowBirthdayPopup(false)}
      >
        <View style={styles.birthdayContent}>
          <Text style={styles.birthdayEmoji}>🎉</Text>
          {birthdayData.isCurrentUser ? (
            <>
              <Text style={[styles.birthdayTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                誕生日おめでとうございます！
              </Text>
              <Text style={[styles.birthdaySubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                素敵な一年になりますように
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.birthdayTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                今日は{birthdayData.members.map((m, i) =>
                  `${i > 0 ? '、' : ''}${m.name || m.email?.split('@')[0]}さん`
                ).join('')}のお誕生日です！
              </Text>
              <Text style={[styles.birthdaySubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                お祝いしましょう！
              </Text>
            </>
          )}
          <TouchableOpacity
            style={[styles.birthdayCloseButton, {
              backgroundColor: isDark ? '#FFFFFF' : '#111827',
            }]}
            onPress={() => setShowBirthdayPopup(false)}
          >
            <Text style={[styles.birthdayCloseButtonText, {
              color: isDark ? '#111827' : '#FFFFFF',
            }]}>
              閉じる
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 残業アラート */}
      <Modal
        visible={showOvertimeAlert}
        onClose={() => setShowOvertimeAlert(false)}
      >
        <View style={styles.overtimeContent}>
          <Text style={styles.overtimeEmoji}>⚠️</Text>
          <Text style={[styles.overtimeTitle, { color: isDark ? '#F87171' : '#DC2626' }]}>
            長時間労働アラート
          </Text>
          <Text style={[styles.overtimeMessage, { color: isDark ? '#FFFFFF' : '#111827' }]}>
            勤務時間が15時間を超えています
          </Text>
          <Text style={[styles.overtimeSubMessage, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            健康のため、早めに退勤することをおすすめします
          </Text>
          <TouchableOpacity
            style={styles.overtimeButton}
            onPress={() => setShowOvertimeAlert(false)}
          >
            <Text style={styles.overtimeButtonText}>確認しました</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: spacing.lg,
  },
  content: {
    alignItems: 'center',
  },
  badgeContainer: {
    marginBottom: spacing.lg,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sessionTimes: {
    fontSize: 13,
    fontWeight: '300',
    marginBottom: 4,
  },
  workDuration: {
    fontSize: 48,
    fontWeight: '300',
    letterSpacing: -1,
  },
  durationLabel: {
    fontSize: 13,
    fontWeight: '300',
    marginTop: 4,
  },
  actionSection: {
    width: '100%',
    paddingTop: spacing.md,
  },
  mainButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  mainButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  workingButtonsContainer: {
    width: '100%',
    position: 'relative',
  },
  breakButton: {
    position: 'absolute',
    top: -12,
    right: -8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  breakButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  breakNote: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  completedSection: {
    width: '100%',
  },
  completedCard: {
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  completedTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  completedSubtitle: {
    fontSize: 14,
    fontWeight: '300',
    marginTop: 4,
  },
  reClockInButton: {
    backgroundColor: '#3B82F6',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  reClockInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  // モーダル共通
  modalDescription: {
    fontSize: 14,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  workTypeButtons: {
    marginBottom: spacing.md,
  },
  workTypeButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  workTypeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // 休憩時間入力
  breakInputContainer: {
    marginBottom: spacing.lg,
  },
  breakInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  breakInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '500',
  },
  breakInputError: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 8,
  },
  breakInputHint: {
    fontSize: 12,
    marginTop: 8,
  },
  clockOutConfirmButton: {
    backgroundColor: '#F97316',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  clockOutConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  // 誕生日
  birthdayContent: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  birthdayEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  birthdayTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  birthdaySubtitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  birthdayCloseButton: {
    marginTop: spacing.lg,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  birthdayCloseButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  // 残業アラート
  overtimeContent: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  overtimeEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  overtimeTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  overtimeMessage: {
    fontSize: 18,
    marginBottom: spacing.sm,
  },
  overtimeSubMessage: {
    fontSize: 16,
    textAlign: 'center',
  },
  overtimeButton: {
    marginTop: spacing.lg,
    backgroundColor: '#EF4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  overtimeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  // ストリーク通知
  streakNotification: {
    position: 'absolute',
    top: -60,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  streakEmoji: {
    fontSize: 40,
    marginRight: spacing.md,
  },
  streakLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  streakCount: {
    fontSize: 28,
    fontWeight: '700',
  },
});
