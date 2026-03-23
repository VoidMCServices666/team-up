import React, { useState } from 'react'
import { useAnimSetting, ANIMATION_KEYS } from '../lib/animationSettings'

interface AnimatedImageProps {
  src: string
  alt: string
  className?: string
  context?: 'message' | 'call' | 'profile' | 'other'
  onError?: () => void
  style?: React.CSSProperties
}

// ✅ بيحول الـ GIF URL لـ static PNG باستخدام Cloudinary transformation
function getStaticUrl(src: string): string {
  // Cloudinary: نضيف f_png,pg_1 عشان نجيب أول frame كـ PNG
  if (src?.includes('cloudinary.com')) {
    return src.replace('/upload/', '/upload/f_png,pg_1/')
  }
  // Giphy: بيدعم static URL
  if (src?.includes('giphy.com')) {
    return src.replace('media.giphy.com/media', 'i.giphy.com/media')
              .replace('.gif', '_s.gif')
  }
  return src
}

function isGifUrl(src: string): boolean {
  return !!(
    src?.toLowerCase().endsWith('.gif') ||
    src?.includes('giphy.com') ||
    src?.includes('tenor.com')
  )
}

export function AnimatedImage({
  src, alt, className, context = 'other', onError, style
}: AnimatedImageProps) {
  const animMessages = useAnimSetting(ANIMATION_KEYS.avatarInMessages)
  const animProfiles = useAnimSetting(ANIMATION_KEYS.avatarInProfiles)
  const [isHovered, setIsHovered] = useState(false)
  const [staticFailed, setStaticFailed] = useState(false)

  const shouldAnimate =
    context === 'message' ? animMessages :
    context === 'profile' ? animProfiles :
    true

  const isGif = isGifUrl(src)

  // مش GIF أو animation شغال → img عادي
  if (!isGif || shouldAnimate) {
    return (
      <img src={src} alt={alt} className={className} style={style}
        loading="lazy" onError={onError} />
    )
  }

  // GIF + animation مطفي:
  // hover → GIF يتحرك | مش hover → static frame
  const staticSrc = staticFailed ? src : getStaticUrl(src)
  const displaySrc = isHovered ? src : staticSrc

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      onError={(e) => {
        if (!isHovered && !staticFailed) {
          // الـ static URL فشل → استخدم الـ GIF الأصلي
          setStaticFailed(true)
        } else {
          onError?.()
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    />
  )
}
