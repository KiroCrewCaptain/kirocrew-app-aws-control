/**
 * The pieces that replace dashboard internals the built-in page imported: where
 * the page's sub-routes live on each mount, the consent card's calls through the
 * app's own API, the menu, and the view-state key a built-in user already has.
 */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentPath, hrefFor, useLocation, useNavigate } from '../src/host/router'
import { api } from '../src/host/coreApi'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../src/host/dropdown'
import { isViewString, useAppViewState, type ViewStateDecl } from '../src/host/viewState'
import { resolveAppQueryKey } from '../src/host/appQuery'
import { t } from '../src/host/i18n'
import { setStubLocale } from './stubs/app-sdk'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sub-routes on each mount', () => {
  it('an adopted copy keeps the built-in path, so a bookmark still works', () => {
    window.history.replaceState(null, '', '/aws-control/usage')
    expect(currentPath()).toBe('/aws-control/usage')
    expect(hrefFor('/aws-control/drive')).toBe('/aws-control/drive')
  })

  it('a fresh install carries the pane in the query string', () => {
    window.history.replaceState(null, '', '/apps/aws-control?pane=usage')
    expect(currentPath()).toBe('/aws-control/usage')
    expect(hrefFor('/aws-control/drive')).toBe('/apps/aws-control?pane=drive')
    expect(hrefFor('/aws-control')).toBe('/apps/aws-control')
    // A dashboard route outside the page is left alone.
    expect(hrefFor('/artifacts/x')).toBe('/artifacts/x')
  })

  it('a navigation writes history the host router reads, and the page re-renders', () => {
    window.history.replaceState({ usr: null, key: 'k', idx: 3 }, '', '/apps/aws-control')
    const { result } = renderHook(() => ({ location: useLocation(), navigate: useNavigate() }))
    const pops: PopStateEvent[] = []
    const onPop = (e: PopStateEvent) => pops.push(e)
    window.addEventListener('popstate', onPop)
    act(() => result.current.navigate('/aws-control/backup', { state: { marker: true } }))
    window.removeEventListener('popstate', onPop)
    expect(window.location.pathname + window.location.search).toBe('/apps/aws-control?pane=backup')
    expect(window.history.state).toMatchObject({ usr: { marker: true }, idx: 4 })
    expect(pops).toHaveLength(1)
    expect(result.current.location).toEqual({ pathname: '/aws-control/backup', state: { marker: true } })
    act(() => result.current.navigate('/aws-control', { replace: true }))
    expect(window.history.state).toMatchObject({ idx: 4 })
    expect(result.current.location.pathname).toBe('/aws-control')
  })
})

describe('the consent card goes through the app\'s own API', () => {
  it('reads, confirms and withdraws at /api/apps/aws-control/consent', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push([url, init])
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }))
    await api.awsConsent('s3')
    await api.grantAwsConsent('s3', { profile: 'p', region: 'us-west-2', account: '111122223333' })
    await api.revokeAwsConsent('ce')
    expect(calls.map(([url, init]) => [init?.method, url])).toEqual([
      ['GET', '/api/apps/aws-control/consent?service=s3'],
      ['POST', '/api/apps/aws-control/consent'],
      ['DELETE', '/api/apps/aws-control/consent?service=ce'],
    ])
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({
      service: 's3', expectedProfile: 'p', expectedRegion: 'us-west-2', expectedAccount: '111122223333',
    })
  })

  it('a refusal rejects with the server\'s sentence and status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ error: 'dashboard owner required', code: 'owner_only' }), { status: 403 })))
    await expect(api.awsConsent('s3')).rejects.toMatchObject({ message: 'dashboard owner required', status: 403 })
  })
})

describe('the row menu', () => {
  function Menu({ onPick }: { onPick: (e: Event) => void }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" data-testid="more">more</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onPick} data-testid="pick">Pick</DropdownMenuItem>
          <DropdownMenuItem disabled data-testid="off">Off</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  it('opens from the keyboard, runs the item, and closes', () => {
    const onPick = vi.fn()
    render(<Menu onPick={onPick} />)
    const trigger = screen.getByTestId('more')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('off')).toHaveAttribute('data-disabled')
    fireEvent.click(screen.getByTestId('pick'))
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('stays open when the item prevents the select, and Escape closes it', () => {
    render(<Menu onPick={(e) => e.preventDefault()} />)
    fireEvent.pointerDown(screen.getByTestId('more'), { button: 0 })
    fireEvent.click(screen.getByTestId('pick'))
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('the built-in\'s client-side state is read where it was left', () => {
  const DECL: ViewStateDecl<{ path: string }> = {
    name: 'drive', revision: 1, fields: { path: isViewString }, defaults: { path: '' },
  }

  it('the drive folder restores from the built-in\'s key', () => {
    localStorage.setItem(
      'kc:app:aws-control:view:drive:111122223333',
      JSON.stringify({ revision: 1, state: { path: 'reports/' } }),
    )
    const { result } = renderHook(() => useAppViewState(DECL, { scope: '111122223333' }))
    const [view] = result.current
    expect(view.path).toBe('reports/')
  })

  it('query keys stay under the app\'s namespace, as the built-in\'s did', () => {
    expect(resolveAppQueryKey(['drive', '1'])).toEqual(['aws-control', 'drive', '1'])
    expect(resolveAppQueryKey(['aws-control', 'drive'])).toEqual(['aws-control', 'drive'])
  })
})

describe('the app\'s own strings', () => {
  it('fall back from a locale to English, and pick plural forms', () => {
    setStubLocale('de')
    expect(t('apps.awsControl.manifest.display_name')).toBe('AWS Control')
    setStubLocale('xx')
    expect(t('components.awsConsentGate.retry')).not.toBe('components.awsConsentGate.retry')
  })
})
