import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.1/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { year, month } = await req.json()

    // Get service account credentials from environment
    const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
    if (!serviceAccountKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not found')
    }

    const credentials = JSON.parse(serviceAccountKey)

    // Create JWT for Google OAuth2
    const now = getNumericDate(new Date())

    // Import private key
    const pemHeader = "-----BEGIN PRIVATE KEY-----"
    const pemFooter = "-----END PRIVATE KEY-----"
    const pemContents = credentials.private_key
      .replace(pemHeader, "")
      .replace(pemFooter, "")
      .replace(/\s/g, "")

    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    )

    // Create JWT
    const jwt = await create(
      { alg: "RS256", typ: "JWT" },
      {
        iss: credentials.client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      },
      privateKey
    )

    // Get access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error(`Token error: ${await tokenResponse.text()}`)
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Fetch data from Google Sheets
    const SPREADSHEET_ID = '1nBNo7bSQKPmNb_1g6VRFl6Ise8TAMqo48kaJMfHCY18'
    const SHEET_NAME = '報告/MG粗利11月'

    const cellRanges = [
      { name: '全体', grossProfitCell: 'I5', achievementRateCell: null },
      { name: '第1ユニット', grossProfitCell: 'I12', achievementRateCell: 'L17' },
      { name: '第2ユニット', grossProfitCell: 'I20', achievementRateCell: 'L21' },
      { name: '第3ユニット', grossProfitCell: 'I28', achievementRateCell: 'L29' },
      { name: '第5ユニット', grossProfitCell: 'I36', achievementRateCell: 'L37' }
    ]

    // 粗利と達成率のセルを両方取得
    const ranges: string[] = []
    cellRanges.forEach(r => {
      ranges.push(`${SHEET_NAME}!${r.grossProfitCell}`)
      if (r.achievementRateCell) {
        ranges.push(`${SHEET_NAME}!${r.achievementRateCell}`)
      }
    })
    const encodedRanges = ranges.map(r => encodeURIComponent(r))
    const rangesParam = encodedRanges.join('&ranges=')
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?ranges=${rangesParam}`

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${await response.text()}`)
    }

    const data = await response.json()
    console.log('Raw data from sheets:', JSON.stringify(data))

    // Prepare data for Supabase
    const revenueData = []
    let rangeIndex = 0

    for (let i = 0; i < cellRanges.length; i++) {
      const unit = cellRanges[i]

      // 粗利を取得
      const grossProfitValue = data.valueRanges[rangeIndex]?.values?.[0]?.[0]
      rangeIndex++

      let gross_profit = 0
      if (grossProfitValue) {
        gross_profit = parseFloat(String(grossProfitValue).replace(/,/g, '').replace(/¥/g, ''))
      }

      // 達成率を取得（全体以外）
      let achievement_rate = null
      if (unit.achievementRateCell) {
        const achievementValue = data.valueRanges[rangeIndex]?.values?.[0]?.[0]
        rangeIndex++

        if (achievementValue) {
          // パーセンテージ形式の処理
          if (typeof achievementValue === 'string') {
            if (achievementValue.includes('%')) {
              achievement_rate = parseFloat(achievementValue.replace('%', ''))
            } else {
              const num = parseFloat(achievementValue)
              achievement_rate = num > 1 ? num : num * 100
            }
          } else if (typeof achievementValue === 'number') {
            achievement_rate = achievementValue > 1 ? achievementValue : achievementValue * 100
          }
        }
      }

      console.log(`${unit.name}: gross_profit=${gross_profit}, achievement_rate=${achievement_rate}`)

      revenueData.push({
        year,
        month,
        department: unit.name,
        gross_profit,
        achievement_rate: achievement_rate ? Math.round(achievement_rate) : null
      })
    }

    console.log('Final revenueData:', JSON.stringify(revenueData))

    // Insert into Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // まず既存のデータを削除
    const { error: deleteError } = await supabase
      .from('revenues')
      .delete()
      .eq('year', year)
      .eq('month', month)

    if (deleteError) throw deleteError

    // 新しいデータを挿入
    const { error } = await supabase
      .from('revenues')
      .insert(revenueData)

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, imported: revenueData.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
