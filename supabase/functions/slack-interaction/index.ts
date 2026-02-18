// Slack インタラクション処理 Edge Function
// ボタンクリック時にモーダルを開き、送信時にDBを更新する

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN') || ''

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Slackからのペイロードを取得
    const formData = await req.formData()
    const payloadStr = formData.get('payload')

    if (!payloadStr) {
      return new Response('No payload', { status: 400 })
    }

    const payload = JSON.parse(payloadStr as string)
    console.log('Slack interaction type:', payload.type)

    // ボタンクリック時
    if (payload.type === 'block_actions') {
      const action = payload.actions?.[0]

      if (action?.action_id === 'open_attendance_modal') {
        const valueData = JSON.parse(action.value)
        const { attendance_id, user_name, date, slack_user_id } = valueData
        const triggerId = payload.trigger_id
        const clickedUserId = payload.user?.id

        // 本人確認：ボタンを押した人と対象ユーザーが一致するかチェック
        if (slack_user_id && clickedUserId !== slack_user_id) {
          // 他人のボタンを押した場合はエラーメッセージを返す
          return new Response(
            JSON.stringify({
              response_type: 'ephemeral',
              text: `このボタンは ${user_name} さん本人のみが押せます`
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 200
            }
          )
        }

        // モーダルを開く
        const modalView = {
          type: 'modal',
          callback_id: 'attendance_submit',
          private_metadata: JSON.stringify({ attendance_id, date }),
          title: {
            type: 'plain_text',
            text: '退勤時間入力'
          },
          submit: {
            type: 'plain_text',
            text: '送信'
          },
          close: {
            type: 'plain_text',
            text: 'キャンセル'
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${user_name}さん* の ${date} の退勤情報を入力してください`
              }
            },
            {
              type: 'input',
              block_id: 'clock_out_block',
              element: {
                type: 'timepicker',
                action_id: 'clock_out_time',
                placeholder: {
                  type: 'plain_text',
                  text: '退勤時間を選択'
                }
              },
              label: {
                type: 'plain_text',
                text: '退勤時間'
              }
            },
            {
              type: 'input',
              block_id: 'break_block',
              element: {
                type: 'static_select',
                action_id: 'break_minutes',
                placeholder: {
                  type: 'plain_text',
                  text: '休憩時間を選択'
                },
                options: [
                  { text: { type: 'plain_text', text: '0分' }, value: '0' },
                  { text: { type: 'plain_text', text: '15分' }, value: '15' },
                  { text: { type: 'plain_text', text: '30分' }, value: '30' },
                  { text: { type: 'plain_text', text: '45分' }, value: '45' },
                  { text: { type: 'plain_text', text: '60分（1時間）' }, value: '60' },
                  { text: { type: 'plain_text', text: '90分（1時間30分）' }, value: '90' },
                  { text: { type: 'plain_text', text: '120分（2時間）' }, value: '120' }
                ]
              },
              label: {
                type: 'plain_text',
                text: '休憩時間'
              }
            }
          ]
        }

        // Slack API でモーダルを開く
        const openModalResponse = await fetch('https://slack.com/api/views.open', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            trigger_id: triggerId,
            view: modalView
          })
        })

        const result = await openModalResponse.json()
        if (!result.ok) {
          console.error('Failed to open modal:', result.error)
        }

        return new Response('', { status: 200 })
      }
    }

    // モーダル送信時
    if (payload.type === 'view_submission') {
      const callbackId = payload.view?.callback_id

      if (callbackId === 'attendance_submit') {
        const metadata = JSON.parse(payload.view?.private_metadata || '{}')
        const { attendance_id, date } = metadata

        const values = payload.view?.state?.values
        const clockOutTime = values?.clock_out_block?.clock_out_time?.selected_time
        const breakMinutes = parseInt(values?.break_block?.break_minutes?.selected_option?.value || '0')

        console.log('Updating attendance:', { attendance_id, clockOutTime, breakMinutes })

        // Supabaseクライアント作成
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

        // 退勤時間をタイムスタンプに変換
        // dateとclockOutTimeを組み合わせてUTCに変換
        if (!clockOutTime || !date) {
          console.error('Missing clockOutTime or date:', { clockOutTime, date })
          return new Response(
            JSON.stringify({
              response_action: 'errors',
              errors: {
                clock_out_block: '退勤時間または日付が取得できませんでした'
              }
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 200
            }
          )
        }

        const clockOutDate = new Date(`${date}T${clockOutTime}:00+09:00`)
        const clockOutTimestamp = clockOutDate.toISOString()

        // 既存の出勤時間を取得して稼働時間を計算
        const { data: attendance, error: fetchError } = await supabaseClient
          .from('attendances')
          .select('clock_in')
          .eq('id', attendance_id)
          .single()

        if (fetchError || !attendance?.clock_in) {
          console.error('Failed to fetch attendance:', fetchError)
          return new Response(
            JSON.stringify({
              response_action: 'errors',
              errors: {
                clock_out_block: '出勤データの取得に失敗しました'
              }
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 200
            }
          )
        }

        const clockInDate = new Date(attendance.clock_in)

        // 日付の妥当性チェック
        if (isNaN(clockInDate.getTime()) || isNaN(clockOutDate.getTime())) {
          console.error('Invalid date:', { clockIn: attendance.clock_in, clockOut: clockOutTimestamp })
          return new Response(
            JSON.stringify({
              response_action: 'errors',
              errors: {
                clock_out_block: '日時の計算でエラーが発生しました'
              }
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 200
            }
          )
        }

        const totalMinutes = Math.floor((clockOutDate.getTime() - clockInDate.getTime()) / 60000)
        const totalWorkMinutes = Math.max(0, totalMinutes - breakMinutes)

        console.log('Calculated work minutes:', { clockIn: attendance.clock_in, clockOut: clockOutTimestamp, breakMinutes, totalWorkMinutes })

        // DBを更新
        const { error: updateError } = await supabaseClient
          .from('attendances')
          .update({
            clock_out: clockOutTimestamp,
            break_minutes_used: breakMinutes,
            total_work_minutes: totalWorkMinutes
          })
          .eq('id', attendance_id)

        if (updateError) {
          console.error('DB update error:', updateError)
          return new Response(
            JSON.stringify({
              response_action: 'errors',
              errors: {
                clock_out_block: 'データの保存に失敗しました'
              }
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 200
            }
          )
        }

        console.log('Attendance updated successfully')

        // 管理者にDM通知を送信
        const adminUserId = 'U085SL9NT0E'
        const submitterName = payload.user?.name || payload.user?.username || '不明'

        try {
          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              channel: adminUserId,
              text: `退勤時間の修正が完了しました`,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `:white_check_mark: *退勤時間の修正完了*\n\n*対象者:* ${submitterName}\n*対象日:* ${date}\n*退勤時間:* ${clockOutTime}\n*休憩時間:* ${breakMinutes}分`
                  }
                }
              ]
            })
          })
          console.log('Admin notification sent')
        } catch (dmError) {
          console.error('Failed to send admin DM:', dmError)
        }

        // 成功メッセージを表示
        return new Response(
          JSON.stringify({
            response_action: 'update',
            view: {
              type: 'modal',
              title: {
                type: 'plain_text',
                text: '完了'
              },
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `:white_check_mark: *登録完了*\n\n退勤時間: ${clockOutTime}\n休憩時間: ${breakMinutes}分\n\nありがとうございました！`
                  }
                }
              ]
            }
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Error processing interaction:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
