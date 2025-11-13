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
      { name: '全体', cell: 'I5' },
      { name: '第1広告ユニット', cell: 'I12' },
      { name: '第2広告ユニット', cell: 'I20' },
      { name: '第3広告ユニット', cell: 'I28' },
      { name: '第5広告ユニット', cell: 'I36' }
    ]

    const ranges = cellRanges.map(r => `${SHEET_NAME}!${r.cell}`).join('&ranges=')
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?ranges=${ranges}`

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${await response.text()}`)
    }

    const data = await response.json()

    // Prepare data for Supabase
    const revenueData = []
    for (let i = 0; i < cellRanges.length; i++) {
      const unit = cellRanges[i]
      const value = data.valueRanges[i]?.values?.[0]?.[0]

      if (value) {
        const gross_profit = parseFloat(String(value).replace(/,/g, ''))
        revenueData.push({
          year,
          month,
          department: unit.name,
          gross_profit
        })
      }
    }

    // Insert into Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error } = await supabase
      .from('revenues')
      .upsert(revenueData, {
        onConflict: 'year,month,department'
      })

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
