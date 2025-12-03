// Slack通知用 Edge Function
// 出勤・退勤時にSlackへ通知を送信（シンプル版）

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_WEBHOOK_URL') || '';

interface NotificationPayload {
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  user_id: string;
  user_name: string;
  timestamp: string;
  work_duration?: number;
  break_duration?: number;
  actual_work_duration?: number;
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

    const payload: NotificationPayload = await req.json();

    // Slack通知の作成
    let slackMessage: any = {};

    if (payload.type === 'clock_in') {
      // 出勤通知
      const time = formatTime(new Date(payload.timestamp));

      slackMessage = {
        text: `${payload.user_name}さんが出勤しました`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🌅 ${payload.user_name}さんが出勤しました*\n⏰ ${time}`
            }
          }
        ]
      };
    } else if (payload.type === 'clock_out') {
      // 退勤通知
      const time = formatTime(new Date(payload.timestamp));
      const workHours = Math.floor((payload.actual_work_duration || 0) / 60);
      const workMinutes = (payload.actual_work_duration || 0) % 60;
      const breakHours = Math.floor((payload.break_duration || 0) / 60);
      const breakMinutes = (payload.break_duration || 0) % 60;

      slackMessage = {
        text: `${payload.user_name}さんが退勤しました`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🌃 ${payload.user_name}さんが退勤しました*\n⏰ ${time}\n📊 勤務時間: ${workHours}時間${workMinutes}分 (休憩: ${breakHours}時間${breakMinutes}分)`
            }
          }
        ]
      };
    } else if (payload.type === 'break_start') {
      // 中抜け開始通知
      const time = formatTime(new Date(payload.timestamp));
      slackMessage = {
        text: `${payload.user_name}さんが中抜けしました`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🚶 ${payload.user_name}さんが中抜けしました*\n⏰ ${time}`
            }
          }
        ]
      };
    } else if (payload.type === 'break_end') {
      // 中抜け終了（戻り）通知
      const time = formatTime(new Date(payload.timestamp));
      slackMessage = {
        text: `${payload.user_name}さんが戻りました`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🔙 ${payload.user_name}さんが戻りました*\n⏰ ${time}`
            }
          }
        ]
      };
    }

    // Slackへ送信
    if (SLACK_WEBHOOK_URL) {
      await fetch(SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slackMessage),
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notification sent' }),
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
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

function formatTime(date: Date): string {
  // UTC時刻を日本時間（JST = UTC+9）に変換
  const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
  const hours = jstDate.getUTCHours().toString().padStart(2, '0');
  const minutes = jstDate.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
