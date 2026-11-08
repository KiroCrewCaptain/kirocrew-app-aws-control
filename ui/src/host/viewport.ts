/**
 * `useIsNarrowViewport`: whether the viewport is phone-width.
 *
 * The dashboard's hook also folds in its touch-first layout form, which is not on
 * the App SDK; this reads the same width breakpoint (`max-width: 767px`).
 */
import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 767px)'

function media(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY)
    : null
}

function subscribe(onChange: () => void): () => void {
  const m = media()
  if (!m) return () => {}
  m.addEventListener?.('change', onChange)
  return () => m.removeEventListener?.('change', onChange)
}

function getSnapshot(): boolean {
  return media()?.matches ?? false
}

export function useIsNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
