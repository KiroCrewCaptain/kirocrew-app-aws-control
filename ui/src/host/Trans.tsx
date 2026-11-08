/**
 * `<Trans>` for the one string the page renders with markup inside it.
 *
 * react-i18next is the dashboard's, not the App SDK's. This reads the same catalog
 * string through `t`, then replaces each `<name>…</name>` tag with the matching
 * element from `components` (its children become the tag's inner text). Text
 * outside a known tag is rendered as text, never as HTML.
 */
import { Fragment, cloneElement, type ReactElement, type ReactNode } from 'react'
import { t } from './i18n'

const TAG = /<(\w+)>(.*?)<\/\1>|<(\w+)\s*\/>/g

export function Trans({
  i18nKey,
  values,
  components = {},
}: {
  i18nKey: string
  values?: Record<string, unknown>
  components?: Record<string, ReactElement>
}) {
  const text = t(i18nKey, values)
  const parts: ReactNode[] = []
  let last = 0
  let index = 0
  for (const match of text.matchAll(TAG)) {
    const at = match.index ?? 0
    if (at > last) parts.push(text.slice(last, at))
    const name = match[1] ?? match[3]
    const inner = match[2] ?? ''
    const element = components[name]
    parts.push(
      element ? cloneElement(element, { key: `t${index++}` }, inner || element.props.children) : inner,
    )
    last = at + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <Fragment>{parts}</Fragment>
}
