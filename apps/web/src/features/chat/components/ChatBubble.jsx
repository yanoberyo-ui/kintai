import React from 'react'

export default function ChatBubble({ message, isOwn, isDark }) {
  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[75%] ${isOwn ? 'order-1' : 'order-1'}`}>
        <div
          className={`px-3 py-2 rounded-2xl whitespace-pre-wrap break-words text-sm ${
            isOwn
              ? 'bg-blue-500 text-white rounded-br-md'
              : isDark
                ? 'bg-gray-700 text-gray-100 rounded-bl-md'
                : 'bg-gray-200 text-gray-900 rounded-bl-md'
          }`}
        >
          {message.content}
        </div>
        <div
          className={`flex items-center gap-1 mt-0.5 px-1 ${
            isOwn ? 'justify-end' : 'justify-start'
          }`}
        >
          <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {formatTime(message.created_at)}
          </span>
          {isOwn && (
            <span className={`text-[10px] ${message.is_read ? 'text-blue-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}>
              {message.is_read ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
