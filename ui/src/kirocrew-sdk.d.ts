/**
 * Types for the two host modules this bundle imports. They are not on npm: the
 * dashboard's import map serves them at runtime (`/vendor/*.mjs`), so only the
 * names this app uses are declared. Every name here is on the App SDK of
 * `minKiroCrewVersion` (0.13.0) and later; `tests/test_manifest_contract.py`
 * checks the built bundle names nothing else.
 */

declare module '@kirocrew/app-sdk' {
  export type NumberOptions = Omit<Intl.NumberFormatOptions, 'localeMatcher'>
  export type DateStyleOptions = Omit<Intl.DateTimeFormatOptions, 'localeMatcher'>
  export type RelativeStyle = 'long' | 'short' | 'narrow'

  export function useLanguageGeneration(): number
  export function useNavigate(): (path: string) => void
  export function activeLocale(): string
  export function fmtNumber(value: number, options?: NumberOptions): string
  export function fmtCurrency(value: number, currency?: string, options?: NumberOptions): string
  export function fmtDate(value: Date | string | number | null | undefined, options?: DateStyleOptions): string
  export function fmtRelative(
    value: Date | string | number | null | undefined,
    options?: { style?: RelativeStyle; now?: number } & Record<string, unknown>,
  ): string
}

declare module '@kirocrew/app-sdk/ui' {
  import type {
    ButtonHTMLAttributes,
    ComponentType,
    CSSProperties,
    ForwardRefExoticComponent,
    HTMLAttributes,
    InputHTMLAttributes,
    ReactNode,
    RefAttributes,
  } from 'react'

  export const Btn: ForwardRefExoticComponent<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      primary?: boolean
      danger?: boolean
      small?: boolean
      ghost?: boolean
      [key: `data-${string}`]: string | undefined
    } & RefAttributes<HTMLButtonElement>
  >
  export const Input: ForwardRefExoticComponent<
    InputHTMLAttributes<HTMLInputElement> & RefAttributes<HTMLInputElement>
  >
  export const SearchInput: ComponentType<
    InputHTMLAttributes<HTMLInputElement> & { [key: `data-${string}`]: string | undefined }
  >
  export const Badge: ComponentType<{ variant?: string; children?: ReactNode; className?: string; title?: string }>
  export const Card: ComponentType<HTMLAttributes<HTMLDivElement> & { children?: ReactNode; [key: `data-${string}`]: string | undefined }>
  export const CardTitle: ComponentType<{ children?: ReactNode; className?: string; [key: string]: unknown }>
  export const StatCard: ComponentType<{ [key: string]: unknown }>
  export const Skeleton: ComponentType<{ className?: string; style?: CSSProperties; [key: string]: unknown }>
  export const ContentSkeleton: ComponentType<{ [key: string]: unknown }>
  export const EmptyState: ComponentType<{
    icon?: ReactNode
    title: ReactNode
    subtitle?: ReactNode
    action?: ReactNode
    [key: string]: unknown
  }>
  export const Toggle: ComponentType<{
    checked: boolean
    onChange: (v: boolean) => void
    disabled?: boolean
    label?: string
    describedBy?: string
    tone?: 'accent' | 'muted'
  }>
  export const Clickable: ForwardRefExoticComponent<
    HTMLAttributes<HTMLDivElement> & { disabled?: boolean; [key: `data-${string}`]: string | undefined } & RefAttributes<HTMLDivElement>
  >
  export function SegmentedControl<T extends string = string>(props: {
    segments: { key: T; label: string; icon?: ReactNode; [key: string]: unknown }[]
    value: T
    onChange: (value: T) => void
    ariaLabel?: string
    [key: string]: unknown
  }): ReactNode
  export const ErrorNotice: ComponentType<{ [key: string]: unknown }>
  export const MarkdownRenderer: ComponentType<{ content: string; [key: string]: unknown }>
}
