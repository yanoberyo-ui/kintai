import React from 'react'
import ChatPanel from '../../chat/components/ChatPanel'

export default function AdminChat({ isDark, user }) {
  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
      <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <h3 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>管理者チャット</h3>
      </div>
      <div style={{ height: '600px' }}>
        <ChatPanel isDark={isDark} user={user} />
      </div>
    </div>
  )
}
