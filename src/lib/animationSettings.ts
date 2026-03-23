// ============================================================
// Team UP - Animation Settings
// CSS-class based - works with animation.css
// ============================================================
import { useState, useEffect } from 'react'

export const ANIMATION_KEYS = {
  avatarInMessages: 'anim_avatar_messages',
  avatarInCalls:    'anim_avatar_calls',
  avatarInProfiles: 'anim_avatar_profiles',
  uiTransitions:    'anim_ui_transitions',
  reducedMotion:    'anim_reduced_motion_all',
} as const

export type AnimationKey = typeof ANIMATION_KEYS[keyof typeof ANIMATION_KEYS]

// ✅ Defaults - كلهم OFF غير الـ calls
const DEFAULTS: Record<string, boolean> = {
  [ANIMATION_KEYS.avatarInMessages]: false,
  [ANIMATION_KEYS.avatarInCalls]:    true,
  [ANIMATION_KEYS.avatarInProfiles]: false,
  [ANIMATION_KEYS.uiTransitions]:    false,
  [ANIMATION_KEYS.reducedMotion]:    false,
}

function loadSettings(): Record<string, boolean> {
  try {
    const s = localStorage.getItem('teamup_anim_settings')
    if (s) return { ...DEFAULTS, ...JSON.parse(s) }
  } catch {}
  return { ...DEFAULTS }
}

function saveSettings(s: Record<string, boolean>) {
  try { localStorage.setItem('teamup_anim_settings', JSON.stringify(s)) } catch {}
}

// ✅ الدالة الأساسية - بتطبق CSS classes على <html>
export function applyAnimSettings() {
  const s = loadSettings()
  const html = document.documentElement

  // Master: reduce-motion
  html.classList.toggle('reduce-motion', !!s[ANIMATION_KEYS.reducedMotion])

  // Individual classes (بس لو مش reduce-motion)
  const reduced = !!s[ANIMATION_KEYS.reducedMotion]
  html.classList.toggle('no-anim-messages', reduced || !s[ANIMATION_KEYS.avatarInMessages])
  html.classList.toggle('no-anim-calls',    reduced || !s[ANIMATION_KEYS.avatarInCalls])
  html.classList.toggle('no-anim-profiles', reduced || !s[ANIMATION_KEYS.avatarInProfiles])
  html.classList.toggle('no-anim-ui',       reduced || !s[ANIMATION_KEYS.uiTransitions])
}

export function getAnimSetting(key: AnimationKey | string): boolean {
  const s = loadSettings()
  if (s[ANIMATION_KEYS.reducedMotion]) return false
  return s[key] ?? DEFAULTS[key] ?? false
}

export function setAnimSetting(key: AnimationKey | string, value: boolean) {
  const s = loadSettings()
  s[key] = value
  saveSettings(s)
  applyAnimSettings()
  window.dispatchEvent(new CustomEvent('teamup_anim_changed'))
}

// ✅ React hook
export function useAnimSetting(key: AnimationKey | string): boolean {
  const [value, setValue] = useState(() => getAnimSetting(key))
  useEffect(() => {
    const handler = () => setValue(getAnimSetting(key))
    window.addEventListener('teamup_anim_changed', handler)
    return () => window.removeEventListener('teamup_anim_changed', handler)
  }, [key])
  return value
}

export function useIsReducedMotion(): boolean {
  const [value, setValue] = useState(() => {
    try { return !!(JSON.parse(localStorage.getItem('teamup_anim_settings') || '{}')[ANIMATION_KEYS.reducedMotion]) } catch { return false }
  })
  useEffect(() => {
    const handler = () => {
      try { setValue(!!(JSON.parse(localStorage.getItem('teamup_anim_settings') || '{}')[ANIMATION_KEYS.reducedMotion])) } catch { setValue(false) }
    }
    window.addEventListener('teamup_anim_changed', handler)
    return () => window.removeEventListener('teamup_anim_changed', handler)
  }, [])
  return value
}
