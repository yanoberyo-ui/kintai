import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SPREADSHEET_ID = "1nBNo7bSQKPmNb_1g6VRFl6Ise8TAMqo48kaJMfHCY18"
const SHEET_NAME = "報告/MG粗利11月"

// ユニットごとのセル位置
const UNIT_CELLS = {
  "第1ユニット": "L17",
  "第2ユニット": "L21",
  "第3ユニット": "L29",
  "第5ユニット": "L37"
}

// Google OAuth2トークンを取得
async function getAccessToken(credentials: any) {
  const jwtHeader = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))

  const now = Math.floor(Date.now() / 1000)
  const jwtClaimSet = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }
  const jwtClaimSetEncoded = btoa(JSON.stringify(jwtClaimSet))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")

  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`

  // RS256署名を作成
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(credentials.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signatureInput)
  )

  const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")

  const jwt = `${signatureInput}.${signatureEncoded}`

  // トークンを取得
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const data = await response.json()
  return data.access_token
}

function pemToArrayBuffer(pem: string) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "")
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

serve(async (req) => {
  // CORSヘッダー
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // OPTIONSリクエスト対応
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 月をクエリパラメータから取得（デフォルトは現在の月）
    const url = new URL(req.url)
    const month = url.searchParams.get('month') || String(new Date().getMonth() + 1)

    // サービスアカウント認証情報を取得
    const credentialsJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
    if (!credentialsJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set')
    }

    const credentials = JSON.parse(credentialsJson)
    const accessToken = await getAccessToken(credentials)

    // 各ユニットの達成率を取得
    const rankings = []

    for (const [unitName, cell] of Object.entries(UNIT_CELLS)) {
      // Google Sheets APIでセルの値を取得
      const range = `${SHEET_NAME}!${cell}`
      const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`

      const response = await fetch(sheetUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        console.error(`Failed to fetch ${unitName}:`, await response.text())
        continue
      }

      const data = await response.json()

      // セルの値を取得（パーセンテージを想定）
      let achievementRate = 0
      if (data.values && data.values[0] && data.values[0][0]) {
        const cellValue = data.values[0][0]

        // 数値として解析
        if (typeof cellValue === 'string') {
          // "85%" のような文字列の場合
          if (cellValue.includes('%')) {
            achievementRate = parseFloat(cellValue.replace('%', ''))
          } else {
            // "0.85" のような小数の場合
            const num = parseFloat(cellValue)
            achievementRate = num > 1 ? num : num * 100
          }
        } else if (typeof cellValue === 'number') {
          // 0.85のような小数の場合は100倍
          achievementRate = cellValue > 1 ? cellValue : cellValue * 100
        }
      }

      rankings.push({
        department: unitName,
        achievementRate: Math.round(achievementRate),
        cell: cell
      })
    }

    // 達成率でソート
    rankings.sort((a, b) => b.achievementRate - a.achievementRate)

    return new Response(
      JSON.stringify({
        success: true,
        data: rankings,
        month: month,
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('Error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
