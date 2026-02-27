import { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'
import { GlassCard, Button, Input } from '../../../components/ui'

export default function PasswordResetPage({ isDark, onResetComplete }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // URLハッシュからトークンを取得
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const type = hashParams.get('type')
    const accessToken = hashParams.get('access_token')

    if (type === 'recovery' && accessToken) {
      // トークンが有効か確認
      // Supabaseは自動的にセッションを設定するので、ここでは何もしない
    } else {
      // トークンがない場合はエラー
      setError('無効なリンクです。パスワードリセットメールから再度アクセスしてください。')
    }
  }, [])

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上である必要があります')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      setSuccess(true)
      // 3秒後にログイン画面に戻る
      setTimeout(() => {
        window.location.hash = ''
        onResetComplete()
      }, 3000)
    } catch (error) {
      console.error('Password reset error:', error)
      setError(error.message || 'パスワードのリセットに失敗しました')
    } finally {
      setLoading(false)
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
            パスワードリセット
          </p>
        </div>

        {/* パスワードリセットカード */}
        <GlassCard isDark={isDark} padding="p-8" className="shadow-2xl">
          {success ? (
            <div className="text-center space-y-4">
              <div className="text-4xl mb-4">✅</div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                パスワードをリセットしました
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                新しいパスワードでログインできます。
                <br />
                3秒後にログイン画面に戻ります...
              </p>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <h2 className={`text-xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                新しいパスワードを設定
              </h2>

              <Input
                isDark={isDark}
                label="新しいパスワード"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6文字以上"
                required
                minLength={6}
                id="pw-reset-password"
              />

              <Input
                isDark={isDark}
                label="パスワード（確認）"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="パスワードを再入力"
                required
                minLength={6}
                id="pw-reset-confirm"
              />

              {error && (
                <div className={`text-sm px-4 py-3 rounded-xl font-light ${
                  isDark ? 'text-red-400 bg-red-900/20' : 'text-red-600 bg-red-50'
                }`}>
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
                {loading ? '設定中...' : 'パスワードを設定'}
              </Button>

              <button
                type="button"
                onClick={() => {
                  window.location.hash = ''
                  onResetComplete()
                }}
                className={`w-full text-sm font-light py-2 transition-colors ${
                  isDark
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ログイン画面に戻る
              </button>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
