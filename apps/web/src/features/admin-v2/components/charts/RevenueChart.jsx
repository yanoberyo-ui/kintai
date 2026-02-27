import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const formatYen = (value) => {
  if (value >= 10000) return `\u00a5${(value / 10000).toFixed(0)}万`
  return `\u00a5${value.toLocaleString()}`
}

export default function RevenueChart({ data, isDark }) {
  const textColor = isDark ? '#9ca3af' : '#6b7280'
  const gridColor = isDark ? '#374151' : '#e5e7eb'

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
        部署別 売上
      </h3>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={false}
            />
            <XAxis
              dataKey="department"
              tick={{ fill: textColor, fontSize: 12 }}
              axisLine={{ stroke: gridColor }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: textColor, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatYen}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                borderRadius: '0.75rem',
                color: isDark ? '#f3f4f6' : '#111827',
              }}
              formatter={(value) => [
                `\u00a5${value.toLocaleString()}`,
                '売上',
              ]}
            />
            <Bar
              dataKey="revenue"
              fill="#3b82f6"
              radius={[6, 6, 0, 0]}
              barSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
