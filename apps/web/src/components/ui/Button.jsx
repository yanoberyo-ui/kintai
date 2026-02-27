const variants = {
  primary: {
    dark: 'bg-white text-gray-900 hover:bg-gray-100 shadow-white/20',
    light: 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-900/20',
  },
  secondary: {
    dark: 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white',
    light: 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900',
  },
  danger: {
    dark: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
    light: 'bg-red-50 text-red-600 hover:bg-red-100',
  },
  ghost: {
    dark: 'text-gray-400 hover:text-white hover:bg-gray-800/50',
    light: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50',
  },
  blue: {
    dark: 'bg-blue-600 text-white hover:bg-blue-700',
    light: 'bg-blue-500 text-white hover:bg-blue-600',
  },
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2.5 rounded-button font-medium',
  lg: 'px-6 py-3 rounded-button font-medium shadow-lg',
  full: 'w-full py-3 rounded-button font-medium shadow-lg',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isDark,
  disabled = false,
  className = '',
  ...props
}) {
  const mode = isDark ? 'dark' : 'light'
  return (
    <button
      disabled={disabled}
      className={`transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 outline-none ${variants[variant][mode]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
