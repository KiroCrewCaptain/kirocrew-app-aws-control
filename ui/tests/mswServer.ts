/** A request-level mock server for the two suites that drive the real API client. */
import { setupServer } from 'msw/node'

export const server = setupServer()
