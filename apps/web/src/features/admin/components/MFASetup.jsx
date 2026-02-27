import { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'
import { GlassCard, Button, Input } from '../../../components/ui'

export default function MFASetup({ isDark, onVerified, onSkip }) {
  const [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  // MFA登録を開始
  const handleEnroll = async () => {
    setEnrolling(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'FD-APP認証アプリ',
      })

      if (error) throw error

      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
    } catch (error) {
      console.error('MFA enroll error:', error)
      setError(error.message || 'MFAの登録に失敗しました')
    } finally {
      setEnrolling(false)
    }
  }

  // 認証コードを検証
  const handleVerify = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      })

      if (challengeError) throw challengeError

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      })

      if (verifyError) throw verifyError

      onVerified?.()
    } catch (error) {
      console.error('MFA verify error:', error)
      setError(error.message || '認証コードが正しくありません')
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
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🔐</div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            二要素認証 (2FA)
          </h1>
          <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            管理者アカウントのセキュリティを強化します
          </p>
        </div>

        <GlassCard isDark={isDark} padding="p-8" className="shadow-2xl">
          {!qrCode ? (
            // ステップ1: 登録開始
            <div className="space-y-6">
              <div className={`p-4 rounded-xl ${
                isDark ? 'bg-blue-900/20 border border-blue-700/50' : 'bg-blue-50 border border-blue-200'
              }`}>
                <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                  Google Authenticator や Microsoft Authenticator などの認証アプリを使って、ログイン時に追加の認証コードを求めます。
                </p>
              </div>

              <div className="space-y-3">
                <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>設定手順</h3>
                <ol className={`text-sm space-y-2 list-decimal list-inside ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <li>認証アプリをスマートフォンにインストール</li>
                  <li>下のボタンでQRコードを生成</li>
                  <li>認証アプリでQRコードをスキャン</li>
                  <li>表示された6桁のコードを入力して完了</li>
                </ol>
              </div>

              <Button
                variant="primary"
                size="full"
                isDark={isDark}
                onClick={handleEnroll}
                disabled={enrolling}
              >
                {enrolling ? '準備中...' : 'QRコードを生成'}
              </Button>

              {onSkip && (
                <button
                  onClick={onSkip}
                  className={`w-full text-sm font-light py-2 transition-colors ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  後で設定する
                </button>
              )}
            </div>
          ) : (
            // ステップ2: QRコード表示 + コード入力
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="text-center">
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  認証アプリでこのQRコードをスキャンしてください
                </p>
                <div className="inline-block p-4 bg-white rounded-2xl shadow-lg">
                  <img src={qrCode} alt="QRコード" className="w-48 h-48" />
                </div>
              </div>

              {/* シークレットキー（手動入力用） */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className={`text-xs transition-colors ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {showSecret ? 'シークレットキーを隠す' : 'QRコードを読み取れない場合'}
                </button>
                {showSecret && (
                  <div className={`mt-2 p-3 rounded-xl text-xs font-mono break-all ${
                    isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {secret}
                  </div>
                )}
              </div>

              <Input
                isDark={isDark}
                label="認証コード（6桁）"
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                id="mfa-verify-code"
                inputMode="numeric"
                autoComplete="one-time-code"
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
                disabled={loading || verifyCode.length !== 6}
              >
                {loading ? '確認中...' : '認証コードを確認'}
              </Button>
            </form>
          )}

          {error && !qrCode && (
            <div className={`mt-4 text-sm px-4 py-3 rounded-xl font-light ${
              isDark ? 'text-red-400 bg-red-900/20' : 'text-red-600 bg-red-50'
            }`}>
              {error}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
