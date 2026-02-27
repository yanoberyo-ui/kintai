import { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'
import { GlassCard, PageHeader, Button } from '../../../components/ui'
import ExpenseForm from './ExpenseForm'
import ExpenseCard from './ExpenseCard'

const FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'pending', label: '申請中' },
  { key: 'approved', label: '承認済み' },
  { key: 'rejected', label: '却下' },
  { key: 'paid', label: '支払済み' },
]

export default function ExpensesPage({ isDark, user }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadExpenses()
  }, [user])

  const loadExpenses = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('expense_claims')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setExpenses(data || [])
    } catch (error) {
      console.error('Error loading expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const filtered = filter === 'all' ? expenses : expenses.filter((e) => e.status === filter)

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <PageHeader
        title="🧾 経費申請"
        isDark={isDark}
        action={
          <Button isDark={isDark} onClick={() => setShowForm(true)}>
            新規申請
          </Button>
        }
      />

      {/* Filter tabs */}
      <GlassCard isDark={isDark} padding="p-2">
        <div className="flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                    ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* List */}
      {loading ? (
        <GlassCard isDark={isDark}>
          <div className="flex items-center justify-center py-12">
            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDark ? 'border-white' : 'border-gray-900'}`} />
          </div>
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard isDark={isDark}>
          <div className="text-center py-12">
            <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {filter === 'all' ? '経費申請はまだありません' : '該当する申請はありません'}
            </p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((expense) => (
            <ExpenseCard key={expense.id} expense={expense} isDark={isDark} />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <ExpenseForm
          isDark={isDark}
          user={user}
          onClose={() => setShowForm(false)}
          onSubmit={() => {
            setShowForm(false)
            loadExpenses()
          }}
        />
      )}
    </div>
  )
}
