# ADR 0131: Cut: production authentication, token revocation, MFA and network rate limiting

- **Status:** Cut for the prototype (see ADR 0120)
- **Date:** 2026-11-20

## Decision
Not built: UAE PASS or Emirates ID sign-in, staff single sign-on, a token revocation list or short-lived refresh tokens, multi-factor authentication, per-IP and per-account rate limiting beyond the simulated one-time-code limits, and logging of failed token checks. Tokens live for `session_ttl_minutes` and cannot be revoked earlier.

## Consequences
Stolen tokens stay valid until expiry. The demo is labelled simulated everywhere a token or code appears. None of this is claimed.

## Revisit trigger
Any non-demo deployment.
