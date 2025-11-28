// 毎朝9:00に時間あたり採算レポートをSlackに送信するEdge Function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// KPI用のSlack Webhook URL（#全体-kpi-management チャンネル用）
const SLACK_KPI_WEBHOOK_URL = Deno.env.get('SLACK_KPI_WEBHOOK_URL') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface UnitSummary {
  department: string;
  memberCount: Set<string>;
  totalMinutes: number;
  totalRevenue: number;
}

serve(async (req) => {
  try {
    // CORSヘッダー
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    // Supabaseクライアントを作成
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 日本時間で今日の年月を取得
    const now = new Date();
    const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const year = jstNow.getUTCFullYear();
    const month = jstNow.getUTCMonth() + 1;

    // 今月の開始日と終了日を計算
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    console.log(`📊 Generating profitability report for ${year}年${month}月`);

    // 勤怠データと粗利データを並列取得
    const [
      { data: attendanceData, error: attendanceError },
      { data: revenueData, error: revenueError }
    ] = await Promise.all([
      supabase
        .from('attendances')
        .select(`
          *,
          user:users (
            id,
            name,
            department
          )
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .not('clock_in', 'is', null),
      supabase
        .from('revenues')
        .select('*')
        .eq('year', year)
        .eq('month', month)
    ]);

    if (attendanceError) {
      console.error('Error loading attendance data:', attendanceError);
      throw attendanceError;
    }

    // ユニット（部署）ごとに集計
    const unitSummary: Record<string, UnitSummary> = {};

    attendanceData?.forEach((record: any) => {
      if (!record.user || !record.user.id || !record.clock_in) {
        return;
      }

      let dept = record.user.department || '未設定';

      // アドコンとムードメーカーを統合
      if (dept === 'ムードメーカー') {
        dept = 'アドコン';
      }

      if (!unitSummary[dept]) {
        unitSummary[dept] = {
          department: dept,
          memberCount: new Set(),
          totalMinutes: 0,
          totalRevenue: 0
        };
      }

      unitSummary[dept].memberCount.add(record.user.id);

      // 勤務時間を計算
      let workMinutes = 0;
      const clockIn = new Date(record.clock_in);

      if (isNaN(clockIn.getTime())) {
        return;
      }

      if (record.clock_out) {
        const clockOut = new Date(record.clock_out);
        if (!isNaN(clockOut.getTime()) && clockOut > clockIn) {
          const totalMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000);
          const breakMinutes = record.break_minutes_used || 0;
          const calculatedMinutes = Math.max(0, totalMinutes - breakMinutes);

          if (record.total_work_minutes && record.total_work_minutes > 0) {
            workMinutes = record.total_work_minutes;
          } else {
            workMinutes = calculatedMinutes;
          }
        } else {
          workMinutes = record.total_work_minutes || 0;
        }
      } else {
        if (record.total_work_minutes && record.total_work_minutes > 0) {
          workMinutes = record.total_work_minutes;
        } else {
          // その日の19:00 JSTを退勤時刻として計算
          const clockOutUTC = new Date(record.date + 'T10:00:00Z');
          const totalMinutes = Math.floor((clockOutUTC.getTime() - clockIn.getTime()) / 60000);
          const breakMinutes = record.break_minutes_used || 0;
          workMinutes = Math.max(0, totalMinutes - breakMinutes);
        }
      }

      // 異常に大きな値を制限
      if (workMinutes > 24 * 60) {
        workMinutes = 24 * 60;
      }

      unitSummary[dept].totalMinutes += workMinutes;
    });

    // 粗利を集計
    revenueData?.forEach((revenue: any) => {
      let dept = revenue.department;

      if (dept === 'ムードメーカー') {
        dept = 'アドコン';
      }

      if (unitSummary[dept]) {
        unitSummary[dept].totalRevenue += parseFloat(revenue.gross_profit) || 0;
      }
    });

    // 時間あたり採算を計算してソート
    const profitabilityData = Object.values(unitSummary)
      .map((unit: any) => ({
        department: unit.department,
        memberCount: unit.memberCount.size,
        totalHours: Math.floor(unit.totalMinutes / 60),
        totalMinutes: unit.totalMinutes % 60,
        totalRevenue: unit.totalRevenue,
        profitPerHour: unit.totalMinutes > 0 ? unit.totalRevenue / (unit.totalMinutes / 60) : 0
      }))
      .filter(unit => unit.totalHours > 0 || unit.totalRevenue > 0)
      .sort((a, b) => b.profitPerHour - a.profitPerHour);

    // Slackメッセージを作成
    const monthStr = `${year}年${month}月`;
    // 2024年11月中はテストモード
    const isTestMode = year === 2024 && month === 11;
    const testLabel = isTestMode ? '【テスト】' : '';
    let messageText = `📊 ${testLabel}*時間あたり採算レポート（${monthStr}累計）*\n\n`;

    if (profitabilityData.length === 0) {
      messageText += 'データがありません';
    } else {
      profitabilityData.forEach((unit) => {
        const profitPerHourStr = unit.profitPerHour > 0
          ? `¥${Math.round(unit.profitPerHour).toLocaleString()}`
          : '-';
        
        messageText += `■ ${unit.department}\n`;
        messageText += `　時間あたり採算: ${profitPerHourStr}\n\n`;
      });
    }

    const slackMessage = {
      text: `${testLabel}時間あたり採算レポート（${monthStr}累計）`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: messageText
          }
        }
      ]
    };

    // Slackへ送信（#全体-kpi-management チャンネル）
    if (SLACK_KPI_WEBHOOK_URL) {
      const response = await fetch(SLACK_KPI_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slackMessage),
      });

      if (!response.ok) {
        console.error('Slack webhook error:', await response.text());
        throw new Error('Failed to send Slack message');
      }

      console.log('✅ Slack message sent successfully to #全体-kpi-management');
    } else {
      console.log('⚠️ SLACK_KPI_WEBHOOK_URL not configured');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Profitability report sent',
        data: profitabilityData
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

