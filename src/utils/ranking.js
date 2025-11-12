import { supabase } from './supabase'

/**
 * 全メンバーの今日のタスク情報を取得して順位を計算
 */
export async function calculateTodayRanking(userId) {
  try {
    // 日本時間で今日の日付を取得
    const now = new Date()
    const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000))
    const today = jstDate.toISOString().split('T')[0]

    // 全メンバー取得
    const { data: members, error: membersError } = await supabase
      .from('users')
      .select('id, name, email')

    if (membersError) throw membersError

    // 全メンバーの今日のTODOリストを取得
    const { data: todoLists, error: todoError } = await supabase
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
    const membersWithScores = members.map(member => {
      const todoList = todoLists?.find(list => list.user_id === member.id)
      const items = todoList?.todo_items || []
      const taskCount = items.length
      const completedTasks = items.filter(item => item.is_completed).length
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
    membersWithScores.sort((a, b) => b.score - a.score)

    // 現在のユーザーの順位を見つける
    const userIndex = membersWithScores.findIndex(m => m.userId === userId)
    const rank = userIndex + 1
    const userStats = membersWithScores[userIndex]

    return {
      rank,
      totalMembers: members.length,
      taskCount: userStats.taskCount,
      completedTasks: userStats.completedTasks,
      completionRate: userStats.completionRate,
      score: userStats.score
    }
  } catch (error) {
    console.error('Error calculating ranking:', error)
    throw error
  }
}

/**
 * AIフィードバックを取得
 */
export async function getAIFeedback(userId, userName) {
  try {
    // 順位とタスク情報を計算
    const stats = await calculateTodayRanking(userId)

    // Vercel Serverless Functionを呼び出し
    const response = await fetch('/api/generate-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rank: stats.rank,
        totalMembers: stats.totalMembers,
        taskCount: stats.taskCount,
        completedTasks: stats.completedTasks,
        completionRate: stats.completionRate,
        name: userName
      })
    })

    if (!response.ok) {
      throw new Error('Failed to generate feedback')
    }

    const data = await response.json()

    return {
      message: data.message,
      stats
    }
  } catch (error) {
    console.error('Error getting AI feedback:', error)

    // フォールバック: AIが使えない場合は簡単なメッセージを返す
    const stats = await calculateTodayRanking(userId)
    let message = ''

    if (stats.rank === 1) {
      message = `🥇 今日の頑張り度1位！${stats.completedTasks}個のタスクを完了、素晴らしいです！✨`
    } else if (stats.rank === 2) {
      message = `🥈 今日の頑張り度2位！よく頑張りました。次は1位目指しましょう！💪`
    } else if (stats.rank === 3) {
      message = `🥉 今日の頑張り度3位！明日はもっと上を目指しましょう！🌟`
    } else {
      message = `お疲れ様でした！今日は${stats.rank}位でした。明日も頑張りましょう！😊`
    }

    return { message, stats }
  }
}
