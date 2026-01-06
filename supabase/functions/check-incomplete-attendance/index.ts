// 退勤漏れチェック Edge Function
// 毎日深夜0時（JST）に実行され、退勤していないユーザーをSlackに通知する

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_WEBHOOK_URL') || ''

serve(async (req) => {
  // CORS対応
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Supabaseクライアント作成（サービスロール使用）
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

    // 3:00amに日付が切り替わる「今日」の日付を取得
    const now = new Date()
    const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000))
    const adjustedDate = new Date(jstDate.getTime() - (3 * 60 * 60 * 1000))
    const today = adjustedDate.toISOString().split('T')[0]

    console.log(`Checking incomplete attendance for date: ${today}`)

    // 退勤漏れユーザーを取得（clock_inがあり、clock_outがない）
    const { data: incompleteAttendances, error: attendanceError } = await supabaseClient
      .from('attendances')
      .select(`
        id,
        user_id,
        clock_in,
        users (
          id,
          name,
          email
        )
      `)
      .eq('date', today)
      .not('clock_in', 'is', null)
      .is('clock_out', null)

    if (attendanceError) throw attendanceError

    console.log(`Found ${incompleteAttendances?.length || 0} users with incomplete attendance`)

    // 該当者がいない場合は終了
    if (!incompleteAttendances || incompleteAttendances.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          date: today,
          message: '退勤漏れのユーザーはいませんでした',
          incompleteCount: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // ユーザー名リストを作成
    const userNames = incompleteAttendances.map((att: any) => {
      const user = att.users
      return user?.name || user?.email?.split('@')[0] || '不明'
    })

    // Slack通知メッセージを作成
    const slackMessage = {
      text: `⚠️ 退勤漏れ確認`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*⚠️ 退勤漏れ確認*\n以下のメンバーが本日退勤していません。\n3:00までに対応をお願いします。`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: userNames.map((name: string) => `• ${name}さん`).join('\n')
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `対象日: ${today} | 該当者: ${userNames.length}名`
            }
          ]
        }
      ]
    }

    // Slackに通知を送信
    if (SLACK_WEBHOOK_URL) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      try {
        const slackResponse = await fetch(SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(slackMessage),
          signal: controller.signal,
        })

        if (!slackResponse.ok) {
          console.error('Slack API error:', await slackResponse.text())
        } else {
          console.log('Slack notification sent successfully')
        }
      } catch (error) {
        if (error.name === 'AbortError') {
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

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        incompleteCount: incompleteAttendances.length,
        users: userNames
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error checking incomplete attendance:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

