import { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'
import { GlassCard, Badge, Button } from '../../../components/ui'

const CATEGORY_MAP = {
  transportation: '交通費',
  meals: '食事',
  supplies: '消耗品',
  equipment: '設備',
  communication: '通信費',
  entertainment: '接待費',
  travel: '出張費',
  other: 'その他',
}

const STATUS_MAP = {
  pending: { label: '申請中', variant: 'warning' },
  approved: { label: '承認済み', variant: 'success' },
  rejected: { label: '却下', variant: 'danger' },
  paid: { label: '支払済み', variant: 'info' },
}

const FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'pending', label: '申請中' },
  { key: 'approved', label: '承認済み' },
  { key: 'rejected', label: '却下' },
  { key: 'paid', label: '支払済み' },
]

export default function ExpenseManagement({ isDark }) {
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [reviewNotes, setReviewNotes] = useState({})
  const [processing, setProcessing] = useState({})
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    loadClaims()
  }, [])

  const loadClaims = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('expense_claims')
        .select('*, users(full_name, email)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setClaims(data || [])
    } catch (error) {
      console.error('Error loading expense claims:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (claimId, action) => {
    setProcessing((prev) => ({ ...prev, [claimId]: true }))
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const update = {
        status: action,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }
      if (action === 'rejected' && reviewNotes[claimId]) {
        update.review_note = reviewNotes[claimId]
      }
      if (action === 'approved' && reviewNotes[claimId]) {
        update.review_note = reviewNotes[claimId]
      }

      const { error } = await supabase
        .from('expense_claims')
        .update(update)
        .eq('id', claimId)

      if (error) throw error
      await loadClaims()
      setReviewNotes((prev) => ({ ...prev, [claimId]: '' }))
    } catch (error) {
      console.error('Error updating claim:', error)
    } finally {
      setProcessing((prev) => ({ ...prev, [claimId]: false }))
    }
  }

  const filtered = filter === 'all' ? claims : claims.filter((c) => c.status === filter)
  // Sort pending first
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return 0
  })

  const pendingClaims = claims.filter((c) => c.status === 'pending')
  const pendingCount = pendingClaims.length
  const pendingTotal = pendingClaims.reduce((sum, c) => sum + (c.amount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassCard isDark={isDark}>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>未処理の申請</p>
          <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{pendingCount}件</p>
        </GlassCard>
        <GlassCard isDark={isDark}>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>未処理の合計金額</p>
          <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>¥{pendingTotal.toLocaleString('ja-JP')}</p>
        </GlassCard>
      </div>

      {/* Filter tabs */}
      <GlassCard isDark={isDark} padding="p-2">
        <div className="flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                  : isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800/50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Claims list */}
      {loading ? (
        <GlassCard isDark={isDark}>
          <div className="flex items-center justify-center py-12">
            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDark ? 'border-white' : 'border-gray-900'}`} />
          </div>
        </GlassCard>
      ) : sorted.length === 0 ? (
        <GlassCard isDark={isDark}>
          <div className="text-center py-12">
            <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>該当する経費申請はありません</p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {sorted.map((claim) => {
            const status = STATUS_MAP[claim.status] || STATUS_MAP.pending
            const isExpanded = expandedId === claim.id
            return (
              <GlassCard key={claim.id} isDark={isDark} padding="p-0">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : claim.id)}
                  className="w-full text-left p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {claim.title}
                      </h4>
                      <Badge variant={status.variant} isDark={isDark}>{status.label}</Badge>
                    </div>
                    <div className={`flex items-center gap-3 mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <span>{claim.users?.full_name || claim.users?.email || '不明'}</span>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                        isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {CATEGORY_MAP[claim.category] || claim.category}
                      </span>
                      <span>{new Date(claim.expense_date).toLocaleDateString('ja-JP')}</span>
                    </div>
                  </div>
                  <p className={`text-lg font-bold flex-shrink-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ¥{(claim.amount ?? 0).toLocaleString('ja-JP')}
                  </p>
                </button>

                {isExpanded && (
                  <div className={`px-4 pb-4 space-y-3 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                    {claim.description && (
                      <div className="pt-3">
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>説明</p>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{claim.description}</p>
                      </div>
                    )}

                    {claim.receipt_urls?.length > 0 && (
                      <div>
                        <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>領収書</p>
                        <div className="flex flex-wrap gap-2">
                          {claim.receipt_urls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              {url.endsWith('.pdf') ? (
                                <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-xs font-medium ${
                                  isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                                }`}>PDF</div>
                              ) : (
                                <img src={url} alt={`receipt-${i}`} className="w-16 h-16 rounded-lg object-cover" />
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {claim.review_note && (
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                        <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>レビューコメント</p>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{claim.review_note}</p>
                      </div>
                    )}

                    {claim.status === 'pending' && (
                      <div className={`pt-3 space-y-3 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                        <textarea
                          value={reviewNotes[claim.id] || ''}
                          onChange={(e) => setReviewNotes((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                          placeholder="コメント（任意）"
                          rows={2}
                          className={`w-full px-3 py-2 rounded-lg border transition-colors outline-none text-sm resize-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            isDark
                              ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500'
                              : 'bg-gray-50/50 border-gray-200 text-gray-900 placeholder-gray-400'
                          }`}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="blue"
                            size="sm"
                            isDark={isDark}
                            disabled={processing[claim.id]}
                            onClick={() => handleAction(claim.id, 'approved')}
                          >
                            承認
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            isDark={isDark}
                            disabled={processing[claim.id]}
                            onClick={() => handleAction(claim.id, 'rejected')}
                          >
                            却下
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
