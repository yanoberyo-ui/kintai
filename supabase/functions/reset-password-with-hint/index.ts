import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

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

    // Create Supabase client with service role key (rate limit check requires DB)
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

    // Rate limit check: 15分間に5回まで
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { count: attemptCount } = await supabaseAdmin
      .from('password_reset_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('email', email.toLowerCase().trim())
      .gte('attempted_at', fifteenMinutesAgo)

    if (attemptCount !== null && attemptCount >= 5) {
      return new Response(
        JSON.stringify({ error: '試行回数の上限に達しました。15分後にもう一度お試しください。' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Record this attempt
    await supabaseAdmin
      .from('password_reset_attempts')
      .insert({ email: email.toLowerCase().trim() })

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

    // Parse hint data (support hashed, JSON, and legacy text formats)
    let hintData = userData.password_hint
    if (typeof hintData === 'string') {
      try {
        hintData = JSON.parse(hintData)
      } catch {
        // Legacy format: treat as simple text answer
        hintData = { question: '', answer: hintData }
      }
    }

    if (!hintData || (!hintData.answer && !hintData.answer_hash)) {
      return new Response(
        JSON.stringify({ error: 'このアカウントにはパスワードヒントが正しく設定されていません' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Compare answer: support both hashed and legacy plaintext formats
    let answerMatch = false
    if (hintData.answer_hash && hintData.salt) {
      // New hashed format: hash the submitted answer with stored salt and compare
      const normalized = answer.toLowerCase().trim()
      const data = new TextEncoder().encode(hintData.salt + normalized)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const submittedHash = hashArray.map((b: number) => b.toString(16).padStart(2, '0')).join('')
      answerMatch = submittedHash === hintData.answer_hash
    } else if (hintData.answer) {
      // Legacy plaintext format: case-insensitive comparison
      answerMatch = hintData.answer.toLowerCase().trim() === answer.toLowerCase().trim()
    }

    if (!answerMatch) {
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
        JSON.stringify({ error: 'パスワードの変更に失敗しました。管理者にお問い合わせください。' }),
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
      JSON.stringify({ error: 'サーバーエラーが発生しました。しばらくしてからもう一度お試しください。' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

