// Slack スラッシュコマンド用 Edge Function
// Slackから /出勤 /退勤 コマンドを受け取り、勤怠データを更新

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_WEBHOOK_URL') || '';

interface SlackCommandPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
}

interface TodoItem {
  content: string;
  is_completed: boolean;
  indent_level?: number;
}

serve(async (req) => {
  try {
    // Slackからのコマンドを受け取る
    const formData = await req.formData();
    const payload: SlackCommandPayload = {
      token: formData.get('token') as string,
      team_id: formData.get('team_id') as string,
      team_domain: formData.get('team_domain') as string,
      channel_id: formData.get('channel_id') as string,
      channel_name: formData.get('channel_name') as string,
      user_id: formData.get('user_id') as string,
      user_name: formData.get('user_name') as string,
      command: formData.get('command') as string,
      text: formData.get('text') as string,
      response_url: formData.get('response_url') as string,
    };

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Slack User IDから内部ユーザーIDを取得
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('slack_user_id', payload.user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: 'ユーザーが見つかりません。管理者にSlack IDの登録を依頼してください。',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];

    if (payload.command === '/出勤' || payload.command === '/shukkin') {
      // 出勤処理
      const { data: existingAttendance } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (existingAttendance?.clock_in) {
        return new Response(
          JSON.stringify({
            response_type: 'ephemeral',
            text: '既に出勤済みです！',
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      const now = new Date().toISOString();

      if (existingAttendance) {
        // 既存レコードを更新
        await supabase
          .from('attendances')
          .update({ clock_in: now })
          .eq('id', existingAttendance.id);
      } else {
        // 新規レコードを作成
        await supabase.from('attendances').insert({
          user_id: user.id,
          date: today,
          clock_in: now,
        });
      }

      // TODOリストを取得
      const { data: todoList } = await supabase
        .from('todo_lists')
        .select('id, todo_items(id, content, is_completed, indent_level, order_index)')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      const todoItems = (todoList?.todo_items || []) as TodoItem[];

      // Slack通知を送信
      const time = formatTime(new Date(now));
      const todoText = formatTodoListWithStrikethrough(todoItems);
      const progress = calculateProgress(todoItems);

      if (SLACK_WEBHOOK_URL) {
        await fetch(SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `${user.name || user.email}さんが出勤しました`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*🌅 ${user.name || user.email}さんが出勤しました*\n⏰ ${time}`,
                },
              },
              ...(todoText
                ? [
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `*📝 今日のTODO:* (タスク達成率 ${progress}%)\n${todoText}`,
                      },
                    },
                  ]
                : []),
            ],
          }),
        });
      }

      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: `✅ 出勤を記録しました！（${time}）`,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } else if (payload.command === '/退勤' || payload.command === '/taikin') {
      // 退勤処理
      // 休憩時間を引数から取得（例: /退勤 60）
      const breakMinutes = parseInt(payload.text.trim()) || 0;

      const { data: attendance } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (!attendance?.clock_in) {
        return new Response(
          JSON.stringify({
            response_type: 'ephemeral',
            text: 'まだ出勤していません！',
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (attendance.clock_out) {
        return new Response(
          JSON.stringify({
            response_type: 'ephemeral',
            text: '既に退勤済みです！',
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      const now = new Date().toISOString();

      // 勤務時間を計算
      const clockInTime = new Date(attendance.clock_in);
      const clockOutTime = new Date(now);
      const totalMinutes = Math.floor((clockOutTime.getTime() - clockInTime.getTime()) / 1000 / 60);
      const actualWorkMinutes = totalMinutes - breakMinutes;

      await supabase
        .from('attendances')
        .update({
          clock_out: now,
          break_minutes_used: breakMinutes,
          total_work_minutes: actualWorkMinutes,
        })
        .eq('id', attendance.id);

      // TODOリストを取得
      const { data: todoList } = await supabase
        .from('todo_lists')
        .select('id, todo_items(id, content, is_completed, indent_level, order_index)')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      const todoItems = (todoList?.todo_items || []) as TodoItem[];

      // Slack通知を送信
      const time = formatTime(new Date(now));
      const workHours = Math.floor(actualWorkMinutes / 60);
      const workMinutes = actualWorkMinutes % 60;
      const breakHours = Math.floor(breakMinutes / 60);
      const breakMinutesDisplay = breakMinutes % 60;
      const todoText = formatTodoListWithStrikethrough(todoItems);
      const progress = calculateProgress(todoItems);

      if (SLACK_WEBHOOK_URL) {
        await fetch(SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `${user.name || user.email}さんが退勤しました`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*🌃 ${user.name || user.email}さんが退勤しました*\n⏰ ${time}\n📊 勤務時間: ${workHours}時間${workMinutes}分 (休憩: ${breakHours}時間${breakMinutesDisplay}分)`,
                },
              },
              ...(todoText
                ? [
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `*📝 今日のTODO:* (タスク達成率 ${progress}%)\n${todoText}`,
                      },
                    },
                  ]
                : []),
            ],
          }),
        });
      }

      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: `✅ 退勤を記録しました！（${time}）\n勤務時間: ${workHours}時間${workMinutes}分`,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '不明なコマンドです。',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: `エラーが発生しました: ${error.message}`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatTodoListWithStrikethrough(todos: TodoItem[]): string {
  if (!todos || todos.length === 0) {
    return '今日のTODOはまだありません';
  }

  return todos
    .map((todo) => {
      const indent = '　'.repeat(todo.indent_level || 0);
      const checkbox = todo.is_completed ? '✅' : '◻️';
      const content = todo.is_completed ? `~${todo.content}~` : todo.content;
      return `${indent}${checkbox} ${content}`;
    })
    .join('\n');
}

function calculateProgress(todos: TodoItem[]): number {
  if (!todos || todos.length === 0) return 0;
  const completed = todos.filter((t) => t.is_completed).length;
  return Math.round((completed / todos.length) * 100);
}
