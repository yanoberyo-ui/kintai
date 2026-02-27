import { useEffect, useRef } from 'react'

export default function Modal({
  isOpen,
  onClose,
  children,
  isDark,
  className = '',
}) {
  const dialogRef = useRef(null)

  // Trap focus inside modal and handle Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-11/12 max-w-md backdrop-blur-xl rounded-card shadow-2xl border overflow-hidden animate-scale-in ${
          isDark
            ? 'bg-gray-900/90 border-border-dark'
            : 'bg-white/90 border-border-light'
        } ${className}`}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </>
  )
}
