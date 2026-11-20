# ADR 0120: Authentication is simulated and labelled so (signed bearer tokens, simulated one-time codes)

- **Status:** Accepted for the prototype. Production authentication is a cut (see ADR 0131).
- **Date:** 2026-11-20
- **Deciders:** governance lane

## Context
The spec needs role-based access that a judge can try in two minutes (personas with ready tokens, an OTP screen). Production for this pathway would sign couple members in with the national identity provider (UAE PASS or Emirates ID) and staff through the facility's identity system. None of that is available, none may be claimed (spec section 2 rule 7), and building a real identity layer would be the wrong use of the time.

## Decision
- Tokens are `base64url(claims).base64url(HMAC-SHA256)` over a `Principal`, issue time, expiry (`session_ttl_minutes`) and a random id. They are signed, not encrypted. Separate sub-keys are derived from `session_secret` for tokens, one-time codes and audit pseudonyms. Signatures are compared with `hmac.compare_digest`.
- The one-time-code flow is simulated: six digits from `secrets`, stored only as a keyed digest, five minutes, five attempts then locked, single use, five requests per target per fifteen minutes. In demo mode the code is returned in the response with `simulated: true` and a notice; outside demo mode there is no delivery adapter, so the request is refused (`501 not_configured`). An unknown target fails exactly like a wrong code.
- The service refuses to start with the development secret when `env=prod`.
- Every response that carries a token or code says it is simulated; the module docstring says it is not production authentication.

## Consequences
The demo is honest and fast. Nothing here should be copied into a deployment. The identity directory (`register_identity`) is seeded by the demo composition.

## Revisit trigger
A real identity provider integration is in scope.
