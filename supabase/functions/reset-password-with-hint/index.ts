import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { email, answer, newPassword } = await req.json()

    // Validate input
    if (!email || !answer || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'メールアドレス、答え、新しいパスワードは必須です' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'パスワードは6文字以上である必要があります' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify hint
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, password_hint')
      .eq('email', email)
      .single()

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: 'このメールアドレスは登録されていません' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!userData.password_hint) {
      return new Response(
        JSON.stringify({ error: 'このアカウントにはパスワードヒントが設定されていません' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse hint data (support both JSON and legacy text format)
    let hintData = userData.password_hint
    if (typeof hintData === 'string') {
      try {
        hintData = JSON.parse(hintData)
      } catch {
        // Legacy format: treat as simple text answer
        hintData = { question: '', answer: hintData }
      }
    }

    if (!hintData || !hintData.answer) {
      return new Response(
        JSON.stringify({ error: 'このアカウントにはパスワードヒントが正しく設定されていません' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Compare answer (case-insensitive)
    if (hintData.answer.toLowerCase().trim() !== answer.toLowerCase().trim()) {
      return new Response(
        JSON.stringify({ error: '答えが一致しません' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update password using Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userData.id,
      { password: newPassword }
    )

    if (authError) {
      console.error('Password update error:', authError)
      return new Response(
        JSON.stringify({ error: 'パスワードの変更に失敗しました: ' + authError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'パスワードを変更しました' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

