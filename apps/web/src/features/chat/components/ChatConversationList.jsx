import React from 'react'

export default function ChatConversationList({ conversations, selectedId, onSelect, isDark, currentUserId }) {
  const getOtherUser = (conv) => {
    if (conv.participant_1 === currentUserId) {
      return conv.p2
    }
    return conv.p1
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now - date

    // 今日中なら時刻のみ
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    }
    // 昨日
    if (diff < 2 * 24 * 60 * 60 * 1000) {
      return '昨日'
    }
    // 今年
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
    }
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const getInitial = (user) => {
    if (!user) return '?'
    if (user.name) return user.name.charAt(0).toUpperCase()
    if (user.email) return user.email.charAt(0).toUpperCase()
    return '?'
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          会話がありません
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv) => {
        const other = getOtherUser(conv)
        const isSelected = conv.id === selectedId
        const hasUnread = conv.unread_count > 0

        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
              isSelected
                ? isDark ? 'bg-gray-700' : 'bg-blue-50'
                : isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'
            } ${isDark ? 'border-b border-gray-700/50' : 'border-b border-gray-100'}`}
          >
            {/* アバター */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
              isDark ? 'bg-gray-600 text-gray-200' : 'bg-blue-100 text-blue-600'
            }`}>
              {other?.avatar_url ? (
                <img src={other.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                getInitial(other)
              )}
            </div>

            {/* コンテンツ */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium truncate ${
                  isDark ? 'text-gray-100' : 'text-gray-900'
                } ${hasUnread ? 'font-bold' : ''}`}>
                  {other?.name || other?.email || '不明'}
                </span>
                <span className={`text-[11px] flex-shrink-0 ml-2 ${
                  isDark ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {formatTime(conv.last_message_at)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className={`text-xs truncate ${
                  hasUnread
                    ? isDark ? 'text-gray-200 font-medium' : 'text-gray-700 font-medium'
                    : isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {conv.last_message_preview || 'メッセージなし'}
                </p>
                {hasUnread && (
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
