# ADR 0222: The audit-chain verification beat of the video is marked for a screen check, with a fallback

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the submission-drafts lane (G2)

## Context
The only place in the frontend with a "verify the chain" control is the audit table on the couple's sharing page (`frontend/src/app/[locale]/couple/sharing/page.tsx`, component `AuditTrail`). That page is open only to a couple-member session. The real backend answers `GET /v1/audit/verify` for the roles counsellor, clinician, programme and judge only (`backend/src/bayan/api/routers/audit.py`, `VerifyReader`). A read-only probe of the in-process app on 2026-11-20 returned HTTP 403 with reason `role_not_permitted` for a couple member. The frontend's mock transport allows couple members (`READERS` in `frontend/src/lib/api/mock/handler.ts`), so the control works in mock mode and, by the code, fails against the real API. The third-party refusal control on the governance page does work: a probe returned 403 with the Decree-Law Art. 19 to 21 text.

## Decision
The script marks the audit-verification beat `[confirm screen]` and gives a fallback that is true against the real backend: call `GET /v1/audit/verify` with the judge persona's token (the interactive API page at `/docs`, or the smoke script). The script does not claim that the couple screen verifies the chain against the real backend. The drafts do not edit code. The checklist asks the owner to confirm the behaviour on the live or local build before recording, and to ask the frontend and governance lanes to align the role list.

## Consequences
The video may need a second take or a different screen for one beat. No claim is made that the code does not support.

## Revisit trigger
The frontend control is fixed, or the backend widens the verifier list and a test pins it.

## Parking-lot line (controller to append)
- Align the audit-verify roles between the sharing page control and `GET /v1/audit/verify` | the frontend mock allows couple members, the real route refuses them (ADR 0222) | before the video is recorded
