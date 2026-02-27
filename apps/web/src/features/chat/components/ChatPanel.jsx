import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../utils/supabase'
import { useChatRealtime } from './useChatRealtime'
import ChatConversationList from './ChatConversationList'
import ChatMessageThread from './ChatMessageThread'
import ChatInput from './ChatInput'

export default function ChatPanel({ isDark, user }) {
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showMobileThread, setShowMobileThread] = useState(false)

  // 新規会話用
  const [showUserPicker, setShowUserPicker] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [userSearchQuery, setUserSearchQuery] = useState('')

  // 会話一覧を取得
  const fetchConversations = useCallback(async () => {
    if (!user?.id) return

    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*, p1:users!chat_conversations_participant_1_fkey(*), p2:users!chat_conversations_participant_2_fkey(*)')
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
      .order('last_message_at', { ascending: false })

    if (error) {
      console.error('Error fetching conversations:', error)
      return
    }

    // 未読数を計算
    const convsWithUnread = await Promise.all(
      (data || []).map(async (conv) => {
        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', user.id)
          .eq('is_read', false)
        return { ...conv, unread_count: count || 0 }
      })
    )

    setConversations(convsWithUnread)
    setLoading(false)
  }, [user?.id])

  // メッセージ一覧を取得
  const fetchMessages = useCallback(async (conversationId) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      return
    }

    setMessages(data || [])

    // 未読メッセージを既読にする
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false)

    // 会話リストの未読数を更新
    setConversations(prev =>
      prev.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c)
    )
  }, [user?.id])

  // リアルタイムメッセージ受信
  const handleNewMessage = useCallback((newMsg, eventType) => {
    if (eventType === 'UPDATE') {
      // 既読更新
      setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...newMsg } : m))
      return
    }

    // 現在開いている会話のメッセージなら追加
    setMessages(prev => {
      if (prev.length > 0 && prev[0]?.conversation_id === newMsg.conversation_id) {
        // 重複チェック
        if (prev.some(m => m.id === newMsg.id)) return prev
        return [...prev, newMsg]
      }
      return prev
    })

    // 自分宛の場合、開いている会話なら既読にする
    if (newMsg.sender_id !== user?.id) {
      setSelectedConversation(current => {
        if (current?.id === newMsg.conversation_id) {
          supabase
            .from('chat_messages')
            .update({ is_read: true })
            .eq('id', newMsg.id)
            .then()
        }
        return current
      })
    }

    // 会話リストのプレビューを更新
    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id === newMsg.conversation_id) {
          return {
            ...c,
            last_message_preview: newMsg.content.substring(0, 50),
            last_message_at: newMsg.created_at,
            unread_count: newMsg.sender_id !== user?.id ? (c.unread_count || 0) + 1 : c.unread_count,
          }
        }
        return c
      })
      // 最新メッセージ順にソート
      return updated.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))
    })
  }, [user?.id])

  useChatRealtime(user?.id, handleNewMessage)

  // 初期読み込み
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // 会話選択時にメッセージ取得
  const handleSelectConversation = useCallback((conv) => {
    setSelectedConversation(conv)
    setShowMobileThread(true)
    fetchMessages(conv.id)
  }, [fetchMessages])

  // メッセージ送信
  const handleSendMessage = useCallback(async (content) => {
    if (!selectedConversation || !user?.id) return

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        content,
        is_read: false,
      })

    if (error) {
      console.error('Error sending message:', error)
      return
    }

    // 会話のlast_messageを更新
    await supabase
      .from('chat_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: content.substring(0, 50),
      })
      .eq('id', selectedConversation.id)
  }, [selectedConversation, user?.id])

  // ユーザー一覧取得（新規会話用）
  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, avatar_url')
      .neq('id', user?.id)
      .order('name')

    if (error) {
      console.error('Error fetching users:', error)
      return
    }
    setAllUsers(data || [])
  }, [user?.id])

  const handleOpenUserPicker = () => {
    setShowUserPicker(true)
    setUserSearchQuery('')
    fetchUsers()
  }

  // 新規会話の開始
  const handleStartConversation = useCallback(async (otherUser) => {
    setShowUserPicker(false)

    // participant_1 < participant_2 の制約を守る
    const p1 = user.id < otherUser.id ? user.id : otherUser.id
    const p2 = user.id < otherUser.id ? otherUser.id : user.id

    // 既存の会話があるかチェック
    const existing = conversations.find(
      c => c.participant_1 === p1 && c.participant_2 === p2
    )

    if (existing) {
      handleSelectConversation(existing)
      return
    }

    // 新規作成
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({ participant_1: p1, participant_2: p2 })
      .select('*, p1:users!chat_conversations_participant_1_fkey(*), p2:users!chat_conversations_participant_2_fkey(*)')
      .single()

    if (error) {
      console.error('Error creating conversation:', error)
      return
    }

    setConversations(prev => [{ ...data, unread_count: 0 }, ...prev])
    handleSelectConversation({ ...data, unread_count: 0 })
  }, [user?.id, conversations, handleSelectConversation])

  const filteredUsers = allUsers.filter(u =>
    (u.name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase())
  )

  const getOtherUserName = (conv) => {
    if (!conv) return ''
    const other = conv.participant_1 === user?.id ? conv.p2 : conv.p1
    return other?.name || other?.email || '不明'
  }

  return (
    <div className={`flex h-full rounded-xl overflow-hidden border ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      {/* 会話リスト（左パネル） */}
      <div className={`w-80 flex-shrink-0 flex flex-col border-r ${
        isDark ? 'border-gray-700' : 'border-gray-200'
      } ${showMobileThread ? 'hidden md:flex' : 'flex'}`}>
        {/* ヘッダー */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h2 className={`text-base font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            チャット
          </h2>
          <button
            onClick={handleOpenUserPicker}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="新しい会話"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* ユーザーピッカードロップダウン */}
        {showUserPicker && (
          <div className={`border-b ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
            <div className="p-2">
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="ユーザーを検索..."
                autoFocus
                className={`w-full px-3 py-1.5 rounded-lg text-sm outline-none ${
                  isDark
                    ? 'bg-gray-700 text-gray-100 placeholder-gray-400'
                    : 'bg-white text-gray-900 placeholder-gray-500 border border-gray-200'
                }`}
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleStartConversation(u)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors ${
                    isDark ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    isDark ? 'bg-gray-600 text-gray-200' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      (u.name || u.email || '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="truncate">
                    <div className="font-medium">{u.name || '名前未設定'}</div>
                    {u.email && <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{u.email}</div>}
                  </div>
                </button>
              ))}
              {filteredUsers.length === 0 && (
                <p className={`text-center text-xs py-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  ユーザーが見つかりません
                </p>
              )}
            </div>
            <div className={`p-1 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setShowUserPicker(false)}
                className={`w-full text-center text-xs py-1 rounded ${
                  isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        {/* 会話リスト */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : (
          <ChatConversationList
            conversations={conversations}
            selectedId={selectedConversation?.id}
            onSelect={handleSelectConversation}
            isDark={isDark}
            currentUserId={user?.id}
          />
        )}
      </div>

      {/* メッセージスレッド（右パネル） */}
      <div className={`flex-1 flex flex-col ${showMobileThread ? 'flex' : 'hidden md:flex'}`}>
        {selectedConversation ? (
          <>
            {/* スレッドヘッダー */}
            <div className={`flex items-center gap-3 px-4 py-3 border-b ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              {/* モバイル戻るボタン */}
              <button
                onClick={() => setShowMobileThread(false)}
                className={`md:hidden w-8 h-8 rounded-full flex items-center justify-center ${
                  isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className={`text-sm font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                {getOtherUserName(selectedConversation)}
              </h3>
            </div>

            <ChatMessageThread
              messages={messages}
              currentUserId={user?.id}
              isDark={isDark}
            />

            <ChatInput
              onSend={handleSendMessage}
              isDark={isDark}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-3">💬</div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                会話を選択してください
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
