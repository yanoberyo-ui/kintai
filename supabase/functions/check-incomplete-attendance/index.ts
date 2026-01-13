// 退勤漏れチェック & 中抜け自動退勤 Edge Function
// 毎日3:00am（JST）に実行され、前日の退勤していないユーザーを処理する
// - 中抜け中のユーザー → 中抜け開始時刻で自動退勤
// - それ以外 → Slackに通知

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

    // 前日（3:00am基準）の日付を取得
    const yesterday = new Date(adjustedDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    console.log(`Checking incomplete attendance for date: ${yesterdayStr} (yesterday based on 3:00am cutoff)`)

    // 前日の退勤漏れユーザーを取得（clock_inがあり、clock_outがない）
    const { data: incompleteAttendances, error: attendanceError } = await supabaseClient
      .from('attendances')
      .select(`
        id,
        user_id,
        clock_in,
        break_sessions,
        total_work_minutes,
        users (
          id,
          name,
          email,
          slack_user_id
        )
      `)
      .eq('date', yesterdayStr)
      .not('clock_in', 'is', null)
      .is('clock_out', null)

    if (attendanceError) throw attendanceError

    console.log(`Found ${incompleteAttendances?.length || 0} users with incomplete attendance`)

    // 該当者がいない場合は終了
    if (!incompleteAttendances || incompleteAttendances.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          date: yesterdayStr,
          message: '退勤漏れのユーザーはいませんでした',
          incompleteCount: 0,
          autoClockOutCount: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // 自動退勤処理
    const autoClockOutUsers: Array<{ name: string, slackId: string | null }> = []
    const regularIncompleteUsers: Array<{ name: string, slackId: string | null }> = []

    for (const att of incompleteAttendances) {
      const user = att.users as any
      const userName = user?.name || user?.email?.split('@')[0] || '不明'
      const slackId = user?.slack_user_id || null
      const breakSessions = att.break_sessions || []
      
      // 中抜け中かチェック（end が null のセッションがあるか）
      const ongoingBreak = breakSessions.find((session: any) => session.start && !session.end)
      
      if (ongoingBreak) {
        // 中抜け中の場合：中抜け開始時刻で自動退勤
        const breakStartTime = ongoingBreak.start
        
        // 中抜け時間を0分として完了（中抜け開始時刻で退勤するので実質0分）
        const updatedBreakSessions = breakSessions.map((session: any) => {
          if (session.start === ongoingBreak.start && !session.end) {
            return { ...session, end: breakStartTime, minutes: 0 }
          }
          return session
        })
        
        // 中抜け時間の合計を計算
        let totalBreakMinutes = 0
        for (const session of updatedBreakSessions) {
          totalBreakMinutes += session.minutes || 0
        }
        
        // 退勤処理（中抜け開始時刻で退勤）
        const { error: updateError } = await supabaseClient
          .from('attendances')
          .update({
            clock_out: breakStartTime,
            break_sessions: updatedBreakSessions,
            break_minutes_used: totalBreakMinutes,
            // total_work_minutes は中抜け開始時点で既に保存されているのでそのまま
            status: 'completed',
            last_clock_out: null
          })
          .eq('id', att.id)
        
        if (updateError) {
          console.error(`Auto clock-out failed for ${userName}:`, updateError)
        } else {
          console.log(`Auto clock-out (from break) for ${userName} at ${breakStartTime}`)
          autoClockOutUsers.push({ name: userName, slackId })
        }
      } else {
        // 通常の退勤漏れ
        regularIncompleteUsers.push({ name: userName, slackId })
      }
    }

    // Slack通知メッセージを作成
    const slackBlocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*⚠️ 勤怠漏れ確認 (${yesterdayStr})*`
        }
      }
    ]

    // 自動退勤されたユーザーがいる場合
    if (autoClockOutUsers.length > 0) {
      const autoClockOutMentions = autoClockOutUsers.map(u => {
        if (u.slackId) {
          return `• <@${u.slackId}>（中抜け開始時刻で自動退勤）`
        }
        return `• ${u.name}さん（中抜け開始時刻で自動退勤）`
      })
      slackBlocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🔄 自動退勤処理済み:*\n${autoClockOutMentions.join('\n')}`
        }
      })
    }

    // 通常の退勤漏れユーザーがいる場合
    if (regularIncompleteUsers.length > 0) {
      const regularMentions = regularIncompleteUsers.map(u => {
        if (u.slackId) {
          return `• <@${u.slackId}>`
        }
        return `• ${u.name}さん`
      })
      slackBlocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*❌ 退勤漏れ（要確認）:*\n${regularMentions.join('\n')}`
        }
      })
    }

    slackBlocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `対象日: ${yesterdayStr} | 自動退勤: ${autoClockOutUsers.length}名 | 要確認: ${regularIncompleteUsers.length}名`
        }
      ]
    })

    const slackMessage = {
      text: `⚠️ 勤怠漏れ確認 (${yesterdayStr})`,
      blocks: slackBlocks
    }

    // Slackに通知を送信（自動退勤か通常の退勤漏れがある場合のみ）
    if (SLACK_WEBHOOK_URL && (autoClockOutUsers.length > 0 || regularIncompleteUsers.length > 0)) {
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
    } else if (!SLACK_WEBHOOK_URL) {
      console.warn('SLACK_WEBHOOK_URL is not configured')
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: yesterdayStr,
        incompleteCount: incompleteAttendances.length,
        autoClockOutCount: autoClockOutUsers.length,
        regularIncompleteCount: regularIncompleteUsers.length,
        autoClockOutUsers: autoClockOutUsers.map(u => u.name),
        regularIncompleteUsers: regularIncompleteUsers.map(u => u.name)
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
