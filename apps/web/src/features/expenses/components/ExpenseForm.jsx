import { useState } from 'react'
import { supabase } from '../../../utils/supabase'
import { Modal, Button, Input } from '../../../components/ui'
import ExpenseReceiptUpload from './ExpenseReceiptUpload'

const CATEGORIES = [
  { value: 'transportation', label: '交通費' },
  { value: 'meals', label: '食事' },
  { value: 'supplies', label: '消耗品' },
  { value: 'equipment', label: '設備' },
  { value: 'communication', label: '通信費' },
  { value: 'entertainment', label: '接待費' },
  { value: 'travel', label: '出張費' },
  { value: 'other', label: 'その他' },
]

export default function ExpenseForm({ isDark, user, onClose, onSubmit }) {
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: 'transportation',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    receipt_urls: [],
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title = 'タイトルは必須です'
    if (!form.amount || Number(form.amount) <= 0) e.amount = '金額を入力してください'
    if (!form.expense_date) e.expense_date = '日付は必須です'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('expense_claims').insert({
        user_id: user.id,
        title: form.title.trim(),
        amount: Number(form.amount),
        category: form.category,
        expense_date: form.expense_date,
        description: form.description.trim() || null,
        receipt_urls: form.receipt_urls.length > 0 ? form.receipt_urls : null,
        status: 'pending',
      })
      if (error) throw error
      onSubmit?.()
    } catch (error) {
      console.error('Error submitting expense:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <Modal isOpen onClose={onClose} isDark={isDark} className="max-w-lg">
      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-4">
          <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            新規経費申請
          </h2>

          <Input
            label="タイトル"
            isDark={isDark}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="例: 交通費（出張）"
            error={errors.title}
          />

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              金額 (¥)
            </label>
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              placeholder="0"
              className={`w-full px-4 py-3 rounded-button border transition-colors outline-none font-light focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                isDark
                  ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500'
                  : 'bg-gray-50/50 border-gray-200 text-gray-900 placeholder-gray-400'
              } ${errors.amount ? 'border-red-500' : ''}`}
            />
            {errors.amount && (
              <p className={`mt-1 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{errors.amount}</p>
            )}
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              カテゴリ
            </label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className={`w-full px-4 py-3 rounded-button border transition-colors outline-none appearance-none ${
                isDark
                  ? 'bg-gray-800/50 border-gray-700 text-white'
                  : 'bg-gray-50/50 border-gray-200 text-gray-900'
              }`}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <Input
            label="日付"
            type="date"
            isDark={isDark}
            value={form.expense_date}
            onChange={(e) => set('expense_date', e.target.value)}
            error={errors.expense_date}
          />

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              説明
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="詳細を入力..."
              className={`w-full px-4 py-3 rounded-button border transition-colors outline-none font-light resize-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                isDark
                  ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500'
                  : 'bg-gray-50/50 border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>

          <ExpenseReceiptUpload
            urls={form.receipt_urls}
            onChange={(urls) => set('receipt_urls', urls)}
            isDark={isDark}
            userId={user.id}
          />
        </div>

        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${
          isDark ? 'border-gray-700/50' : 'border-gray-200'
        }`}>
          <Button type="button" variant="secondary" isDark={isDark} onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" isDark={isDark} disabled={submitting}>
            {submitting ? '送信中...' : '申請する'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
