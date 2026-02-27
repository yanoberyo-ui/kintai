import { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'
import { GlassCard, Button, Input } from '../../../components/ui'

export default function MFAChallenge({ isDark, onVerified }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [factorId, setFactorId] = useState('')

  useEffect(() => {
    // 登録済みのTOTPファクターを取得
    const getFactors = async () => {
      const { data: { totp } } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      const { data } = await supabase.auth.mfa.listFactors()

      if (data?.totp && data.totp.length > 0) {
        // 検証済みのファクターを使用
        const verifiedFactor = data.totp.find(f => f.status === 'verified')
        if (verifiedFactor) {
          setFactorId(verifiedFactor.id)
        }
      }
    }

    getFactors()
  }, [])

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!factorId) return

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
        code,
      })

      if (verifyError) throw verifyError

      onVerified?.()
    } catch (error) {
      console.error('MFA challenge error:', error)
      setError('認証コードが正しくありません。もう一度お試しください。')
      setCode('')
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
          <img
            src="/images/logo.png"
            alt="FD GROUP"
            className={`h-8 mx-auto mb-4 transition-all duration-500 ${isDark ? '' : 'invert'}`}
          />
          <div className="text-4xl mb-4">🔐</div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            二要素認証
          </h1>
          <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            認証アプリの6桁コードを入力してください
          </p>
        </div>

        <GlassCard isDark={isDark} padding="p-8" className="shadow-2xl">
          <form onSubmit={handleVerify} className="space-y-6">
            <Input
              isDark={isDark}
              label="認証コード"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              id="mfa-challenge-code"
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
              disabled={loading || code.length !== 6}
            >
              {loading ? '確認中...' : 'ログイン'}
            </Button>
          </form>
        </GlassCard>
      </div>
    </div>
  )
}
