import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.1/mod.ts"
import { getCorsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

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

    // Fetch data from Google Sheets（粗利用スプレッドシート）
    const SPREADSHEET_ID = '1TwgzF9GYllrKDXg1Lkyo6ZCPB3jGRnwZzEpGpz5Q8PQ'
    
    // シート名を動的に生成（報告/MG粗利○月 形式で検索、なければ最初のシート）
    const SHEET_NAME = `報告/MG粗利${month}月`

    // 新しいセル位置（全体、CATS、SAL）
    const cellRanges = [
      { name: '全体', grossProfitCell: 'D5' },
      { name: 'CATS', grossProfitCell: 'D12' },
      { name: 'SAL', grossProfitCell: 'D20' }
    ]

    // 粗利セルを取得
    const ranges: string[] = cellRanges.map(r => `${SHEET_NAME}!${r.grossProfitCell}`)
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

    for (let i = 0; i < cellRanges.length; i++) {
      const unit = cellRanges[i]

      // 粗利を取得
      const grossProfitValue = data.valueRanges[i]?.values?.[0]?.[0]

      let gross_profit = 0
      if (grossProfitValue) {
        // カンマ、円マーク、パーセント記号を除去して数値化
        const cleanValue = String(grossProfitValue).replace(/,/g, '').replace(/¥/g, '').replace(/%/g, '')
        gross_profit = parseFloat(cleanValue)
        // パーセンテージ形式の場合（0〜1の小数）は100倍
        if (gross_profit > 0 && gross_profit < 1) {
          gross_profit = gross_profit * 100
        }
      }

      console.log(`${unit.name}: gross_profit=${gross_profit}`)

      revenueData.push({
        year,
        month,
        department: unit.name,
        gross_profit,
        achievement_rate: null
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
