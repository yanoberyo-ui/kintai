import React from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const CATEGORY_COLORS = {
  transportation: '#3b82f6',
  meals: '#22c55e',
  supplies: '#f97316',
  communication: '#a855f7',
  entertainment: '#ec4899',
  travel: '#14b8a6',
  equipment: '#eab308',
  other: '#6b7280',
}

const DEFAULT_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f97316',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#eab308',
  '#6b7280',
]

const getColor = (category, index) => {
  const key = category?.toLowerCase().replace(/\s+/g, '')
  return CATEGORY_COLORS[key] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
}

const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}) => {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function ExpenseSummaryChart({ data, isDark }) {
  const textColor = isDark ? '#d1d5db' : '#374151'

  return (
    <div
      className={`rounded-2xl border p-5 ${
        isDark
          ? 'bg-gray-800/50 border-gray-700'
          : 'bg-white border-gray-200'
      }`}
    >
      <h3
        className={`text-sm font-medium mb-4 ${
          isDark ? 'text-gray-400' : 'text-gray-500'
        }`}
      >
        経費カテゴリ別 内訳
      </h3>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="category"
              cx="50%"
              cy="50%"
              outerRadius={90}
              labelLine={false}
              label={renderCustomLabel}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getColor(entry.category, index)}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                borderRadius: '0.75rem',
                color: isDark ? '#f3f4f6' : '#111827',
              }}
              formatter={(value) => [
                `\u00a5${value.toLocaleString()}`,
                '金額',
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: textColor }}
              iconType="circle"
              iconSize={8}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
