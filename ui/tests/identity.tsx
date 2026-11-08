/**
 * The built-in's suite wrapped the page in the dashboard's `AppIdentityProvider`,
 * which grants a built-in its cache and view-state namespace. This app's page
 * names its own namespace (`aws-control`), so the provider is a pass-through here,
 * kept so the ported tests read as the built-in's did.
 */
import type { ReactNode } from 'react'

export function AppIdentityProvider({ children }: { appId?: string; origin?: string; children: ReactNode }) {
  return <>{children}</>
}
