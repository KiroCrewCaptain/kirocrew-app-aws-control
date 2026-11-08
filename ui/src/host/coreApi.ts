/**
 * The two Kiro Crew surfaces the page reads beyond its own routes, reached through
 * the app's own API.
 *
 * The built-in page called the dashboard's client for the paid-service consent
 * card (`/api/aws/consent`). An installed app's page may only call the paths its
 * manifest declares, and the built-in declared `/api/apps/aws-control/*` alone, so
 * an adopted copy cannot ask for more. The backend therefore serves the same three
 * consent calls at `/api/apps/aws-control/consent`, for the two services this app
 * gates (`s3`, `ce`) only, by handing the request to Kiro Crew's own consent
 * handlers unchanged: the owner check, the account echo and the keystone write are
 * the host's, not a copy.
 */
import type { AwsConsentStatus } from './consentTypes'

export type { AwsConsentStatus }

const CONSENT = '/api/apps/aws-control/consent'

async function json<T>(res: Response): Promise<T> {
  const text = await res.text()
  let body: unknown = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = {}
  }
  if (!res.ok) {
    const reported = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined
    const message = typeof reported === 'string' && reported ? reported : `HTTP ${res.status}`
    const err = new Error(message) as Error & { status?: number; body?: unknown }
    err.status = res.status
    err.body = body
    throw err
  }
  return body as T
}

function send(method: string, url: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export const api = {
  awsConsent: (service: string, target?: { profile: string; region: string }) =>
    send(
      'GET',
      `${CONSENT}?service=${encodeURIComponent(service)}` +
        (target && typeof target.profile === 'string' && typeof target.region === 'string'
          ? `&profile=${encodeURIComponent(target.profile)}&region=${encodeURIComponent(target.region)}`
          : ''),
    ).then((res) => json<AwsConsentStatus>(res)),
  grantAwsConsent: (
    service: string,
    shown: { profile: string; region: string; account: string },
    target?: { profile: string; region: string },
  ) =>
    send('POST', CONSENT, {
      service,
      // Echo back exactly what was on screen. The host rejects a mismatch, so a
      // confirmation can only ever apply to the account the operator read.
      expectedProfile: shown.profile,
      expectedRegion: shown.region,
      expectedAccount: shown.account,
      ...(target ? { targetProfile: target.profile, targetRegion: target.region } : {}),
    }).then((res) =>
      json<{ ok?: boolean; error?: string; code?: string; identityDetail?: string }>(res),
    ),
  revokeAwsConsent: (service: string) =>
    send('DELETE', `${CONSENT}?service=${encodeURIComponent(service)}`).then((res) =>
      json<{ ok?: boolean; removed?: boolean }>(res),
    ),
}
