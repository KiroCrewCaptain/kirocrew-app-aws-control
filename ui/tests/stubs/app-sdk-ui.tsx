/**
 * Test stand-in for the host's `@kirocrew/app-sdk/ui`: the dashboard components
 * with their markup, roles and test ids, without the dashboard's styling engine,
 * motion or guide plumbing.
 */
import React from 'react'
import { AlertTriangle } from 'lucide-react'

type Div = Omit<React.ComponentPropsWithoutRef<'div'>, 'dangerouslySetInnerHTML'>

export function Card({ children, className = '', ...rest }: Div) {
  return (
    <div className={`bg-card rounded-xl border border-border ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '', ...rest }: React.ComponentPropsWithoutRef<'h3'>) {
  return <h3 className={className} {...rest}>{children}</h3>
}

export const Btn = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean; primary?: boolean }
>(({ children, danger, primary, className = '', ...rest }, ref) => (
  <button
    ref={ref}
    className={`${primary ? 'bg-accent' : danger ? 'text-danger' : ''} ${className}`}
    {...rest}
  >
    {children}
  </button>
))
Btn.displayName = 'Btn'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input ref={ref} {...props} />,
)
Input.displayName = 'Input'

export function SearchInput({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`relative ${className}`}>
      <input {...props} />
    </div>
  )
}

export function Badge({
  variant,
  children,
  className = '',
  ...rest
}: { variant?: string; children?: React.ReactNode } & Omit<React.ComponentPropsWithoutRef<'span'>, 'children'>) {
  const cls =
    variant === 'ok' ? 'bg-ok-subtle text-ok-text'
    : variant === 'err' ? 'bg-danger-subtle text-danger-text'
    : variant === 'aim' ? 'bg-aim-subtle text-aim'
    : variant === 'muted' ? 'bg-[var(--bg-hover)] text-[var(--muted)]'
    : 'bg-warn-subtle text-warn-text'
  return (
    <span data-variant={variant} className={`${cls} ${className}`} {...rest}>
      {children}
    </span>
  )
}

export function StatCard({
  label,
  value,
  onClick,
  active,
  title,
  className = '',
  accent: _accent,
  colorClass: _colorClass,
  delay: _delay,
  ...rest
}: {
  label: string
  value?: string | number | null
  accent?: boolean
  colorClass?: string
  delay?: number
  onClick?: () => void
  active?: boolean
  title?: string
} & Omit<Div, 'title' | 'onClick'>) {
  const loading = value === undefined || value === null
  return (
    <div
      className={`${active ? 'border-accent' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      data-testid="stat-card"
      {...rest}
    >
      <div data-testid="stat-card-label">
        {label}
        {title && <span title={title} />}
      </div>
      {loading ? (
        <div data-testid="stat-card-skeleton" />
      ) : (
        <div data-testid="stat-card-value">{value ?? '—'}</div>
      )}
    </div>
  )
}

export function Skeleton({ className = '', ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={`animate-pulse ${className}`} {...props} />
}

export function ContentSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} />
      ))}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  testId = 'empty-state',
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  testId?: string
}) {
  return (
    <div data-testid={testId}>
      <div>{icon}</div>
      <div data-testid={`${testId}-title`}>{title}</div>
      {subtitle && <div data-testid={`${testId}-subtitle`}>{subtitle}</div>}
      {action && <div data-testid={`${testId}-action`}>{action}</div>}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  describedBy,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label?: string
  describedBy?: string
  tone?: 'accent' | 'muted'
}) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      aria-label={label}
      aria-describedby={describedBy}
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) onChange(!checked)
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
          e.preventDefault()
          onChange(!checked)
        }
      }}
    />
  )
}

type ClickableProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'role' | 'onClick'> & {
  onClick: (e?: React.MouseEvent | React.KeyboardEvent) => void
  disabled?: boolean
}

export const Clickable = React.forwardRef<HTMLDivElement, ClickableProps>(
  ({ onClick, disabled, children, className, onKeyDown, tabIndex, ...props }, ref) => (
    <div
      ref={ref}
      role="button"
      tabIndex={disabled ? -1 : (tabIndex ?? 0)}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        onKeyDown?.(e)
        if (!disabled && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick(e)
        }
      }}
      aria-disabled={disabled || undefined}
      className={className}
      {...props}
    >
      {children}
    </div>
  ),
)
Clickable.displayName = 'Clickable'

