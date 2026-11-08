import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetStubSdk } from './stubs/app-sdk'
import { server } from './mswServer'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  cleanup()
  resetStubSdk()
  server.resetHandlers()
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // jsdom always has storage; a host without it has nothing to clear
  }
  window.history.replaceState(null, '', '/')
})

afterAll(() => server.close())
