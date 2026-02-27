import React, { useEffect, useRef } from 'react'
import ChatBubble from './ChatBubble'

export default function ChatMessageThread({ messages, currentUserId, isDark }) {
  const bottomRef = useRef(null)
  const containerRef = useRef(null)

  // 新しいメッセージが来たら自動スクロール
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const formatDateHeader = (dateStr) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return '今日'
    if (date.toDateString() === yesterday.toDateString()) return '昨日'
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  // メッセージを日付ごとにグループ化
  const groupedMessages = []
  let currentDate = null

  for (const msg of messages) {
    const msgDate = new Date(msg.created_at).toDateString()
    if (msgDate !== currentDate) {
      currentDate = msgDate
      groupedMessages.push({ type: 'date', date: msg.created_at })
    }
    groupedMessages.push({ type: 'message', data: msg })
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className={`text-4xl mb-3`}>💬</div>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            メッセージはまだありません
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            最初のメッセージを送信しましょう
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3">
      {groupedMessages.map((item, idx) => {
        if (item.type === 'date') {
          return (
            <div key={`date-${idx}`} className="flex justify-center my-3">
              <span className={`text-[11px] px-3 py-1 rounded-full ${
                isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
              }`}>
                {formatDateHeader(item.date)}
              </span>
            </div>
          )
        }

        const msg = item.data
        return (
          <ChatBubble
            key={msg.id}
            message={msg}
            isOwn={msg.sender_id === currentUserId}
            isDark={isDark}
          />
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
