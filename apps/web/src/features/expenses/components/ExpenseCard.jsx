import { useState } from 'react'
import { GlassCard, Badge } from '../../../components/ui'

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

export default function ExpenseCard({ expense, isDark }) {
  const [expanded, setExpanded] = useState(false)

  const status = STATUS_MAP[expense.status] || STATUS_MAP.pending
  const categoryLabel = CATEGORY_MAP[expense.category] || expense.category

  return (
    <GlassCard isDark={isDark} padding="p-0" className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-center justify-between gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {expense.title}
            </h4>
            <Badge variant={status.variant} isDark={isDark}>{status.label}</Badge>
          </div>
          <div className={`flex items-center gap-3 mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
              isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
            }`}>
              {categoryLabel}
            </span>
            <span>{new Date(expense.expense_date).toLocaleDateString('ja-JP')}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ¥{(expense.amount ?? 0).toLocaleString('ja-JP')}
          </p>
        </div>
      </button>

      {expanded && (
        <div className={`px-4 pb-4 space-y-3 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
          {expense.description && (
            <div className="pt-3">
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>説明</p>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{expense.description}</p>
            </div>
          )}
          {expense.review_note && (
            <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
              <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>管理者コメント</p>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{expense.review_note}</p>
            </div>
          )}
          {expense.receipt_urls?.length > 0 && (
            <div>
              <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>領収書</p>
              <div className="flex flex-wrap gap-2">
                {expense.receipt_urls.map((url, i) => (
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
        </div>
      )}
    </GlassCard>
  )
}
