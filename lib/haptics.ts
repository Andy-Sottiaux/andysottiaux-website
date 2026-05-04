/**
 * Tiny haptics helper. Wraps `navigator.vibrate` with a feature check and
 * an SSR guard so callers can fire-and-forget without tripping over
 * unsupported browsers.
 *
 * Reality check: only Android (Chrome / Firefox / Edge / Samsung) exposes
 * the Web Vibration API. iOS Safari deliberately omits it — Apple gates
 * haptics behind native UIKit and a couple of form-control patterns. So
 * iPhone visitors get a no-op, which is correct (they expect their OS to
 * own the haptic experience).
 *
 * Patterns: short tick (open), double tap (success), denial (long).
 * Durations are intentionally tiny — long buzzes feel like a notification
 * instead of a tap response.
 */

export type HapticPattern = 'tap' | 'open' | 'success' | 'deny'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 8,
  open: 12,
  success: [10, 40, 10],
  deny: [25, 30, 25],
}

export function haptic(pattern: HapticPattern = 'tap'): void {
  if (typeof window === 'undefined') return
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  // `(hover: none)` is a decent proxy for "this is a touch device" — keeps
  // accidental fires off desktops that happen to expose vibrate (rare,
  // but Edge on hybrid laptops can).
  if (window.matchMedia && !window.matchMedia('(hover: none)').matches) return
  try {
    navigator.vibrate(PATTERNS[pattern])
  } catch {
    // Silently ignore — vibration is a nicety, never a hard requirement.
  }
}
