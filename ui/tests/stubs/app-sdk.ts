/**
 * Test stand-in for the host's `@kirocrew/app-sdk` (served by the dashboard's
 * import map at runtime). Formatting follows the dashboard's own helpers closely
 * enough for the page's assertions (en-US by default); `useNavigate` records the
 * paths it was asked for.
 */
import { useState } from 'react'

let locale = 'en'
export const navigated: string[] = []

export function setStubLocale(next: string): void {
  locale = next
}

export function resetStubSdk(): void {
  locale = 'en'
  navigated.length = 0
}

export function activeLocale(): string {
  return locale
}

export function useLanguageGeneration(): number {
  const [generation] = useState(0)
  return generation
}

export function useNavigate(): (path: string) => void {
  return (path: string) => {
    navigated.push(path)
  }
}

export type NumberOptions = Omit<Intl.NumberFormatOptions, 'localeMatcher'>

export function fmtNumber(value: number, options?: NumberOptions): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(locale, options).format(value)
}

export function fmtCurrency(value: number, currency = 'USD', options?: NumberOptions): string {
  return fmtNumber(value, { style: 'currency', currency, ...options })
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function fmtDate(
  value: Date | string | number | null | undefined,
  options?: Omit<Intl.DateTimeFormatOptions, 'localeMatcher'>,
): string {
  const d = toDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat(locale, options ?? { dateStyle: 'medium' }).format(d)
}

export function fmtRelative(
  value: Date | string | number | null | undefined,
  options?: { now?: number; style?: 'long' | 'short' | 'narrow' },
): string {
  const d = toDate(value)
  if (!d) return '—'
  const now = options?.now ?? Date.now()
  const seconds = Math.round((d.getTime() - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: options?.style ?? 'long' })
  const abs = Math.abs(seconds)
  if (abs < 60) return rtf.format(seconds, 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), 'day')
  if (abs < 86400 * 365) return rtf.format(Math.round(seconds / (86400 * 30)), 'month')
  return rtf.format(Math.round(seconds / (86400 * 365)), 'year')
}
