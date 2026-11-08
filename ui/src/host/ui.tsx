/**
 * The dashboard primitives this page renders, from the App SDK where it has them.
 *
 * `@kirocrew/app-sdk/ui` serves the host's own components (one set of styles for
 * every app). The four the SDK does not export are restated here from the
 * dashboard's `components/ui.tsx` with the same markup and class strings, minus the
 * host-only behaviour each carried: `IconButton`'s instant label tip (the native
 * `title` / `aria-label` remain) and the guide's auto-site ref.
 */
import React from 'react'
import { i18nT } from './i18n'

export {
  Badge,
  Btn,
  Card,
  CardTitle,
  ContentSkeleton,
  EmptyState,
  Input,
  SearchInput,
  Skeleton,
  StatCard,
  Toggle,
} from '@kirocrew/app-sdk/ui'

function join(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(' ')
}

const ICON_BUTTON_VARIANTS: Record<'default' | 'accent' | 'danger' | 'active', string> = {
  default: 'text-muted hover:text-text hover:bg-bg-hover',
  accent: 'text-muted hover:text-accent hover:bg-bg-hover',
  danger: 'text-muted hover:text-danger-text hover:bg-danger-subtle',
  active: 'text-accent hover:bg-bg-hover',
}

export const IconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
    variant?: keyof typeof ICON_BUTTON_VARIANTS
    'aria-label': string
  }
>(({ variant = 'default', className, children, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    title={rest.title === undefined ? rest['aria-label'] : rest.title}
    className={join(
      'p-[4px] rounded transition-all active:scale-[0.97] active:duration-75 cursor-pointer bg-transparent border-none disabled:opacity-30 disabled:cursor-not-allowed',
      ICON_BUTTON_VARIANTS[variant],
      className,
    )}
    {...rest}
  >
    {children}
  </button>
))
IconButton.displayName = 'IconButton'

export function FilteredEmpty({
  query,
  onClear,
  noun,
  testId = 'filtered-empty',
}: {
  query: string
  onClear: () => void
  noun?: string
  testId?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-1.5 animate-rise" data-testid={testId}>
      <div className="text-muted text-sm">
        {noun ? i18nT('components.ui.no_noun_match', { noun }) : i18nT('components.ui.no_matches_for')}{' '}
        <span className="font-medium text-text">&ldquo;{query}&rdquo;</span>
      </div>
      <button
        onClick={onClear}
        className="text-accent text-[13px] hover:underline cursor-pointer bg-transparent border-none p-0"
        data-testid={`${testId}-clear`}
      >
        {i18nT('components.ui.clear_filter')}
      </button>
    </div>
  )
}

export function PanelSectionHeader({
  label,
  count,
  trailing,
  className,
}: {
  label: string
  count?: number | string
  trailing?: React.ReactNode
  className?: string
}) {
  return (
    <div className={join('flex items-center gap-2', className)} data-testid="panel-section-header">
      <span className="text-[11.5px] font-semibold text-muted">{label}</span>
      {count !== undefined && <span className="text-[10.5px] text-muted font-mono tabular-nums">{count}</span>}
      <span className="flex-1 h-px bg-border" />
      {trailing}
    </div>
  )
}

/** Bare themed checkbox. Pairs with a caller-supplied label. */
export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ style, ...rest }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      style={{ margin: 0, accentColor: 'var(--accent)', cursor: 'pointer', ...style }}
      {...rest}
    />
  ),
)
Checkbox.displayName = 'Checkbox'
