export default function GlassCard({
  children,
  isDark,
  className = '',
  padding = 'p-6',
  shadow = 'shadow-card-light',
  ...props
}) {
  return (
    <div
      className={`backdrop-blur-xl rounded-card border transition-colors duration-500 ${padding} ${
        isDark
          ? `bg-surface-dark border-border-dark shadow-card-dark`
          : `bg-surface-light border-border-light ${shadow}`
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
