import React, { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

export default function AnnouncementsPage({ isDark, onUnreadCountChange }) {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, announcement, event
  const [currentUser, setCurrentUser] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState([])
  const [showFollowUpModal, setShowFollowUpModal] = useState(false)
  const [followUpFormData, setFollowUpFormData] = useState({
    message: '',
    targetType: 'all_participants',
    dateOptionId: null
  })
  const [openMenuId, setOpenMenuId] = useState(null) // 3点メニューの開閉状態
  const [showVotersModal, setShowVotersModal] = useState(false) // 投票者表示モーダル
  const [selectedDateOption, setSelectedDateOption] = useState(null) // 選択された日程候補

  // 投稿作成フォーム
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'announcement',
    event_date: '',
    event_location: '',
    max_participants: '',
    image: null,
    use_date_poll: false, // 日程投票を使うかどうか
    date_options: [], // 日程候補リスト
    link_url: '', // リンクURL
    link_title: '', // リンクタイトル
    voting_deadline: '', // 投票期限
    event_type: 'none', // none, participation, schedule
    participants_only_message: '' // 参加者限定メッセージ
  })
  const [imagePreview, setImagePreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadCurrentUser()
    loadAnnouncements()
  }, [])

  // ページを開いた時に全て既読にする
  useEffect(() => {
    const markAllAsRead = async () => {
      if (!currentUser || announcements.length === 0) return

      try {
        // 既読情報を確認
        const { data: existingReads } = await supabase
          .from('announcement_reads')
          .select('announcement_id')
          .eq('user_id', currentUser.id)

        const readIds = new Set(existingReads?.map(r => r.announcement_id) || [])

        // 未読の投稿を既読にする
        const unreadAnnouncements = announcements.filter(a => !readIds.has(a.id))

        if (unreadAnnouncements.length > 0) {
          const readsToInsert = unreadAnnouncements.map(a => ({
            user_id: currentUser.id,
            announcement_id: a.id
          }))

          await supabase
            .from('announcement_reads')
            .insert(readsToInsert)

          // 未読カウントを0にする
          setUnreadCount(0)
          if (onUnreadCountChange) {
            onUnreadCountChange(0)
          }
        }
      } catch (error) {
        console.error('Error marking announcements as read:', error)
      }
    }

    markAllAsRead()
  }, [currentUser, announcements])

  useEffect(() => {
    if (currentUser) {
      loadUnreadCount()
    }
  }, [currentUser, announcements])

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      setCurrentUser(data)
    }
  }

  const loadAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          author:users!announcements_author_id_fkey (
            id,
            name,
            email
          ),
          participants:announcement_participants (
            id,
            user_id
          ),
          likes:announcement_likes (
            id,
            user_id
          ),
          comments:announcement_comments (
            id
          ),
          date_options:event_date_options (
            id,
            option_date,
            option_label,
            votes:event_date_votes (
              id,
              user_id,
              user:users (
                id,
                name,
                email
              )
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAnnouncements(data || [])
    } catch (error) {
      console.error('Error loading announcements:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUnreadCount = async () => {
    try {
      const { data: reads } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', currentUser.id)

      const readIds = new Set(reads?.map(r => r.announcement_id) || [])
      const unread = announcements.filter(a => !readIds.has(a.id)).length
      setUnreadCount(unread)
      if (onUnreadCountChange) {
        onUnreadCountChange(unread)
      }
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  }

  const handleLike = async (announcementId, e) => {
    e.stopPropagation()
    if (!currentUser) return

    const announcement = announcements.find(a => a.id === announcementId)
    const isLiked = announcement.likes?.some(l => l.user_id === currentUser.id)

    try {
      if (isLiked) {
        // いいね取り消し
        await supabase
          .from('announcement_likes')
          .delete()
          .eq('announcement_id', announcementId)
          .eq('user_id', currentUser.id)
      } else {
        // いいね追加
        await supabase
          .from('announcement_likes')
          .insert({
            announcement_id: announcementId,
            user_id: currentUser.id
          })
      }
      loadAnnouncements()
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }

  const handleJoinEvent = async (announcementId, e) => {
    e.stopPropagation()
    if (!currentUser) return

    try {
      const { error } = await supabase
        .from('announcement_participants')
        .insert({
          announcement_id: announcementId,
          user_id: currentUser.id
        })

      if (error) throw error
      loadAnnouncements()
    } catch (error) {
      console.error('Error joining event:', error)
      alert('参加登録に失敗しました')
    }
  }

  const handleDelete = async (announcementId, e) => {
    e.stopPropagation()

    if (!confirm('この投稿を削除してもよろしいですか？')) {
      return
    }

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId)

      if (error) throw error

      // 削除成功後、リストを再読み込み
      await loadAnnouncements()
      alert('投稿を削除しました')
    } catch (error) {
      console.error('Error deleting announcement:', error)
      alert('削除に失敗しました')
    }
  }

  const handleLeaveEvent = async (announcementId, e) => {
    e.stopPropagation()
    if (!currentUser) return

    try {
      const { error } = await supabase
        .from('announcement_participants')
        .delete()
        .eq('announcement_id', announcementId)
        .eq('user_id', currentUser.id)

      if (error) throw error
      loadAnnouncements()
    } catch (error) {
      console.error('Error leaving event:', error)
      alert('参加キャンセルに失敗しました')
    }
  }

  const handleCommentClick = async (announcement, e) => {
    e.stopPropagation()
    setSelectedAnnouncement(announcement)
    setShowCommentModal(true)
    loadComments(announcement.id)
  }

  const loadComments = async (announcementId) => {
    try {
      const { data, error } = await supabase
        .from('announcement_comments')
        .select(`
          *,
          user:users (
            id,
            name,
            email
          )
        `)
        .eq('announcement_id', announcementId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('Error loading comments:', error)
    }
  }

  const handleCommentSubmit = async (e) => {
    e.preventDefault()
    if (!currentUser || !commentText.trim()) return

    try {
      const { error } = await supabase
        .from('announcement_comments')
        .insert({
          announcement_id: selectedAnnouncement.id,
          user_id: currentUser.id,
          content: commentText
        })

      if (error) throw error

      setCommentText('')
      loadComments(selectedAnnouncement.id)
      loadAnnouncements()
    } catch (error) {
      console.error('Error posting comment:', error)
      alert('コメントの投稿に失敗しました')
    }
  }

  const isUserParticipating = (announcement) => {
    if (!currentUser) return false
    return announcement.participants?.some(p => p.user_id === currentUser.id)
  }

  const isUserLiked = (announcement) => {
    if (!currentUser) return false
    return announcement.likes?.some(l => l.user_id === currentUser.id)
  }

  const isVotingExpired = (announcement) => {
    if (!announcement.voting_deadline) return false
    return new Date(announcement.voting_deadline) < new Date()
  }

  const handleFollowUpClick = (announcement, e) => {
    e.stopPropagation()
    setSelectedAnnouncement(announcement)
    setFollowUpFormData({
      message: '',
      targetType: 'all_participants',
      dateOptionId: null
    })
    setShowFollowUpModal(true)
  }

  const handleFollowUpSubmit = async (e) => {
    e.preventDefault()
    if (!currentUser || !followUpFormData.message.trim()) return

    try {
      const { error } = await supabase
        .from('event_follow_up_messages')
        .insert({
          announcement_id: selectedAnnouncement.id,
          author_id: currentUser.id,
          message: followUpFormData.message,
          target_type: followUpFormData.targetType,
          date_option_id: followUpFormData.dateOptionId
        })

      if (error) throw error

      setShowFollowUpModal(false)
      alert('フォローアップメッセージを送信しました！')
    } catch (error) {
      console.error('Error sending follow-up message:', error)
      alert('メッセージの送信に失敗しました')
    }
  }

  const handleDateVote = async (dateOptionId, e) => {
    e.stopPropagation()
    if (!currentUser) return

    try {
      // 既に投票しているか確認
      const announcement = announcements.find(a => 
        a.date_options?.some(opt => opt.id === dateOptionId)
      )
      const dateOption = announcement?.date_options?.find(opt => opt.id === dateOptionId)
      const hasVoted = dateOption?.votes?.some(v => v.user_id === currentUser.id)

      if (hasVoted) {
        // 投票取り消し
        await supabase
          .from('event_date_votes')
          .delete()
          .eq('date_option_id', dateOptionId)
          .eq('user_id', currentUser.id)
      } else {
        // 投票
        await supabase
          .from('event_date_votes')
          .insert({
            date_option_id: dateOptionId,
            user_id: currentUser.id
          })
        
        // 投票したら自動的に参加者としても登録
        const isParticipant = announcement?.participants?.some(p => p.user_id === currentUser.id)
        if (!isParticipant) {
          await supabase
            .from('announcement_participants')
            .insert({
              announcement_id: announcement.id,
              user_id: currentUser.id
            })
        }
      }

      loadAnnouncements()
    } catch (error) {
      console.error('Error voting:', error)
      alert('投票に失敗しました')
    }
  }

  const addDateOption = () => {
    setFormData({
      ...formData,
      date_options: [...formData.date_options, { date: '', label: '' }]
    })
  }

  const updateDateOption = (index, field, value) => {
    const newOptions = [...formData.date_options]
    newOptions[index][field] = value
    setFormData({ ...formData, date_options: newOptions })
  }

  const removeDateOption = (index) => {
    const newOptions = formData.date_options.filter((_, i) => i !== index)
    setFormData({ ...formData, date_options: newOptions })
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData({ ...formData, image: file })
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!currentUser) return

    setSubmitting(true)
    try {
      let imageUrl = null

      // 画像アップロード
      if (formData.image) {
        const fileExt = formData.image.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('announcements')
          .upload(fileName, formData.image)

        if (uploadError) throw uploadError

        // 公開URLを取得
        const { data: { publicUrl } } = supabase.storage
          .from('announcements')
          .getPublicUrl(fileName)

        imageUrl = publicUrl
      }

      // お知らせ作成
      const { data: newAnnouncement, error } = await supabase
        .from('announcements')
        .insert({
          title: formData.title,
          content: formData.content,
          category: formData.category,
          event_date: formData.use_date_poll ? null : (formData.event_date || null),
          event_location: formData.event_location || null,
          max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
          image_url: imageUrl,
          link_url: formData.link_url || null,
          link_title: formData.link_title || null,
          voting_deadline: formData.voting_deadline || null,
          participants_only_message: formData.category === 'event' && formData.participants_only_message ? formData.participants_only_message : null,
          author_id: currentUser.id
        })
        .select()
        .single()

      if (error) throw error

      // 日程候補を作成（日程投票を使う場合）
      if (formData.use_date_poll && formData.date_options.length > 0) {
        const dateOptionsData = formData.date_options.map(option => ({
          announcement_id: newAnnouncement.id,
          option_date: option.date,
          option_label: option.label || null
        }))

        const { error: optionsError } = await supabase
          .from('event_date_options')
          .insert(dateOptionsData)

        if (optionsError) throw optionsError
      }

      // 成功したらリセット
      setFormData({
        title: '',
        content: '',
        category: 'announcement',
        event_date: '',
        event_location: '',
        max_participants: '',
        image: null,
        use_date_poll: false,
        date_options: [],
        link_url: '',
        link_title: '',
        voting_deadline: '',
        event_type: 'none',
        participants_only_message: ''
      })
      setImagePreview(null)
      setShowCreateModal(false)
      loadAnnouncements()
    } catch (error) {
      console.error('Error creating announcement:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      alert(`投稿の作成に失敗しました: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredAnnouncements = announcements.filter(a => {
    if (filter === 'all') return true
    return a.category === filter
  })

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className={`animate-pulse ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          読み込み中...
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto pb-20">
      {/* ヘッダー */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            タイムライン
          </h1>
          {unreadCount > 0 && (
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500 text-white text-sm font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              {unreadCount}件の新着
            </div>
          )}
        </div>

        {/* 新規投稿ボタン */}
        {currentUser && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl font-medium transition-all duration-200 bg-white text-gray-600 hover:bg-gray-100"
          >
            + 投稿
          </button>
        )}
      </div>

      {/* フィルター（X風タブ） */}
      <div className={`mb-6 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex">
          {[
            { value: 'all', label: 'すべて' },
            { value: 'announcement', label: 'お知らせ' },
            { value: 'event', label: 'イベント' }
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 relative ${
                filter === value
                  ? isDark
                    ? 'text-white'
                    : 'text-gray-900'
                  : isDark
                  ? 'text-gray-500 hover:text-gray-300'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              {filter === value && (
                <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-full ${
                  isDark ? 'bg-white' : 'bg-gray-900'
                }`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 投稿一覧（X風） */}
      <div className="space-y-0">
        {filteredAnnouncements.map((announcement, index) => (
          <div
            key={announcement.id}
            className={`border-b transition-colors hover:bg-opacity-50 ${
              isDark
                ? 'border-gray-800 hover:bg-gray-800'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className="p-4">
              {/* ヘッダー */}
              <div className="flex gap-3">
                <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-bold ${
                  isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600 text-white' : 'bg-gradient-to-br from-gray-800 to-gray-700 text-white'
                }`}>
                  {announcement.author.name?.charAt(0) || announcement.author.email.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  {/* 3点メニュー（投稿者本人または管理者のみ） - 右上に配置 */}
                  {currentUser && (currentUser.id === announcement.author_id || currentUser.role === 'admin') && (
                    <div className="float-right relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === announcement.id ? null : announcement.id)
                        }}
                        className={`p-2 rounded-full transition-colors ${
                          isDark
                            ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                        title="メニュー"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>

                      {/* ドロップダウンメニュー */}
                      {openMenuId === announcement.id && (
                        <>
                          {/* オーバーレイ */}
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuId(null)}
                          />

                          {/* メニュー */}
                          <div className={`absolute right-0 top-10 z-20 w-56 rounded-xl shadow-lg border overflow-hidden ${
                            isDark
                              ? 'bg-gray-900 border-gray-800'
                              : 'bg-white border-gray-200'
                          }`}>
                            {/* フォローアップメッセージ（イベント投稿者のみ） */}
                            {announcement.category === 'event' && currentUser?.id === announcement.author_id && (
                              <button
                                onClick={(e) => {
                                  handleFollowUpClick(announcement, e)
                                  setOpenMenuId(null)
                                }}
                                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                                  isDark
                                    ? 'hover:bg-gray-800 text-gray-300'
                                    : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                                <span>フォローアップメッセージ</span>
                              </button>
                            )}

                            {/* 削除 */}
                            <button
                              onClick={(e) => {
                                handleDelete(announcement.id, e)
                                setOpenMenuId(null)
                              }}
                              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                                isDark
                                  ? 'hover:bg-red-900/20 text-red-400'
                                  : 'hover:bg-red-50 text-red-600'
                              }`}
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>投稿を削除</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {/* 名前と日時 */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {announcement.author.name || announcement.author.email.split('@')[0]}
                    </span>
                    <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {new Date(announcement.created_at).toLocaleString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {announcement.category === 'event' && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                      }`}>
                        イベント
                      </span>
                    )}
                  </div>

                  {/* タイトル */}
                  <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {announcement.title}
                  </h3>

                  {/* 本文 */}
                  <p className={`mb-3 whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {announcement.content}
                  </p>

                  {/* 画像 */}
                  {announcement.image_url && (
                    <div className="mb-3 rounded-2xl overflow-hidden border">
                      <img
                        src={announcement.image_url}
                        alt={announcement.title}
                        className="w-full max-h-96 object-cover"
                      />
                    </div>
                  )}

                  {/* リンクカード */}
                  {announcement.link_url && (
                    <a
                      href={announcement.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mb-3 block p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                        isDark
                          ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                          isDark ? 'bg-gray-700' : 'bg-gray-200'
                        }`}>
                          <svg className={`w-6 h-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          {announcement.link_title && (
                            <div className={`font-bold text-sm mb-1 truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {announcement.link_title}
                            </div>
                          )}
                          <div className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {announcement.link_url}
                          </div>
                        </div>
                        <svg className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                    </a>
                  )}

                  {/* イベント情報 */}
                  {announcement.category === 'event' && (
                    <div className={`mb-3 p-3 rounded-xl ${
                      isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'
                    }`}>
                      {/* 日程投票がある場合 */}
                      {announcement.date_options && announcement.date_options.length > 0 ? (
                        <div className="space-y-2">
                          <div className={`text-sm font-bold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            📅 日程候補（投票してください）
                            {announcement.voting_deadline && (
                              <div className={`text-xs mt-1 ${
                                isVotingExpired(announcement)
                                  ? 'text-red-500 font-bold'
                                  : isDark ? 'text-gray-400' : 'text-gray-600'
                              }`}>
                                ⏰ 投票期限: {new Date(announcement.voting_deadline).toLocaleString('ja-JP', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                                {isVotingExpired(announcement) && ' (終了)'}
                              </div>
                            )}
                          </div>
                          {announcement.date_options.map(option => {
                            const voteCount = option.votes?.length || 0
                            const hasVoted = option.votes?.some(v => v.user_id === currentUser?.id)
                            return (
                              <button
                                key={option.id}
                                onClick={(e) => handleDateVote(option.id, e)}
                                className={`w-full text-left p-3 rounded-lg transition-all ${
                                  hasVoted
                                    ? isDark
                                      ? 'bg-blue-500/20 border-2 border-blue-500'
                                      : 'bg-blue-50 border-2 border-blue-500'
                                    : isDark
                                    ? 'bg-gray-700/50 border border-gray-600 hover:bg-gray-700'
                                    : 'bg-white border border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                      {new Date(option.option_date).toLocaleString('ja-JP', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        weekday: 'short'
                                      })}
                                    </div>
                                    {option.option_label && (
                                      <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {option.option_label}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedDateOption(option)
                                        setShowVotersModal(true)
                                      }}
                                      className={`text-sm font-bold hover:underline cursor-pointer ${
                                        hasVoted
                                          ? 'text-blue-500'
                                          : isDark ? 'text-gray-400' : 'text-gray-600'
                                      }`}
                                    >
                                      {voteCount}票
                                    </button>
                                    {hasVoted && (
                                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <>
                          {/* 確定した日程 */}
                          {announcement.event_date && (
                            <div className="flex items-center gap-2 text-sm mb-1">
                              <span>📅</span>
                              <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                                {new Date(announcement.event_date).toLocaleString('ja-JP', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      {announcement.event_location && (
                        <div className="flex items-center gap-2 text-sm mb-1">
                          <span>📍</span>
                          <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                            {announcement.event_location}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <span>👥</span>
                        <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                          {announcement.participants?.length || 0}
                          {announcement.max_participants && `/${announcement.max_participants}`}人参加
                        </span>
                      </div>
                      {announcement.voting_deadline && (
                        <div className="flex items-center gap-2 text-sm">
                          <span>⏰</span>
                          <span className={`${
                            isVotingExpired(announcement)
                              ? 'text-red-500 font-bold'
                              : isDark ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            投票期限: {new Date(announcement.voting_deadline).toLocaleString('ja-JP', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {isVotingExpired(announcement) && ' (終了)'}
                          </span>
                        </div>
                      )}

                      {/* 参加者限定メッセージ */}
                      {announcement.participants_only_message && isUserParticipating(announcement) && (
                        <div className={`mt-3 p-3 rounded-xl ${
                          isDark ? 'bg-purple-900/30 border border-purple-700/50' : 'bg-purple-50 border border-purple-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm">🔒</span>
                            <span className={`text-xs font-bold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                              参加者限定メッセージ
                            </span>
                          </div>
                          <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-purple-200' : 'text-purple-900'}`}>
                            {announcement.participants_only_message}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* アクション（X風） */}
                  <div className="flex items-center gap-6 mt-3">
                    {/* コメント */}
                    <button
                      onClick={(e) => handleCommentClick(announcement, e)}
                      className={`flex items-center gap-2 text-sm transition-colors group ${
                        isDark ? 'text-gray-500 hover:text-blue-400' : 'text-gray-500 hover:text-blue-600'
                      }`}
                    >
                      <div className={`p-2 rounded-full transition-colors ${
                        isDark ? 'group-hover:bg-blue-400/10' : 'group-hover:bg-blue-50'
                      }`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <span>{announcement.comments?.length || 0}</span>
                    </button>

                    {/* いいね */}
                    <button
                      onClick={(e) => handleLike(announcement.id, e)}
                      className={`flex items-center gap-2 text-sm transition-colors group ${
                        isUserLiked(announcement)
                          ? 'text-red-500'
                          : isDark
                          ? 'text-gray-500 hover:text-red-400'
                          : 'text-gray-500 hover:text-red-600'
                      }`}
                    >
                      <div className={`p-2 rounded-full transition-colors ${
                        isUserLiked(announcement)
                          ? isDark ? 'bg-red-400/10' : 'bg-red-50'
                          : isDark ? 'group-hover:bg-red-400/10' : 'group-hover:bg-red-50'
                      }`}>
                        <svg className={`w-5 h-5 ${isUserLiked(announcement) ? 'fill-current' : ''}`} fill={isUserLiked(announcement) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </div>
                      <span>{announcement.likes?.length || 0}</span>
                    </button>

                    {/* イベント参加ボタン */}
                    {announcement.category === 'event' && currentUser?.id !== announcement.author_id && (
                      <button
                        onClick={(e) => isUserParticipating(announcement)
                          ? handleLeaveEvent(announcement.id, e)
                          : handleJoinEvent(announcement.id, e)
                        }
                        disabled={!isUserParticipating(announcement) && announcement.max_participants && announcement.participants?.length >= announcement.max_participants}
                        className={`ml-auto px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
                          isUserParticipating(announcement)
                            ? isDark
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            : isDark
                            ? 'bg-white text-gray-900 hover:bg-gray-100'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isUserParticipating(announcement) ? '参加中' : '参加する'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredAnnouncements.length === 0 && (
        <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <div className="text-6xl mb-4">📝</div>
          <p>まだ投稿がありません</p>
        </div>
      )}

      {/* 投稿作成モーダル */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border ${
              isDark
                ? 'bg-gray-900/95 border-gray-800/50'
                : 'bg-white/95 border-gray-200/50'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              {/* ヘッダー */}
              <div className={`sticky top-0 z-10 backdrop-blur-xl border-b p-6 ${
                isDark ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'
              }`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    新規投稿
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className={`p-2 rounded-xl transition-colors ${
                      isDark
                        ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                        : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* コンテンツ */}
              <div className="p-6 space-y-4">
                {/* カテゴリー選択 */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    カテゴリー
                  </label>
                  <div className="flex gap-2">
                    {[
                      { value: 'announcement', label: 'お知らせ', emoji: '📢' },
                      { value: 'event', label: 'イベント', emoji: '🎉' }
                    ].map(({ value, label, emoji }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: value })}
                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                          formData.category === value
                            ? isDark
                              ? 'bg-white text-gray-900'
                              : 'bg-gray-900 text-white'
                            : isDark
                            ? 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
                            : 'bg-gray-100/50 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        }`}
                      >
                        {emoji} {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 画像アップロード */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    画像（任意）
                  </label>
                  <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    isDark
                      ? 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
                      : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                  }`}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-xl" />
                      ) : (
                        <>
                          <div className="text-4xl mb-2">📷</div>
                          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            クリックして画像を選択
                          </div>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {/* タイトル */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    タイトル <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl transition-colors ${
                      isDark
                        ? 'bg-gray-800 text-white border border-gray-700 focus:border-white'
                        : 'bg-white text-gray-900 border border-gray-300 focus:border-gray-900'
                    } focus:outline-none`}
                    placeholder="タイトルを入力"
                  />
                </div>

                {/* 本文 */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    本文 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={6}
                    className={`w-full px-4 py-3 rounded-xl transition-colors ${
                      isDark
                        ? 'bg-gray-800 text-white border border-gray-700 focus:border-white'
                        : 'bg-white text-gray-900 border border-gray-300 focus:border-gray-900'
                    } focus:outline-none resize-none`}
                    placeholder="本文を入力"
                  />
                </div>

                {/* リンク */}
                <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      リンク（任意）
                    </label>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="url"
                      value={formData.link_url}
                      onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl transition-colors ${
                        isDark
                          ? 'bg-gray-800 text-white border border-gray-700 focus:border-white'
                          : 'bg-white text-gray-900 border border-gray-300 focus:border-gray-900'
                      } focus:outline-none`}
                      placeholder="https://example.com"
                    />
                    <input
                      type="text"
                      value={formData.link_title}
                      onChange={(e) => setFormData({ ...formData, link_title: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl transition-colors ${
                        isDark
                          ? 'bg-gray-800 text-white border border-gray-700 focus:border-white'
                          : 'bg-white text-gray-900 border border-gray-300 focus:border-gray-900'
                      } focus:outline-none`}
                      placeholder="リンクタイトル（任意）"
                    />
                  </div>
                </div>

                {/* イベント情報（イベントの場合のみ） */}
                {formData.category === 'event' && (
                  <div className={`space-y-4 p-4 rounded-xl ${
                    isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'
                  }`}>
                    <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      イベント情報
                    </h3>

                    {/* 日程投票トグル */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="use_date_poll"
                        checked={formData.use_date_poll}
                        onChange={(e) => setFormData({ ...formData, use_date_poll: e.target.checked, event_date: '' })}
                        className="w-5 h-5 rounded"
                      />
                      <label htmlFor="use_date_poll" className={`text-sm font-medium cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        📊 日程を投票で決める
                      </label>
                    </div>

                    {/* 投票期限（日程投票を使う場合） */}
                    {formData.use_date_poll && (
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          投票期限
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.voting_deadline}
                          onChange={(e) => setFormData({ ...formData, voting_deadline: e.target.value })}
                          className={`w-full px-4 py-3 rounded-xl transition-colors ${
                            isDark
                              ? 'bg-gray-800 text-white border border-gray-700 focus:border-white'
                              : 'bg-white text-gray-900 border border-gray-300 focus:border-gray-900'
                          } focus:outline-none`}
                          placeholder="投票期限を設定（任意）"
                        />
                      </div>
                    )}

                    {/* 日程候補（投票を使う場合） */}
                    {formData.use_date_poll ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            日程候補
                          </label>
                          <button
                            type="button"
                            onClick={addDateOption}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                              isDark
                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            + 候補を追加
                          </button>
                        </div>
                        {formData.date_options.map((option, index) => (
                          <div key={index} className={`p-3 rounded-lg space-y-2 ${
                            isDark ? 'bg-gray-700/50' : 'bg-white/50'
                          }`}>
                            <div className="flex gap-2">
                              <input
                                type="datetime-local"
                                value={option.date}
                                onChange={(e) => updateDateOption(index, 'date', e.target.value)}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                                  isDark
                                    ? 'bg-gray-800 text-white border border-gray-700 focus:border-white'
                                    : 'bg-white text-gray-900 border border-gray-300 focus:border-gray-900'
                                } focus:outline-none`}
                                required
                              />
                              <button
                                type="button"
                                onClick={() => removeDateOption(index)}
                                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                                  isDark
                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                                }`}
                              >
                                削除
                              </button>
                            </div>
                            <input
                              type="text"
                              value={option.label}
                              onChange={(e) => updateDateOption(index, 'label', e.target.value)}
                              placeholder="ラベル（任意）例: 午前の部"
                              className={`w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                                isDark
                                  ? 'bg-gray-800 text-white border border-gray-700 focus:border-white'
                                  : 'bg-white text-gray-900 border border-gray-300 focus:border-gray-900'
                              } focus:outline-none`}
                            />
                          </div>
                        ))}
                        {formData.date_options.length === 0 && (
                          <div className={`text-sm text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            「+ 候補を追加」ボタンから日程候補を追加してください
                          </div>
                        )}
                      </div>
                    ) : (
                      /* 確定した日時 */
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          開催日時
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.event_date}
                          onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                          className={`w-full px-4 py-3 rounded-xl transition-colors ${
                            isDark
                              ? 'bg-gray-800 text-white border border-gray-700 focus:border-white'
                              : 'bg-white text-gray-900 border border-gray-300 focus:border-gray-900'
                          } focus:outline-none`}
                        />
                      </div>
                    )}

                    {/* 場所 */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        場所
                      </label>
                      <input
                        type="text"
                        value={formData.event_location}
                        onChange={(e) => setFormData({ ...formData, event_location: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl transition-colors ${
                          isDark
                            ? 'bg-gray-800 text-white border border-gray-700 focus:border-white'
                            : 'bg-white text-gray-900 border border-gray-300 focus:border-gray-900'
                        } focus:outline-none`}
                        placeholder="開催場所を入力"
                      />
                    </div>

                    {/* 定員 */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        定員
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.max_participants}
                        onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl transition-colors ${
                          isDark
                            ? 'bg-gray-800 text-white border border-gray-700 focus:border-white'
                            : 'bg-white text-gray-900 border border-gray-300 focus:border-gray-900'
                        } focus:outline-none`}
                        placeholder="定員を入力（任意）"
                      />
                    </div>

                    {/* 参加者限定メッセージ */}
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-purple-900/20 border border-purple-700/30' : 'bg-purple-50 border border-purple-200'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🔒</span>
                        <label className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                          参加者限定メッセージ（任意）
                        </label>
                      </div>
                      <p className={`text-xs mb-3 ${isDark ? 'text-purple-400/70' : 'text-purple-600/70'}`}>
                        参加登録したユーザーのみが閲覧できるシークレットメッセージです
                      </p>
                      <textarea
                        value={formData.participants_only_message}
                        onChange={(e) => setFormData({ ...formData, participants_only_message: e.target.value })}
                        rows={3}
                        className={`w-full px-4 py-3 rounded-xl transition-colors ${
                          isDark
                            ? 'bg-gray-800 text-white border border-gray-700 focus:border-purple-500'
                            : 'bg-white text-gray-900 border border-gray-300 focus:border-purple-500'
                        } focus:outline-none resize-none`}
                        placeholder="例: 当日は会議室Aに10分前集合でお願いします"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* フッター */}
              <div className={`sticky bottom-0 backdrop-blur-xl border-t p-6 flex gap-3 ${
                isDark ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'
              }`}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all duration-200 ${
                    isDark
                      ? 'bg-white text-gray-900 hover:bg-gray-100'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {submitting ? '投稿中...' : '投稿する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* コメントモーダル */}
      {showCommentModal && selectedAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCommentModal(false)}
        >
          <div
            className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border ${
              isDark
                ? 'bg-gray-900/95 border-gray-800/50'
                : 'bg-white/95 border-gray-200/50'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className={`sticky top-0 z-10 backdrop-blur-xl border-b p-6 ${
              isDark ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'
            }`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  コメント
                </h2>
                <button
                  onClick={() => setShowCommentModal(false)}
                  className={`p-2 rounded-xl transition-colors ${
                    isDark
                      ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 元の投稿 */}
            <div className={`p-6 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="flex gap-3">
                <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-bold ${
                  isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600 text-white' : 'bg-gradient-to-br from-gray-800 to-gray-700 text-white'
                }`}>
                  {selectedAnnouncement.author.name?.charAt(0) || selectedAnnouncement.author.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {selectedAnnouncement.author.name || selectedAnnouncement.author.email.split('@')[0]}
                  </div>
                  <h3 className={`text-lg font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {selectedAnnouncement.title}
                  </h3>
                  <p className={`mt-2 whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {selectedAnnouncement.content}
                  </p>
                </div>
              </div>
            </div>

            {/* コメント一覧 */}
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${
                      isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600 text-white' : 'bg-gradient-to-br from-gray-800 to-gray-700 text-white'
                    }`}>
                      {comment.user.name?.charAt(0) || comment.user.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {comment.user.name || comment.user.email.split('@')[0]}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {new Date(comment.created_at).toLocaleString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <p className="text-sm">まだコメントがありません</p>
                </div>
              )}
            </div>

            {/* コメント入力 */}
            <div className={`sticky bottom-0 backdrop-blur-xl border-t p-6 ${
              isDark ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'
            }`}>
              <form onSubmit={handleCommentSubmit} className="flex gap-3">
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${
                  isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600 text-white' : 'bg-gradient-to-br from-gray-800 to-gray-700 text-white'
                }`}>
                  {currentUser?.name?.charAt(0) || currentUser?.email.charAt(0).toUpperCase()}
                </div>
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="コメントを入力"
                  className={`flex-1 px-4 py-2 rounded-full transition-colors ${
                    isDark
                      ? 'bg-gray-800 text-white border border-gray-700 focus:border-white'
                      : 'bg-gray-100 text-gray-900 border border-gray-300 focus:border-gray-900'
                  } focus:outline-none`}
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className={`px-6 py-2 rounded-full font-bold transition-all duration-200 ${
                    isDark
                      ? 'bg-white text-gray-900 hover:bg-gray-100'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  送信
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* フォローアップメッセージモーダル */}
      {showFollowUpModal && selectedAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowFollowUpModal(false)}
        >
          <div
            className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border ${
              isDark
                ? 'bg-gray-900/95 border-gray-800/50'
                : 'bg-white/95 border-gray-200/50'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleFollowUpSubmit}>
              {/* ヘッダー */}
              <div className={`sticky top-0 z-10 backdrop-blur-xl border-b p-6 ${
                isDark ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      フォローアップメッセージ
                    </h2>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedAnnouncement.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFollowUpModal(false)}
                    className={`p-2 rounded-xl transition-colors ${
                      isDark
                        ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                        : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* コンテンツ */}
              <div className="p-6 space-y-4">
                {/* ターゲット選択 */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    送信先
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        value="all_participants"
                        checked={followUpFormData.targetType === 'all_participants'}
                        onChange={(e) => setFollowUpFormData({ ...followUpFormData, targetType: e.target.value, dateOptionId: null })}
                        className="w-4 h-4"
                      />
                      <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                        全参加者
                      </span>
                    </label>

                    {selectedAnnouncement.date_options && selectedAnnouncement.date_options.length > 0 && (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          value="date_option_voters"
                          checked={followUpFormData.targetType === 'date_option_voters'}
                          onChange={(e) => setFollowUpFormData({ ...followUpFormData, targetType: e.target.value })}
                          className="w-4 h-4"
                        />
                        <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                          特定の日程に投票した人のみ
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                {/* 日程選択（特定日程を選んだ場合のみ） */}
                {followUpFormData.targetType === 'date_option_voters' && selectedAnnouncement.date_options && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      日程を選択
                    </label>
                    <select
                      value={followUpFormData.dateOptionId || ''}
                      onChange={(e) => setFollowUpFormData({ ...followUpFormData, dateOptionId: e.target.value })}
                      required
                      className={`w-full px-4 py-3 rounded-xl transition-colors ${
                        isDark
                          ? 'bg-gray-800 text-white border border-gray-700 focus:border-white'
                          : 'bg-white text-gray-900 border border-gray-300 focus:border-gray-900'
                      } focus:outline-none`}
                    >
                      <option value="">日程を選択してください</option>
                      {selectedAnnouncement.date_options.map(option => (
                        <option key={option.id} value={option.id}>
                          {new Date(option.option_date).toLocaleString('ja-JP', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            weekday: 'short'
                          })}
                          {option.option_label && ` - ${option.option_label}`}
                          ({option.votes?.length || 0}票)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* メッセージ入力 */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    メッセージ <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    value={followUpFormData.message}
                    onChange={(e) => setFollowUpFormData({ ...followUpFormData, message: e.target.value })}
                    rows={6}
                    className={`w-full px-4 py-3 rounded-xl transition-colors ${
                      isDark
                        ? 'bg-gray-800 text-white border border-gray-700 focus:border-white'
                        : 'bg-white text-gray-900 border border-gray-300 focus:border-gray-900'
                    } focus:outline-none resize-none`}
                    placeholder="参加者へのメッセージを入力してください"
                  />
                </div>
              </div>

              {/* フッター */}
              <div className={`sticky bottom-0 backdrop-blur-xl border-t p-6 flex gap-3 ${
                isDark ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'
              }`}>
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all duration-200 ${
                    isDark
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
                  }`}
                >
                  送信する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 投票者表示モーダル */}
      {showVotersModal && selectedDateOption && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setShowVotersModal(false)}>
          <div className={`rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto ${
            isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white'
          }`}
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                投票者一覧
              </h3>
              <button
                onClick={() => setShowVotersModal(false)}
                className={`p-2 rounded-lg hover:bg-gray-100 ${
                  isDark ? 'hover:bg-gray-800 text-gray-400' : 'text-gray-600'
                }`}
              >
                ✕
              </button>
            </div>

            <div className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <div className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {new Date(selectedDateOption.option_date).toLocaleString('ja-JP', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  weekday: 'short'
                })}
              </div>
              {selectedDateOption.option_label && (
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {selectedDateOption.option_label}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {selectedDateOption.votes && selectedDateOption.votes.length > 0 ? (
                selectedDateOption.votes.map((vote, index) => (
                  <div
                    key={vote.id}
                    className={`p-3 rounded-lg flex items-center gap-3 ${
                      isDark ? 'bg-gray-800' : 'bg-gray-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {vote.user?.name || 'ユーザー'}
                      </div>
                      <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {vote.user?.email || ''}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  まだ投票はありません
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
