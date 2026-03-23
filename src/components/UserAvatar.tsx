import React, { useState } from 'react';
import type { Member } from '../App';
import { useAnimSetting, ANIMATION_KEYS } from '../lib/animationSettings';
import { AnimatedImage } from './AnimatedImage';

interface UserAvatarProps {
  user?: Member;
  username?: string;
  color?: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  className?: string;
  serverAvatar?: string;
  context?: 'message' | 'call' | 'profile' | 'other';
  isSpeaking?: boolean;
}

function StatusDot({ status, size }: { status: string; size: string }) {
  const px: Record<string, number> = { sm: 12, md: 14, lg: 20, xl: 24 }
  const s = px[size] || 14
  if (status === 'online') return (
    <svg width={s} height={s} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="8" fill="transparent" />
      <circle cx="8" cy="8" r="5" fill="#a6e3a1" />
    </svg>
  )
  if (status === 'idle') return (
    <svg width={s} height={s} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="8" fill="transparent" />
      <defs><mask id={`idle-${s}`}><circle cx="8" cy="8" r="5" fill="white" /><circle cx="11" cy="5" r="3.5" fill="black" /></mask></defs>
      <circle cx="8" cy="8" r="5" fill="#f9e2af" mask={`url(#idle-${s})`} />
    </svg>
  )
  if (status === 'dnd') return (
    <svg width={s} height={s} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="8" fill="transparent" />
      <circle cx="8" cy="8" r="5" fill="#f38ba8" />
      <rect x="4.5" y="6.75" width="7" height="2.5" rx="1.25" fill="white" opacity="0.9" />
    </svg>
  )
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="8" fill="transparent" />
      <circle cx="8" cy="8" r="5" fill="#6c7086" />
      <circle cx="8" cy="8" r="2.5" fill="white" opacity="0.5" />
    </svg>
  )
}

export function UserAvatar({
  user, username, color, status, size = 'md',
  showStatus = false, className, serverAvatar,
  context = 'other', isSpeaking = false,
}: UserAvatarProps) {
  const displayName = user?.displayName || user?.username || username || '?'
  const avatarUrl   = serverAvatar || user?.avatar
  const avatarColor = user?.avatarColor || color || '#cba6f7'
  const userStatus  = user?.status || status || 'offline'

  const animCalls = useAnimSetting(ANIMATION_KEYS.avatarInCalls)

  // speaking ring بس لو animCalls شغال
  const speakingRing = context === 'call' && isSpeaking && animCalls
    ? 'ring-2 ring-[#a6e3a1] ring-offset-2 ring-offset-[#1e1e2e] animate-pulse'
    : ''

  const sizeClasses: Record<string, string> = {
    sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-20 h-20', xl: 'w-24 h-24',
  }
  const textSizes: Record<string, string> = {
    sm: 'text-xs', md: 'text-sm', lg: 'text-2xl', xl: 'text-3xl',
  }
  const statusPos: Record<string, string> = {
    sm: '-bottom-0.5 -right-0.5', md: '-bottom-0.5 -right-0.5',
    lg: '-bottom-1 -right-1',    xl: '-bottom-1 -right-1',
  }

  return (
    <div className={`relative inline-block flex-shrink-0 ${sizeClasses[size]} ${className || ''}`}>
      <div className={`rounded-full overflow-hidden w-full h-full flex items-center justify-center text-white font-medium ${speakingRing}`}
        style={{ backgroundColor: avatarColor }}>
        {avatarUrl
          ? <AnimatedImage
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              context={context}
            />
          : <span className={textSizes[size]}>{displayName.substring(0, 2).toUpperCase()}</span>
        }
      </div>
      {showStatus && (
        <div className={`absolute ${statusPos[size]}`} style={{ color: 'inherit' }}>
          <StatusDot status={userStatus} size={size} />
        </div>
      )}
    </div>
  )
}
