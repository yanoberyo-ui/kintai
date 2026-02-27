import { useState } from 'react'
import { supabase } from '../../../utils/supabase'
import { GlassCard, Button, Input } from '../../../components/ui'

export default function LoginScreen({ isDark }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [slackId, setSlackId] = useState('')
  const [department, setDepartment] = useState('')
  const [birthday, setBirthday] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetHint, setResetHint] = useState('')
  const [hintQuestion, setHintQuestion] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetError, setResetError] = useState('')
  const [hintVerified, setHintVerified] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)

  // Google OAuth ログイン（Calendar APIスコープ付き）
  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
        },
      })

      if (error) throw error
    } catch (error) {
      console.error('Google login error:', error)
      setError(error.message || 'Googleログインに失敗しました')
      setGoogleLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // ログイン成功時はonAuthStateChangeが発火するのでloadingはそこで解除
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // 1. Supabase Authでユーザー作成
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      // authDataが正しく返されているか確認
      if (!authData?.user?.id) {
        throw new Error('ユーザー登録に失敗しました。もう一度お試しください。')
      }

      // 2. 既存のユーザーレコードをチェック
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', authData.user.id)
        .maybeSingle()

      // SELECTエラーがある場合はスルー（RLSでブロックされている可能性）
      // 3. ユーザーレコードが存在しない場合のみ挿入
      if (!existingUser) {
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            {
              id: authData.user.id,
              email: email,
              name: name,
              slack_user_id: slackId,
              role: 'user',
              department: department || null,
              birthday: birthday || null,
            },
          ])

        if (insertError) {
          // 既に存在する場合のエラーは無視（別のタブで登録完了した可能性）
          if (!insertError.message.includes('duplicate') && !insertError.message.includes('already exists')) {
            throw insertError
          }
        }
      }

      alert('登録完了！ログインしてください。')
      setIsSignUp(false)
      setName('')
      setSlackId('')
      setDepartment('')
      setBirthday('')
    } catch (error) {
      console.error('Sign up error:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleHintVerification = async (e) => {
    e.preventDefault()
    setResetLoading(true)
    setResetError('')
    setHintVerified(false)

    try {
      // メールアドレスでユーザーの質問のみ取得（回答はサーバー側で検証）
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, password_hint')
        .eq('email', resetEmail)
        .single()

      if (userError || !userData) {
        throw new Error('このメールアドレスは登録されていません。')
      }

      if (!userData.password_hint) {
        throw new Error('このアカウントにはパスワードヒントが設定されていません。設定ページでヒントを設定してください。')
      }

      // JSON形式のヒントから質問のみ取得
      let hintData = userData.password_hint
      if (typeof hintData === 'string') {
        try {
          hintData = JSON.parse(hintData)
        } catch {
          hintData = { question: '' }
        }
      }

      if (!hintData || !hintData.question) {
        throw new Error('このアカウントにはパスワードヒントが正しく設定されていません。設定ページでヒントを設定してください。')
      }

      // 質問を保存して表示（回答の検証はパスワード変更時にEdge Functionで実施）
      setHintQuestion(hintData.question)
      setHintVerified(true)
      setResetError('')
    } catch (error) {
      console.error('❌ ヒント認証エラー:', error)
      setResetError(error.message || '答えの確認に失敗しました')
    } finally {
      setResetLoading(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setResetLoading(true)
    setResetError('')

    if (newPassword !== confirmPassword) {
      setResetError('パスワードが一致しません')
      setResetLoading(false)
      return
    }

    if (newPassword.length < 6) {
      setResetError('パスワードは6文字以上である必要があります')
      setResetLoading(false)
      return
    }

    try {
      // Edge Functionを呼び出してパスワードを変更
      const { data, error } = await supabase.functions.invoke('reset-password-with-hint', {
        body: {
          email: resetEmail,
          answer: resetHint, // 答えを送信
          newPassword: newPassword,
        },
      })

      if (error) {
        throw new Error(error.message || 'パスワードの変更に失敗しました')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      setResetSuccess(true)
      setResetEmail('')
      setResetHint('')
      setHintQuestion('')
      setNewPassword('')
      setConfirmPassword('')
      setHintVerified(false)
    } catch (error) {
      console.error('❌ パスワード変更エラー:', error)
      setResetError(error.message || 'パスワードの変更に失敗しました')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 transition-colors duration-500 ${
      isDark
        ? 'bg-gradient-to-br from-gray-900 via-black to-gray-900'
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-50'
    }`}>
      <div className="w-full max-w-md">
        {/* ロゴ */}
        <div className="text-center mb-12">
          <img
            src="/images/logo.png"
            alt="FD GROUP"
            className={`h-12 mx-auto mb-4 transition-all duration-500 ${
              isDark ? '' : 'invert'
            }`}
          />
          <p className={`font-light ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            勤怠管理システム
          </p>
        </div>

        {/* ログイン/サインアップカード */}
        <GlassCard isDark={isDark} padding="p-8" className="shadow-2xl">
          {/* タブ切り替え */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={!isSignUp ? 'primary' : 'ghost'}
              size="md"
              isDark={isDark}
              onClick={() => setIsSignUp(false)}
              className="flex-1"
            >
              ログイン
            </Button>
            <Button
              variant={isSignUp ? 'primary' : 'ghost'}
              size="md"
              isDark={isDark}
              onClick={() => setIsSignUp(true)}
              className="flex-1"
            >
              新規登録
            </Button>
          </div>

          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-6">
            {isSignUp && (
              <>
                <Input
                  isDark={isDark}
                  label="氏名"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="山田太郎"
                  required
                  id="login-name"
                />
                <Input
                  isDark={isDark}
                  label="Slack ID"
                  type="text"
                  value={slackId}
                  onChange={(e) => setSlackId(e.target.value)}
                  placeholder="U01234ABCDE"
                  required
                  id="login-slack-id"
                />
                <Input
                  isDark={isDark}
                  label="部署（任意）"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="開発部"
                  id="login-department"
                />
                <Input
                  isDark={isDark}
                  label="誕生日（任意）"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  id="login-birthday"
                />
              </>
            )}

            <Input
              isDark={isDark}
              label="メールアドレス"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              id="login-email"
            />

            <Input
              isDark={isDark}
              label="パスワード"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              required
              id="login-password"
            />

            {error && (
              <div className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl font-light">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="full"
              isDark={isDark}
              disabled={loading}
            >
              {loading ? (isSignUp ? '登録中...' : 'ログイン中...') : (isSignUp ? '新規登録' : 'ログイン')}
            </Button>

            {/* パスワードを忘れた場合のリンク（ログインモードの時のみ表示） */}
            {!isSignUp && (
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordReset(true)
                    setResetEmail(email)
                    setResetError('')
                    setResetSuccess(false)
                  }}
                  className={`text-sm font-light transition-colors ${
                    isDark
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  パスワードを忘れた場合
                </button>
              </div>
            )}

            {/* または セパレーター */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className={`px-4 ${isDark ? 'bg-gray-900 text-gray-400' : 'bg-white text-gray-500'}`}>
                  または
                </span>
              </div>
            </div>

            {/* Google OAuth ボタン */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className={`w-full font-medium py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border ${
                isDark
                  ? 'bg-gray-800/50 text-white border-gray-700 hover:bg-gray-700/50 hover:border-gray-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {googleLoading ? 'ログイン中...' : 'Googleでログイン'}
            </button>

            {/* Roots連携の説明（ログインモードのみ） */}
            {!isSignUp && (
              <p className={`text-xs text-center mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Rootsと同じGoogleアカウントでログインすると連携できます
              </p>
            )}
          </form>

          {/* パスワードリセットフォーム */}
          {showPasswordReset && (
            <div className={`mt-6 pt-6 border-t ${
              isDark ? 'border-gray-800' : 'border-gray-200'
            }`}>
              <h3 className={`text-lg font-medium mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                パスワードリセット
              </h3>

              {resetSuccess ? (
                <div className={`p-4 rounded-xl ${
                  isDark ? 'bg-green-900/20 border border-green-700/50' : 'bg-green-50 border border-green-200'
                }`}>
                  <p className={`text-sm ${
                    isDark ? 'text-green-300' : 'text-green-800'
                  }`}>
                    パスワードを変更しました！新しいパスワードでログインしてください。
                  </p>
                  <button
                    onClick={() => {
                      setShowPasswordReset(false)
                      setResetSuccess(false)
                      setResetEmail('')
                      setResetHint('')
                      setNewPassword('')
                      setConfirmPassword('')
                      setHintVerified(false)
                    }}
                    className={`mt-3 text-sm font-medium ${
                      isDark ? 'text-green-400 hover:text-green-300' : 'text-green-600 hover:text-green-700'
                    }`}
                  >
                    閉じる
                  </button>
                </div>
              ) : hintVerified ? (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className={`p-4 rounded-xl ${
                    isDark ? 'bg-blue-900/20 border border-blue-700/50' : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                      ヒントが確認できました。新しいパスワードを設定してください。
                    </p>
                  </div>

                  <Input
                    isDark={isDark}
                    label="新しいパスワード"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6文字以上"
                    required
                    minLength={6}
                    id="reset-new-password"
                  />

                  <Input
                    isDark={isDark}
                    label="パスワード（確認）"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="もう一度入力"
                    required
                    minLength={6}
                    id="reset-confirm-password"
                  />

                  {resetError && (
                    <div className={`text-sm px-4 py-3 rounded-xl font-light whitespace-pre-line ${
                      isDark ? 'text-red-400 bg-red-900/20' : 'text-red-600 bg-red-50'
                    }`}>
                      {resetError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      isDark={isDark}
                      onClick={() => {
                        setHintVerified(false)
                        setNewPassword('')
                        setConfirmPassword('')
                        setResetError('')
                      }}
                      className="flex-1"
                    >
                      戻る
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      isDark={isDark}
                      disabled={resetLoading}
                      className="flex-1"
                    >
                      {resetLoading ? '変更中...' : 'パスワードを変更'}
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleHintVerification} className="space-y-4">
                  <div className={`p-4 rounded-xl mb-4 ${
                    isDark ? 'bg-blue-900/20 border border-blue-700/50' : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                      メールアドレスを入力すると、設定した質問が表示されます。
                      <br />
                      その質問の答えを入力してパスワードをリセットできます。
                    </p>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`} htmlFor="reset-email">
                      メールアドレス
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={async (e) => {
                        setResetEmail(e.target.value)
                        setResetHint('')
                        setHintQuestion('')
                        if (e.target.value) {
                          try {
                            const { data: userData } = await supabase
                              .from('users')
                              .select('password_hint')
                              .eq('email', e.target.value)
                              .single()

                            if (userData?.password_hint) {
                              let hintData = userData.password_hint
                              if (typeof hintData === 'string') {
                                try {
                                  hintData = JSON.parse(hintData)
                                } catch {
                                  hintData = { question: '' }
                                }
                              }
                              if (hintData && hintData.question) {
                                setHintQuestion(hintData.question)
                              }
                            }
                          } catch (error) {
                            // エラーは無視（ユーザーが見つからない場合など）
                          }
                        }
                      }}
                      className={`w-full px-4 py-3 rounded-xl border focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors outline-none font-light ${
                        isDark
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                          : 'bg-gray-50/50 border-gray-200 text-gray-900 focus:border-gray-400'
                      }`}
                      placeholder="email@example.com"
                      required
                    />
                  </div>

                  {hintQuestion && (
                    <div className={`p-4 rounded-xl border ${
                      isDark ? 'bg-green-900/20 border-green-700/50' : 'bg-green-50 border-green-200'
                    }`}>
                      <div className={`text-sm font-medium mb-2 ${isDark ? 'text-green-300' : 'text-green-800'}`}>
                        質問
                      </div>
                      <div className={`text-base ${isDark ? 'text-green-200' : 'text-green-900'}`}>
                        {hintQuestion}
                      </div>
                    </div>
                  )}

                  <Input
                    isDark={isDark}
                    label={hintQuestion ? '答え' : 'パスワードヒント'}
                    type="text"
                    value={resetHint}
                    onChange={(e) => setResetHint(e.target.value)}
                    placeholder={hintQuestion ? "質問の答えを入力" : "メールアドレスを入力してください"}
                    required
                    disabled={!hintQuestion}
                    id="reset-hint-answer"
                  />

                  {resetError && (
                    <div className={`text-sm px-4 py-3 rounded-xl font-light whitespace-pre-line ${
                      isDark ? 'text-red-400 bg-red-900/20' : 'text-red-600 bg-red-50'
                    }`}>
                      {resetError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      isDark={isDark}
                      onClick={() => {
                        setShowPasswordReset(false)
                        setResetEmail('')
                        setResetHint('')
                        setResetError('')
                        setHintVerified(false)
                      }}
                      className="flex-1"
                    >
                      キャンセル
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      isDark={isDark}
                      disabled={resetLoading}
                      className="flex-1"
                    >
                      {resetLoading ? '確認中...' : '確認'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
