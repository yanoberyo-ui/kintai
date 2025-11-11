// Slack通知用 Edge Function
// 出勤・退勤時にSlackへ通知を送信

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_WEBHOOK_URL') || '';

interface TodoItem {
  content: string;
  is_completed: boolean;
  indent_level?: number;
}

interface NotificationPayload {
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  user_id: string;
  user_name: string;
  timestamp: string;
  work_duration?: number;
  break_duration?: number;
  actual_work_duration?: number;
  todo_items?: TodoItem[];
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
      // 出勤通知（TODOリスト付き）
      const time = formatTime(new Date(payload.timestamp));
      const todoText = formatTodoListWithStrikethrough(payload.todo_items || []);
      const progress = calculateProgress(payload.todo_items || []);

      slackMessage = {
        text: `${payload.user_name}さんが出勤しました`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🌅 ${payload.user_name}さんが出勤しました*\n⏰ ${time}`
            }
          },
          ...(todoText ? [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*📝 今日のTODO:* (タスク達成率 ${progress}%)\n${todoText}`
            }
          }] : [])
        ]
      };
    } else if (payload.type === 'clock_out') {
      // 退勤通知（TODOリスト付き）
      const time = formatTime(new Date(payload.timestamp));
      const workHours = Math.floor((payload.actual_work_duration || 0) / 60);
      const workMinutes = (payload.actual_work_duration || 0) % 60;
      const breakHours = Math.floor((payload.break_duration || 0) / 60);
      const breakMinutes = (payload.break_duration || 0) % 60;
      const todoText = formatTodoListWithStrikethrough(payload.todo_items || []);
      const progress = calculateProgress(payload.todo_items || []);

      slackMessage = {
        text: `${payload.user_name}さんが退勤しました`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🌃 ${payload.user_name}さんが退勤しました*\n⏰ ${time}\n📊 勤務時間: ${workHours}時間${workMinutes}分 (休憩: ${breakHours}時間${breakMinutes}分)`
            }
          },
          ...(todoText ? [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*📝 今日のTODO:* (タスク達成率 ${progress}%)\n${todoText}`
            }
          }] : [])
        ]
      };
    } else if (payload.type === 'break_start') {
      // 休憩開始通知
      const time = formatTime(new Date(payload.timestamp));
      slackMessage = {
        text: `${payload.user_name}さんが休憩を開始しました`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*☕ ${payload.user_name}さんが休憩を開始しました*\n⏰ ${time}`
            }
          }
        ]
      };
    } else if (payload.type === 'break_end') {
      // 休憩終了通知
      const time = formatTime(new Date(payload.timestamp));
      slackMessage = {
        text: `${payload.user_name}さんが休憩を終了しました`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*💪 ${payload.user_name}さんが休憩を終了しました*\n⏰ ${time}`
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
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatTodoList(todos: TodoItem[]): string {
  if (!todos || todos.length === 0) {
    return '今日のTODOはまだありません';
  }

  return todos.map((todo) => {
    const indent = '　'.repeat(todo.indent_level || 0);
    const checkbox = todo.is_completed ? '✅' : '◻️';
    return `${indent}${checkbox} ${todo.content}`;
  }).join('\n');
}

function formatTodoListWithStrikethrough(todos: TodoItem[]): string {
  if (!todos || todos.length === 0) {
    return '今日のTODOはまだありません';
  }

  return todos.map((todo) => {
    const indent = '　'.repeat(todo.indent_level || 0);
    const checkbox = todo.is_completed ? '✅' : '◻️';
    const content = todo.is_completed ? `~${todo.content}~` : todo.content;
    return `${indent}${checkbox} ${content}`;
  }).join('\n');
}

function calculateProgress(todos: TodoItem[]): number {
  if (!todos || todos.length === 0) return 0;
  const completed = todos.filter((t) => t.is_completed).length;
  return Math.round((completed / todos.length) * 100);
}
