// 退勤漏れリマインド Edge Function
// 毎日12時（JST）に実行され、前日退勤していないユーザーに入力を促す

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_REMIND_WEBHOOK_URL') || Deno.env.get('SLACK_WEBHOOK_URL') || ''

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // リクエストボディから日付を取得（テスト用）
    let requestBody: { date?: string } = {}
    try {
      requestBody = await req.json()
    } catch {
      // bodyがない場合は無視
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 日付を決定（パラメータがあればそれを使用、なければ昨日）
    let targetDate: string
    if (requestBody.date) {
      targetDate = requestBody.date
    } else {
      // 「昨日」の日付を取得（3:00am区切り）
      const now = new Date()
      const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000))
      const yesterday = new Date(jstDate.getTime() - (24 * 60 * 60 * 1000))
      targetDate = yesterday.toISOString().split('T')[0]
    }

    console.log(`Checking incomplete attendance for date: ${targetDate}`)

    // まだ退勤漏れのユーザーを取得
    const { data: incompleteAttendances, error: attendanceError } = await supabaseClient
      .from('attendances')
      .select(`
        id,
        user_id,
        clock_in,
        users (
          id,
          name,
          email,
          slack_user_id
        )
      `)
      .eq('date', targetDate)
      .not('clock_in', 'is', null)
      .is('clock_out', null)

    if (attendanceError) throw attendanceError

    console.log(`Found ${incompleteAttendances?.length || 0} users with incomplete attendance`)

    if (!incompleteAttendances || incompleteAttendances.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          date: targetDate,
          message: '退勤漏れのユーザーはいませんでした',
          incompleteCount: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Slack通知を送信（各ユーザーごとにボタン付きメッセージ）
    if (SLACK_WEBHOOK_URL) {
      // メッセージブロックを作成
      const blocks: any[] = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*:memo: 退勤時間の入力をお願いします*\n昨日（${targetDate}）の退勤ボタンが押されていません。\n下のボタンから退勤時間と休憩時間を入力してください。`
          }
        },
        {
          type: 'divider'
        }
      ]

      // 各ユーザーにボタンを追加
      for (const att of incompleteAttendances) {
        const user = (att as any).users
        const slackId = user?.slack_user_id
        const name = user?.name || user?.email?.split('@')[0] || '不明'
        const attendanceId = att.id

        // メンション付きテキスト
        const userMention = slackId ? `<@${slackId}>` : `${name}さん`

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${userMention}\n退勤時間と休憩時間を入力してください`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: ':pencil: 入力する',
              emoji: true
            },
            value: JSON.stringify({
              attendance_id: attendanceId,
              user_name: name,
              date: targetDate,
              slack_user_id: slackId || null
            }),
            action_id: 'open_attendance_modal'
          }
        })
      }

      // フッター
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `対象日: ${targetDate} | 該当者: ${incompleteAttendances.length}名`
          }
        ]
      })

      const slackMessage = {
        text: '退勤時間の入力をお願いします',
        blocks
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      try {
        const slackResponse = await fetch(SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMessage),
          signal: controller.signal,
        })

        if (!slackResponse.ok) {
          console.error('Slack API error:', await slackResponse.text())
        } else {
          console.log('Slack reminder sent successfully')
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          console.error('Slack notification timeout')
        } else {
          console.error('Slack notification error:', error)
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } else {
      console.warn('SLACK_WEBHOOK_URL is not configured')
    }

    const userNames = incompleteAttendances.map((att: any) => {
      const user = att.users
      return user?.name || user?.email?.split('@')[0] || '不明'
    })

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        incompleteCount: incompleteAttendances.length,
        users: userNames
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error sending reminder:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
