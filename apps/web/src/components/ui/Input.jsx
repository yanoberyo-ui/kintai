export default function Input({
  label,
  error,
  isDark,
  id,
  className = '',
  ...props
}) {
  const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined)

  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-sm font-medium mb-2 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-4 py-3 rounded-button border transition-colors outline-none font-light focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
          isDark
            ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600 placeholder-gray-500'
            : 'bg-gray-50/50 border-gray-200 text-gray-900 focus:border-gray-400 placeholder-gray-400'
        } ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className={`mt-1 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
          {error}
        </p>
      )}
    </div>
  )
}
