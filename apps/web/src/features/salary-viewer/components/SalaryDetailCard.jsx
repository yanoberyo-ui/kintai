import { Badge, GlassCard } from '../../../components/ui'

export default function SalaryDetailCard({ salary, isDark }) {
  const fmt = (num) => (num ?? 0).toLocaleString('ja-JP')

  const statusVariant = salary.payment_status === 'paid' ? 'success' : 'warning'
  const statusLabel = salary.payment_status === 'paid' ? '支払済み' : '未払い'

  const rows = [
    { label: '基本給', value: `¥${fmt(salary.base_salary)}` },
    { label: '残業代', value: `¥${fmt(salary.overtime_pay)}`, sub: salary.overtime_hours ? `(${salary.overtime_hours}時間)` : null },
    { label: '手当', value: `¥${fmt(salary.bonuses)}` },
    { label: '控除', value: `- ¥${fmt(salary.deductions)}`, danger: true },
  ]

  return (
    <GlassCard isDark={isDark} className="divide-y divide-gray-200 dark:divide-gray-700/50" padding="p-0">
      {/* Header */}
      <div className="p-6 flex items-center justify-between">
        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {salary.year}年{salary.month}月 給与明細
        </h3>
        <Badge variant={statusVariant} isDark={isDark}>{statusLabel}</Badge>
      </div>

      {/* Detail rows */}
      {rows.map((row) => (
        <div key={row.label} className="px-6 py-4 flex items-center justify-between">
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{row.label}</span>
          <span className={`font-medium ${row.danger ? (isDark ? 'text-red-400' : 'text-red-600') : (isDark ? 'text-white' : 'text-gray-900')}`}>
            {row.value}
            {row.sub && <span className={`ml-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{row.sub}</span>}
          </span>
        </div>
      ))}

      {/* Total */}
      <div className="px-6 py-5 flex items-center justify-between">
        <span className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>合計</span>
        <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          ¥{fmt(salary.total_salary)}
        </span>
      </div>

      {/* Payment date */}
      {salary.payment_date && (
        <div className="px-6 py-4 flex items-center justify-between">
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>支払日</span>
          <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {new Date(salary.payment_date).toLocaleDateString('ja-JP')}
          </span>
        </div>
      )}
    </GlassCard>
  )
}
