/**
 * 共通アバターコンポーネント
 * ユーザーのアバター画像またはイニシャルを表示
 */

import { useState, useEffect } from 'react'

const getOptimizedAvatarUrl = (url, size = 100) => {
  if (!url) return null
  if (url.includes('supabase')) {
    return `${url}?width=${size}&height=${size}&resize=contain&format=origin&quality=60`
  }
  return url
}

export default function Avatar({
  avatarUrl,
  name,
  email,
  size = 'md',
  className = ''
}) {
  const [imageError, setImageError] = useState(false)

  // avatarUrlが変更されたときにエラー状態をリセット
  useEffect(() => {
    setImageError(false)
  }, [avatarUrl])

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl'
  }

  const pixelSizes = {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64
  }

  const getInitial = () => {
    if (name) return name.charAt(0).toUpperCase()
    if (email) return email.charAt(0).toUpperCase()
    return '?'
  }

  const handleImageError = () => {
    setImageError(true)
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center font-bold ${className}`}>
      {avatarUrl && !imageError ? (
        <img
          src={getOptimizedAvatarUrl(avatarUrl, pixelSizes[size])}
          alt={name || email || 'Avatar'}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          onError={handleImageError}
        />
      ) : (
        <span>{getInitial()}</span>
      )}
    </div>
  )
}
