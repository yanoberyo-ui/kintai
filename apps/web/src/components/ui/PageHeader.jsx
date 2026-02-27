export default function PageHeader({ title, subtitle, isDark, action }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className={`text-page-title ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h1>
        {subtitle && (
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
