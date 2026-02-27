import React from 'react'

export default function StatCard({ icon, label, value, subValue, trend, isDark }) {
  const getTrendColor = () => {
    if (!trend) return ''
    if (trend > 0) return isDark ? 'text-green-400' : 'text-green-600'
    if (trend < 0) return isDark ? 'text-red-400' : 'text-red-600'
    return isDark ? 'text-gray-400' : 'text-gray-500'
  }

  const getTrendIcon = () => {
    if (!trend) return null
    if (trend > 0) return '\u2191'
    if (trend < 0) return '\u2193'
    return '\u2192'
  }

  return (
    <div
      className={`rounded-2xl border p-5 transition-all ${
        isDark
          ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800/70'
          : 'bg-white border-gray-200 hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
            isDark ? 'bg-gray-700/50' : 'bg-gray-100'
          }`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium truncate ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {label}
          </p>
          <p
            className={`text-2xl font-bold mt-1 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {value}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {subValue && (
              <span
                className={`text-xs ${
                  isDark ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                {subValue}
              </span>
            )}
            {trend != null && (
              <span className={`text-xs font-medium ${getTrendColor()}`}>
                {getTrendIcon()} {Math.abs(trend)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
