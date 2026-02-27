/**
 * CORS ユーティリティ（Supabase Edge Functions用）
 * 許可されたオリジンからのリクエストのみAccess-Control-Allow-Originを返す
 */

const ALLOWED_ORIGINS = [
  'https://fd-app-gamma.vercel.app',
  'https://kintai-web-fd9.vercel.app',
  'https://kintai-web-pink.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}
