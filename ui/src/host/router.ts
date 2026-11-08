/**
 * The page's sub-routes (`/aws-control/usage`, `/aws-control/drive`, ...), without
 * the dashboard's router.
 *
 * react-router is the dashboard's, not the App SDK's, and the SDK's `useNavigate`
 * takes a path only (no `replace`, no history state). The page addresses its panes
 * in the built-in's spelling, `/aws-control/<pane>`, and this module maps that onto
 * where the app is actually mounted:
 *
 * - an ADOPTED copy keeps the built-in's route (`/aws-control/*`, from Kiro Crew's
 *   adoption pin), so the spelling is the real path and a bookmark still works;
 * - a FRESH install lives at `/apps/aws-control`, whose route takes no sub-path, so
 *   the pane rides in the query string instead (`/apps/aws-control?pane=usage`).
 *
 * A navigation writes the browser history entry the way the dashboard's router
 * does (its `{usr, key, idx}` state shape) and then announces it with a
 * `popstate`, which is the event the dashboard's router already reads its location
 * from, so the host and this page agree on where the reader is. Back and forward
 * are the browser's own.
 */
import { createElement, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { useNavigate as useHostNavigate } from '@kirocrew/app-sdk'

/** The built-in's path, which the page's own code names. */
export const LEGACY_BASE = '/aws-control'
/** Where a fresh install of this app is mounted. */
export const INSTALLED_BASE = '/apps/aws-control'
/** The query parameter a fresh install carries its pane in. */
export const PANE_PARAM = 'pane'

interface HistoryState {
  usr?: unknown
  key?: string
  idx?: number
}

function onLegacyRoute(): boolean {
  const { pathname } = window.location
  return pathname === LEGACY_BASE || pathname.startsWith(LEGACY_BASE + '/')
}

/** The current location in the built-in's spelling: `/aws-control[/<pane>...]`. */
export function currentPath(): string {
  if (onLegacyRoute()) return window.location.pathname
  const pane = new URLSearchParams(window.location.search).get(PANE_PARAM)
  return pane ? `${LEGACY_BASE}/${pane}` : LEGACY_BASE
}

/** The real URL for a path in the built-in's spelling, on this mount. */
export function hrefFor(to: string): string {
  if (!(to === LEGACY_BASE || to.startsWith(LEGACY_BASE + '/'))) return to
  if (onLegacyRoute()) return to
  const rest = to.slice(LEGACY_BASE.length + 1)
  return rest ? `${INSTALLED_BASE}?${PANE_PARAM}=${encodeURIComponent(rest)}` : INSTALLED_BASE
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

function snapshot(): string {
  return `${window.location.pathname}${window.location.search}`
}

export interface PageLocation {
  pathname: string
  state: unknown
}

export function useLocation(): PageLocation {
  useSyncExternalStore(subscribe, snapshot, snapshot)
  const raw = window.history.state as HistoryState | null
  return { pathname: currentPath(), state: raw && typeof raw === 'object' ? (raw.usr ?? null) : null }
}

export type NavigateFn = (to: string | number, opts?: { replace?: boolean; state?: unknown }) => void

export function useNavigate(): NavigateFn {
  return navigate
}

function navigate(to: string | number, opts?: { replace?: boolean; state?: unknown }): void {
  if (typeof to === 'number') {
    window.history.go(to)
    return
  }
  const previous = window.history.state as HistoryState | null
  const idx = typeof previous?.idx === 'number' ? previous.idx : 0
  const state: HistoryState = {
    usr: opts?.state,
    key: Math.random().toString(36).slice(2, 10),
    idx: opts?.replace ? idx : idx + 1,
  }
  const url = hrefFor(to)
  if (opts?.replace) window.history.replaceState(state, '', url)
  else window.history.pushState(state, '', url)
  window.dispatchEvent(new PopStateEvent('popstate', { state }))
}

/** A plain-click link to a dashboard route, through the host's own navigation. */
export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const hostNavigate = useHostNavigate()
  return createElement('a', {
    ...rest,
    href: to,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event)
      if (event.defaultPrevented) return
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      hostNavigate(to)
    },
  })
}
