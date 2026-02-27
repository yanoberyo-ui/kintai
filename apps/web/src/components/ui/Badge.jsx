const variantStyles = {
  default: (isDark) => isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600',
  success: (isDark) => isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-700',
  danger: (isDark) => isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-700',
  warning: (isDark) => isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700',
  info: (isDark) => isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700',
}

export default function Badge({ children, variant = 'default', isDark, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-badge text-xs font-medium ${variantStyles[variant](isDark)} ${className}`}>
      {children}
    </span>
  )
}
