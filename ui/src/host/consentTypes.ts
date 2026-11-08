/** What a paid AWS service would bill, and whether the operator confirmed it (the host's shape). */
export interface AwsConsentStatus {
  service: string
  serviceLabel: string
  /** Configured profile name. Empty means the provider's own default chain. */
  profile: string
  /** Human-readable rendering of `profile` for display. */
  credentialSource: string
  region: string
  account: string
  arn: string
  identityResolved: boolean
  identityDetail: string
  granted: boolean
  /** Operator-facing explanation when `granted` is false. */
  reason: string
  /** True when this GET withdrew a stale grant because the account changed. */
  revokedOnAccountChange: boolean
  grant: { account: string; region: string; profile: string; granted_at: string } | null
}
