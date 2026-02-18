/**
 * 共通アバターコンポーネント
 * ユーザーのアバター画像またはイニシャルを表示
 */

import { useState, useEffect } from 'react'

// 画像キャッシュ（メモリ内）
const imageCache = new Set()

export default function Avatar({
  avatarUrl,
  name,
  email,
  size = 'md',
  className = ''
}) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  // avatarUrlが変更されたときに状態をリセット
  useEffect(() => {
    if (!avatarUrl) {
      setImageLoaded(false)
      setImageError(false)
      return
    }

    // キャッシュ済みならすぐに表示
    if (imageCache.has(avatarUrl)) {
      setImageLoaded(true)
      setImageError(false)
      return
    }

    // 新しい画像を読み込み
    setImageLoaded(false)
    setImageError(false)

    const img = new Image()
    img.onload = () => {
      imageCache.add(avatarUrl)
      setImageLoaded(true)
    }
    img.onerror = () => {
      setImageError(true)
    }
    img.src = avatarUrl
  }, [avatarUrl])

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl'
  }

  const getInitial = () => {
    if (name) return name.charAt(0).toUpperCase()
    if (email) return email.charAt(0).toUpperCase()
    return '?'
  }

  const showImage = avatarUrl && imageLoaded && !imageError

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center font-bold ${className}`}>
      {showImage ? (
        <img
          src={avatarUrl}
          alt={name || email || 'Avatar'}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{getInitial()}</span>
      )}
    </div>
  )
}
