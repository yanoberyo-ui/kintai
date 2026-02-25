import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { Card } from '../components';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';

interface KintaiRecord {
  id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
}

interface MarkedDates {
  [date: string]: {
    marked: boolean;
    dotColor: string;
    selected?: boolean;
    selectedColor?: string;
  };
}

export default function CalendarScreen() {
  const { user } = useAuth();
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [records, setRecords] = useState<KintaiRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<KintaiRecord | null>(null);

  const fetchMonthRecords = async (year: number, month: number) => {
    if (!user) return;

    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

      const { data, error } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;

      if (data) {
        setRecords(data);
        
        // マークする日付を生成
        const marks: MarkedDates = {};
        data.forEach((record: KintaiRecord) => {
          marks[record.date] = {
            marked: true,
            dotColor: record.clock_out ? '#059669' : '#f59e0b'
          };
        });
        setMarkedDates(marks);
      }
    } catch (error) {
      console.error('Error fetching month records:', error);
    }
  };

  useEffect(() => {
    const today = new Date();
    fetchMonthRecords(today.getFullYear(), today.getMonth() + 1);
  }, [user]);

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
    
    // 選択された日の記録を取得
    const record = records.find(r => r.date === day.dateString);
    setSelectedRecord(record || null);

    // マークを更新（選択状態を追加）
    const newMarked = { ...markedDates };
    Object.keys(newMarked).forEach(date => {
      if (newMarked[date].selected) {
        delete newMarked[date].selected;
        delete newMarked[date].selectedColor;
      }
    });
    if (newMarked[day.dateString]) {
      newMarked[day.dateString] = {
        ...newMarked[day.dateString],
        selected: true,
        selectedColor: '#3b82f6',
      };
    } else {
      newMarked[day.dateString] = {
        marked: false,
        dotColor: '#3b82f6',
        selected: true,
        selectedColor: '#3b82f6',
      };
    }
    setMarkedDates(newMarked);
  };

  const handleMonthChange = (month: DateData) => {
    fetchMonthRecords(month.year, month.month);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'short'
    });
  };

  return (
    <ScrollView style={styles.container}>
      <Calendar
        markedDates={markedDates}
        onDayPress={handleDayPress}
        onMonthChange={handleMonthChange}
        theme={{
          selectedDayBackgroundColor: '#3b82f6',
          todayTextColor: '#3b82f6',
          arrowColor: '#3b82f6',
          monthTextColor: '#111827',
          textDayFontWeight: '400',
          textMonthFontWeight: '600',
          textDayHeaderFontWeight: '600',
        }}
        enableSwipeMonths
      />
      
      {selectedDate && (
        <Card style={styles.detailCard}>
          <Text style={styles.detailTitle}>{formatDate(selectedDate)}</Text>
          {selectedRecord ? (
            <View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>出勤時刻:</Text>
                <Text style={styles.detailValue}>{formatTime(selectedRecord.clock_in)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>退勤時刻:</Text>
                <Text style={styles.detailValue}>
                  {selectedRecord.clock_out ? formatTime(selectedRecord.clock_out) : '未打刻'}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={[
                  styles.statusText,
                  selectedRecord.clock_out ? styles.statusCompleted : styles.statusWorking
                ]}>
                  {selectedRecord.clock_out ? '勤務終了' : '勤務中'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.noRecord}>勤怠記録がありません</Text>
          )}
        </Card>
      )}

      <Card style={styles.legendCard}>
        <Text style={styles.legendTitle}>凡例</Text>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
          <Text style={styles.legendText}>勤務終了</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.legendText}>勤務中（退勤未打刻）</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  detailCard: {
    margin: 16,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#111827',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusCompleted: {
    color: '#059669',
    backgroundColor: '#d1fae5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusWorking: {
    color: '#f59e0b',
    backgroundColor: '#fef3c7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  noRecord: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  legendCard: {
    margin: 16,
    marginTop: 0,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#111827',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#374151',
  },
});
