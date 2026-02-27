import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export default function AttendanceTrendChart({ data, isDark }) {
  const textColor = isDark ? '#9ca3af' : '#6b7280'
  const gridColor = isDark ? '#374151' : '#e5e7eb'
  const gradientId = 'attendanceGradient'
  const strokeColor = isDark ? '#a78bfa' : '#3b82f6'
  const gradientStart = isDark ? '#a78bfa' : '#3b82f6'
  const gradientEnd = isDark ? 'rgba(167,139,250,0.05)' : 'rgba(59,130,246,0.05)'

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
        月別 出勤推移
      </h3>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 5, right: 20, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradientStart} stopOpacity={0.3} />
                <stop offset="100%" stopColor={gradientEnd} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: textColor, fontSize: 12 }}
              axisLine={{ stroke: gridColor }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: textColor, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              unit="人"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                borderRadius: '0.75rem',
                color: isDark ? '#f3f4f6' : '#111827',
              }}
              formatter={(value) => [`${value} 人`, '出勤数']}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
