/**
 * Locale-aware formatting, from the App SDK (`fmtNumber`, `fmtCurrency`, `fmtDate`,
 * `fmtRelative`). `fmtBytes` is not on the SDK, so it is restated here from the
 * dashboard's `i18n/format.ts`, over the SDK's `fmtNumber`: decimal units (kB, MB,
 * GB, TB) in the narrow unit style, with every plain space made non-breaking so a
 * quantity never wraps between the number and its unit.
 */
import { fmtCurrency, fmtDate, fmtNumber, fmtRelative, type NumberOptions } from '@kirocrew/app-sdk'

export { fmtCurrency, fmtDate, fmtNumber, fmtRelative }

type ByteUnit = 'byte' | 'kilobyte' | 'megabyte' | 'gigabyte' | 'terabyte'

function fmtUnit(value: number, unit: ByteUnit, options?: NumberOptions): string {
  if (!Number.isFinite(value)) return '—'
  return fmtNumber(value, { style: 'unit', unit, unitDisplay: 'narrow', ...options }).replace(/ /g, '\u00A0')
}

function roundToDigits(value: number, digits: number): number {
  const step = 10 ** digits
  return (Math.sign(value) * Math.round(Math.abs(value) * step)) / step
}

export function fmtBytes(bytes: number, options?: NumberOptions): string {
  if (!Number.isFinite(bytes)) return '—'
  const digits = options?.maximumFractionDigits
  const b = roundToDigits(bytes, digits ?? 0)
  if (Math.abs(b) < 1000) return fmtUnit(b, 'byte', { maximumFractionDigits: 0, ...options })
  const kb = roundToDigits(bytes / 1000, digits ?? 1)
  if (Math.abs(kb) < 1000) return fmtUnit(kb, 'kilobyte', { maximumFractionDigits: 1, ...options })
  const mb = roundToDigits(bytes / 1000 ** 2, digits ?? 1)
  if (Math.abs(mb) < 1000) return fmtUnit(mb, 'megabyte', { maximumFractionDigits: 1, ...options })
  const gb = roundToDigits(bytes / 1000 ** 3, digits ?? 1)
  if (Math.abs(gb) < 1000) return fmtUnit(gb, 'gigabyte', { maximumFractionDigits: 1, ...options })
  return fmtUnit(bytes / 1000 ** 4, 'terabyte', { maximumFractionDigits: 1, ...options })
}
