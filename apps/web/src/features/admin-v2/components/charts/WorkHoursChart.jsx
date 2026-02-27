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

export default function WorkHoursChart({ data, isDark }) {
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
        部署別 勤務時間
      </h3>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fill: textColor, fontSize: 12 }}
              axisLine={{ stroke: gridColor }}
              tickLine={false}
              unit="h"
            />
            <YAxis
              type="category"
              dataKey="department"
              tick={{ fill: textColor, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                borderRadius: '0.75rem',
                color: isDark ? '#f3f4f6' : '#111827',
              }}
              formatter={(value) => [`${value} 時間`, '勤務時間']}
            />
            <Bar
              dataKey="hours"
              fill="#3b82f6"
              radius={[0, 6, 6, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
