import React, { useState, useRef, useCallback } from 'react'

export default function ChatInput({ onSend, isDark }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef(null)

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
  }, [])

  const handleChange = (e) => {
    setText(e.target.value)
    adjustHeight()
  }

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setSending(true)
    try {
      await onSend(trimmed)
      setText('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`flex items-end gap-2 p-3 border-t ${
      isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
    }`}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="メッセージを入力..."
        rows={1}
        disabled={sending}
        className={`flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none transition-colors ${
          isDark
            ? 'bg-gray-700 text-gray-100 placeholder-gray-400 focus:ring-1 focus:ring-blue-500'
            : 'bg-gray-100 text-gray-900 placeholder-gray-500 focus:ring-1 focus:ring-blue-500'
        } ${sending ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || sending}
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
          text.trim() && !sending
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : isDark
              ? 'bg-gray-700 text-gray-500'
              : 'bg-gray-200 text-gray-400'
        }`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