export function SegmentedControl<T extends string = string>({
  segments,
  value,
  onChange,
  ariaLabel,
  iconOnly = false,
}: {
  segments: { key: T; label: string; icon?: React.ReactNode; disabled?: boolean; testId?: string; tooltip?: string }[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  iconOnly?: boolean
  [key: string]: unknown
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel}>
      {segments.map((segment) => (
        <button
          key={segment.key}
          type="button"
          role="radio"
          aria-checked={segment.key === value}
          aria-label={iconOnly ? segment.label : undefined}
          title={segment.tooltip || segment.label}
          disabled={segment.disabled}
          data-testid={segment.testId}
          onClick={() => onChange(segment.key)}
        >
          {segment.icon}
          {!iconOnly && segment.label}
        </button>
      ))}
    </div>
  )
}

export function ErrorNotice({
  message,
  report,
  title,
  onDismiss,
  dismissLabel,
  askAgent = false,
  askAgentLabel,
  footer,
  className = '',
  testId,
  variant = 'block',
  announce = true,
  actionPlacement = 'beside',
}: {
  message?: string | null
  report?: StubReport
  title?: string
  onDismiss?: () => void
  dismissLabel?: string
  askAgent?: boolean
  askAgentLabel?: string
  footer?: React.ReactNode
  className?: string
  testId?: string
  variant?: 'block' | 'inline'
  announce?: boolean
  actionPlacement?: 'beside' | 'below'
  [key: string]: unknown
}) {
  if (!message) return null
  const handOff = askAgent && (
    <button type="button" data-testid="ask-agent" onClick={() => stage(message, report)}>
      {askAgentLabel ?? 'Ask the agent'}
    </button>
  )
  const dismiss = onDismiss && (
    <button type="button" aria-label={dismissLabel ?? 'Dismiss'} onClick={onDismiss}>
      ×
    </button>
  )
  if (variant === 'inline') {
    return (
      <span role={announce ? 'alert' : undefined} className={className} data-testid={testId}>
        <AlertTriangle size={14} aria-hidden="true" />
        {title && <strong>{title}</strong>}
        <span>{message}</span>
        {handOff}
        {dismiss}
      </span>
    )
  }
  return (
    <div role={announce ? 'alert' : undefined} className={className} data-testid={testId}>
      <AlertTriangle size={14} aria-hidden="true" />
      <div className="min-w-0 flex-1 whitespace-pre-wrap">
        {title && <strong>{title} </strong>}
        {message}
        {actionPlacement === 'below' && handOff}
        {footer}
      </div>
      {actionPlacement !== 'below' && handOff}
      {dismiss}
    </div>
  )
}

/**
 * The host's markdown renderer, reduced to what the page's previews assert: ATX
 * headings, `**bold**`, fenced code (``` or ~~~, kept verbatim in `<pre><code>`),
 * and paragraphs.
 */
export function MarkdownRenderer({ content }: { content: string; [key: string]: unknown }) {
  const blocks: React.ReactNode[] = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = line.match(/^(```|~~~)(\w*)/)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith(fence[1])) body.push(lines[i++])
      blocks.push(
        <pre key={i}>
          <code data-lang={fence[2]}>{body.join('\n')}</code>
        </pre>,
      )
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      blocks.push(React.createElement(`h${heading[1].length}`, { key: i }, heading[2]))
      continue
    }
    if (!line.trim()) continue
    const parts = line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part,
    )
    blocks.push(<p key={i}>{parts}</p>)
  }
  return <div data-testid="markdown">{blocks}</div>
}

// ── The host's error hand-off, as far as a test can see it ──
//
// The dashboard's `ErrorNotice` turns its `report` (or the message) into a prompt and
// opens a chat with it. The stand-in stages the same facts the dashboard's prompt
// carries (the message, and the report's endpoint, status, code and detail), so a test
// can assert that the page handed the notice the real failure.

let staged: string | null = null
let softNavigate: ((to: string) => void) | null = null

export function installSoftNavigate(fn: ((to: string) => void) | null): void {
  softNavigate = fn
}

export function consumeChatHandoff(): string | null {
  const prompt = staged
  staged = null
  return prompt
}

export function __resetNavSeamForTests(): void {
  staged = null
  softNavigate = null
}

interface StubReport {
  endpoint?: string
  status?: number
  code?: string
  detail?: string
  message?: string
}

function stage(message: string, report?: StubReport): void {
  const lines = [message]
  if (report?.endpoint) lines.push(`Endpoint: ${report.endpoint}`)
  if (report?.status !== undefined) lines.push(`HTTP ${report.status}`)
  if (report?.code) lines.push(`Code: ${report.code}`)
  if (report?.detail) lines.push(report.detail)
  staged = lines.join('\n')
  softNavigate?.('/chat')
}
