/**
 * The table head the drive's file tables share with the dashboard's artifact
 * library, restated from its `components/library/LibraryTable.tsx` (not on the App
 * SDK) with the same markup: translated column labels, and an Actions column pinned
 * `sticky right-0` on an opaque fill of the surface the table sits on, with the
 * seam drawn only when the table overflows. The drive's columns never sort, so the
 * sortable header cell is not carried.
 */
import { i18nT } from './i18n'

export type LibraryColumn = {
  /** Sort key, or '' for a column that does not sort. The drive's are all ''. */
  key: ''
  /** Translation key of the header label. '' renders an empty cell with aria-label. */
  label: string
  /** Width / min-width utilities for this column. */
  className?: string
  /** Translation key of the accessible name when `label` is empty. */
  ariaLabel?: string
}

export type TableSurface = 'card' | 'bg'

/** The opaque fill + `right-full` gradient pair for a pinned cell on a surface. */
export const PINNED_SURFACE: Record<TableSurface, { fill: string; seam: string }> = {
  card: { fill: 'bg-card', seam: 'from-card' },
  bg: { fill: 'bg-bg', seam: 'from-bg' },
}

export function LibraryTableHead({
  edgeRight = false,
  columns,
  actionsLabelKey,
  surface = 'card',
}: {
  sort: null
  onSort: (key: never) => void
  edgeRight?: boolean
  columns: LibraryColumn[]
  actionsLabelKey: string
  surface?: TableSurface
}) {
  const pinned = PINNED_SURFACE[surface]
  const th = 'text-left text-muted text-[12px] uppercase tracking-[.04em] px-2.5 py-2 border-b border-border font-medium'
  return (
    <thead>
      <tr>
        {columns.map((c, i) => (
          <th
            key={`c${i}`}
            className={`${th} ${c.className ?? ''}`}
            aria-label={c.ariaLabel ? i18nT(c.ariaLabel) : undefined}
          >
            {c.label ? i18nT(c.label) : null}
          </th>
        ))}
        <th className={`${th} w-[120px] sticky right-0 ${pinned.fill}`}>
          {edgeRight && <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 bottom-0 w-px bg-border" />}
          {edgeRight && (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute right-full top-0 bottom-0 w-6 bg-gradient-to-l ${pinned.seam} to-transparent`}
            />
          )}
          {i18nT(actionsLabelKey)}
        </th>
      </tr>
    </thead>
  )
}
