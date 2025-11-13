import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export default async function handler(req, res) {
  // CORSヘッダー
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      rank,
      totalMembers,
      taskCount,
      completedTasks,
      completionRate,
      name,
      isAfter19,
      additionalCompletedTasks
    } = req.body

    // 19:00以降の追加タスク完了メッセージ
    let additionalMessage = ''
    if (isAfter19 && additionalCompletedTasks > 0) {
      additionalMessage = `\n※19:00以降もさらに${additionalCompletedTasks}個のタスクを完了！素晴らしい努力です👏`
    }

    // AIにフィードバックを生成させる
    const completion = await openai.chat.completions.create({
      model: 'chatgpt-4o-latest',
      messages: [
        {
          role: 'system',
          content: `あなたは温かみのある励ましの言葉をかけるコーチです。
退勤時に従業員に対して、今日の頑張りを称えつつ、明日へのモチベーションを高める短いメッセージを作成してください。

メッセージのガイドライン：
- 1位: めちゃくちゃ褒める！最高の成果を讃える（絵文字多め🎉✨）
- 2位: 良く頑張った！次は1位目指そうという前向きなメッセージ
- 3位: 頑張りを認めつつ、さらなる成長を応援
- 4位以下: ポジティブに励まし、明日への意欲を引き出す

状況に応じたアドバイス：
- タスクは多いが達成率が低い → 「○個のタスクに挑戦！明日はもう少し完了できるよう応援してます💪」
- タスクは少ないが達成率が高い → 「タスク全て完了お疲れ様！明日はもう少しチャレンジしてみよう🌟」
- タスクが0個 → 「明日はTODOを出すところから始めよう！」

注意事項：
- ランキングは19:00時点で確定されるため、19:00以降のタスク完了はランキングには影響しない
- しかし19:00以降も頑張った人は別途褒める

メッセージは2-3行、100文字以内で簡潔に。`
        },
        {
          role: 'user',
          content: `${name}さんの今日の結果:
- 順位: ${rank}位 / ${totalMembers}人中（19:00時点で確定）
- タスク数: ${taskCount}個
- 完了タスク: ${completedTasks}個
- 達成率: ${completionRate}%
${isAfter19 && additionalCompletedTasks > 0 ? `- 19:00以降の追加完了: ${additionalCompletedTasks}個` : ''}

退勤メッセージを作成してください。`
        }
      ],
      temperature: 0.8,
      max_tokens: 150
    })

    const message = completion.choices[0].message.content

    return res.status(200).json({ message })
  } catch (error) {
    console.error('Error generating feedback:', error)
    return res.status(500).json({
      error: 'Failed to generate feedback',
      details: error.message
    })
  }
}
