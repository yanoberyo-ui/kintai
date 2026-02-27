import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

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

    console.log(`Finalizing ranking for date: ${today}`)

    // 全メンバー取得
    const { data: members, error: membersError } = await supabaseClient
      .from('users')
      .select('id, name, email')

    if (membersError) throw membersError

    // 全メンバーの今日のTODOリストを取得
    const { data: todoLists, error: todoError } = await supabaseClient
      .from('todo_lists')
      .select(`
        id,
        user_id,
        todo_items (
          id,
          is_completed
        )
      `)
      .eq('date', today)

    if (todoError) throw todoError

    // 各メンバーのタスク情報を計算
    const membersWithScores = members.map((member: any) => {
      const todoList = todoLists?.find((list: any) => list.user_id === member.id)
      const items = todoList?.todo_items || []
      const taskCount = items.length
      const completedTasks = items.filter((item: any) => item.is_completed).length
      const completionRate = taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0

      // 頑張り度スコア = 完了したタスク数 + 達成率ボーナス
      const score = completedTasks + (completionRate / 100)

      return {
        userId: member.id,
        name: member.name || member.email.split('@')[0],
        taskCount,
        completedTasks,
        completionRate,
        score
      }
    })

    // スコアで降順ソート
    membersWithScores.sort((a: any, b: any) => b.score - a.score)

    // ランキングデータを作成
    const rankingData = membersWithScores.map((member: any, index: number) => ({
      date: today,
      user_id: member.userId,
      rank: index + 1,
      score: member.score,
      task_count: member.taskCount,
      completed_tasks: member.completedTasks,
      completion_rate: member.completionRate,
      snapshot_time: new Date().toISOString()
    }))

    // daily_rankingsテーブルに保存（upsert）
    const { error: insertError } = await supabaseClient
      .from('daily_rankings')
      .upsert(rankingData, {
        onConflict: 'date,user_id'
      })

    if (insertError) throw insertError

    console.log(`Successfully finalized ranking for ${rankingData.length} members`)

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        memberCount: rankingData.length,
        rankings: rankingData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error finalizing ranking:', error)
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
