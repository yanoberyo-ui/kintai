import React, { useState } from 'react'
import { checkIn } from '../../utils/participant'

export default function CheckInPage({ eventId, eventName, sessionId, onCheckInComplete }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('名前を入力してください')
      return
    }

    try {
      setLoading(true)
      setError('')
      const participant = await checkIn(eventId, name.trim(), sessionId)
      onCheckInComplete(participant)
    } catch (err) {
      console.error('Error checking in:', err)
      setError('チェックインに失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-900 flex items-center justify-center p-6 safe-area-inset">
      <div className="w-full max-w-md">
        {/* ヘッダー */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-6">🎮</div>
          <h1 className="text-3xl font-bold text-white mb-3">{eventName}</h1>
          <p className="text-gray-400 text-lg">参加するには名前を入力してください</p>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="あなたの名前"
              className="w-full px-6 py-5 rounded-2xl bg-gray-800 border-2 border-gray-700 text-white text-xl placeholder:text-gray-500 focus:border-white focus:outline-none transition-colors"
              autoFocus
              autoComplete="off"
              enterKeyHint="go"
            />
          </div>

          {error && (
            <div className="text-red-400 text-base text-center py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-5 rounded-2xl bg-white text-gray-900 font-bold text-xl transition-all duration-200 active:scale-[0.98] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '参加中...' : '参加する'}
          </button>
        </form>
      </div>
    </div>
  )
}
