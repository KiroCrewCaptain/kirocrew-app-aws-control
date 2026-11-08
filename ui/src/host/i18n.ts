/**
 * The app's own strings. A bundle cannot read the dashboard's catalogs (those
 * belong to the host and change with it), so every locale the dashboard ships is
 * bundled here and looked up against the host's active language.
 *
 * Lookup order: the exact locale (`pt`, `zh-CN`), then its base language, then
 * English, then the key itself, so a missing translation shows English rather
 * than nothing. `{{name}}` placeholders are filled from `vars`; one with no value
 * is left as written.
 *
 * A numeric `count` picks a plural form the way the dashboard's i18next does:
 * in each catalog of the chain, `<key>_zero` for 0 when it exists, then
 * `<key>_<category>` for that catalog's own CLDR category (`one`, `few`,
 * `many`, `other`; `Intl.PluralRules`), then the bare key. So `ru` reads its
 * `_few` form for 3 while `ja` reads `_other` for every count.
 *
 * `t` reads the language at call time. The root component subscribes to the
 * host's language changes (`useLanguageGeneration`), and its re-render reaches
 * every child, so a language switch repaints the page without a reload.
 */

import { activeLocale } from '@kirocrew/app-sdk'
import bn from '../../i18n/bn.json'
import de from '../../i18n/de.json'
import en from '../../i18n/en.json'
import es from '../../i18n/es.json'
import fr from '../../i18n/fr.json'
import hi from '../../i18n/hi.json'
import it from '../../i18n/it.json'
import ja from '../../i18n/ja.json'
import ko from '../../i18n/ko.json'
import pt from '../../i18n/pt.json'
import ru from '../../i18n/ru.json'
import zhCN from '../../i18n/zh-CN.json'

interface Catalog {
  [key: string]: string | Catalog
}

export const CATALOGS: Readonly<Record<string, Catalog>> = {
  bn,
  de,
  en,
  es,
  fr,
  hi,
  it,
  ja,
  ko,
  pt,
  ru,
  'zh-CN': zhCN,
}

const own = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key)

function lookup(catalog: Catalog | undefined, key: string): string | undefined {
  let node: string | Catalog | undefined = catalog
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string' || !own(node, part)) return undefined
    node = node[part]
  }
  return typeof node === 'string' ? node : undefined
}

/** The catalogs to try for `locale`, most specific first, always ending in English. */
export function localeChain(locale: string): string[] {
  const chain: string[] = []
  const add = (candidate: string) => {
    if (own(CATALOGS, candidate) && !chain.includes(candidate)) chain.push(candidate)
  }
  add(locale)
  add(locale.split('-')[0])
  add('en')
  return chain
}

function currentLocale(): string {
  try {
    const locale = activeLocale()
    return typeof locale === 'string' && locale ? locale : 'en'
  } catch {
    return 'en'
  }
}

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g

const pluralRules = new Map<string, Intl.PluralRules>()

function pluralCategory(locale: string, count: number): string {
  let rules = pluralRules.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(locale)
    pluralRules.set(locale, rules)
  }
  return rules.select(count)
}

/** The keys to try in `locale`'s catalog, most specific first. */
function candidates(locale: string, key: string, vars?: Record<string, unknown>): string[] {
  const count = vars && own(vars, 'count') ? vars.count : undefined
  if (typeof count !== 'number' || !Number.isFinite(count)) return [key]
  const forms = [`${key}_${pluralCategory(locale, count)}`, key]
  return count === 0 ? [`${key}_zero`, ...forms] : forms
}

export function t(key: string, vars?: Record<string, unknown>): string {
  for (const locale of localeChain(currentLocale())) {
    let text: string | undefined
    for (const candidate of candidates(locale, key, vars)) {
      text = lookup(CATALOGS[locale], candidate)
      if (text !== undefined) break
    }
    if (text !== undefined) {
      return text.replace(PLACEHOLDER, (whole, name: string) =>
        vars && own(vars, name) ? String(vars[name]) : whole,
      )
    }
  }
  return key
}

/** The built-in's spelling of `t`, so the ported call sites read unchanged. */
export const i18nT = t
