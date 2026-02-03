import React, { useState } from 'react'
import { createEvent } from '../../utils/event'

export default function EventCreate({ isDark, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      setLoading(true)
      const event = await createEvent(name.trim(), description.trim())
      onCreated(event)
    } catch (error) {
      console.error('Error creating event:', error)
      alert('イベントの作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`max-w-md w-full rounded-3xl shadow-2xl border p-6 ${
          isDark
            ? 'bg-gray-900/95 border-gray-800/50'
            : 'bg-white/95 border-gray-200/50'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            新規イベント作成
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isDark
                ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              イベント名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 第1回シャッフルランチ"
              className={`w-full px-4 py-3 rounded-xl border transition-all duration-200 ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-white'
                  : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-gray-900'
              } focus:outline-none`}
              autoFocus
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              説明（任意）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="イベントの説明を入力..."
              rows={3}
              className={`w-full px-4 py-3 rounded-xl border transition-all duration-200 resize-none ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-white'
                  : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-gray-900'
              } focus:outline-none`}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-3 rounded-xl font-medium transition-all duration-200 ${
                isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className={`flex-1 py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? 'bg-white text-gray-900 hover:bg-gray-100'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {loading ? '作成中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
