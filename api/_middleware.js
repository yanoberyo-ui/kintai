/**
 * APIルート用レート制限ミドルウェア
 * インメモリストア（コールドスタートでリセット）
 * 内部ツール向けの簡易レート制限
 */

const rateLimitStore = new Map()

const RATE_LIMIT_WINDOW_MS = 60_000 // 1分
const MAX_REQUESTS = 10 // 1分あたり10リクエスト

export default function middleware(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const key = `${ip}:${request.url}`
  const now = Date.now()

  const record = rateLimitStore.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }

  if (now > record.resetAt) {
    record.count = 0
    record.resetAt = now + RATE_LIMIT_WINDOW_MS
  }

  record.count++
  rateLimitStore.set(key, record)

  // 古いエントリをクリーンアップ（メモリリーク防止）
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore) {
      if (now > v.resetAt) rateLimitStore.delete(k)
    }
  }

  if (record.count > MAX_REQUESTS) {
    return new Response(
      JSON.stringify({ error: 'リクエスト数が制限を超えました。しばらくしてからもう一度お試しください。' }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      }
    )
  }
}
