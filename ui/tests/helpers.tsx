/**
 * `renderWithProviders`: the page under a fresh query client, at a route.
 *
 * The dashboard's helper also mounted its Redux store, theme and a MemoryRouter.
 * This page reads its location from the browser's own history (`src/host/router.ts`),
 * so the route is written there instead, and nothing else is needed.
 */
import React from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query'

interface WrapperOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string
  queryDefaults?: DefaultOptions['queries']
}

export function setRoute(route: string, state: unknown = null): void {
  window.history.replaceState({ usr: state, key: 'test', idx: 0 }, '', route)
}

export function renderWithProviders(ui: React.ReactElement, { route = '/', queryDefaults, ...renderOptions }: WrapperOptions = {}) {
  setRoute(route)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, ...queryDefaults } },
  })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) }
}
