# bayan.governance

Principals and demo auth, consent ledger, disclosure policies (`abu_dhabi`, `dubai`), a hash-chained audit log, third-party refusals and a deterministic escalation library, for the Rishta Safe prototype (synthetic data only, not a medical device, no clinical claims). Lane B of the build.

Everything here is draft until the clinical lead signs off (pending) and a legal read of the statute readings is done. Statute readings come from the project dossier (Federal Decree-Law 49/2023, section 3.3); the statute itself was not re-read. Arabic and Urdu strings and phrase lists are drafts written with an LLM assistant at authoring time; no native clinical reader has reviewed them. No runtime LLM anywhere.

## Entry point

```python
from bayan.governance import GovernanceService, build_governance_service

service = build_governance_service(clock, settings)
```

Spec section 3.1 names, unchanged: `request_otp`, `verify_otp`, `issue_demo_token`, `authenticate`, `grant`, `revoke`, `consents`, `disclose`, `audit_events`, `verify_audit_chain`, `third_party_request`, `evaluate_escalation`. Additive (ADR 0133): `register_identity`, `register_staff`, `assign_staff`, `record_right_not_to_know`, `withdraw_right_not_to_know`, `mark_case_synthetic`, `record_statutory_basis`, `classify_request`, `escalation_queue`, `consents_for`, `audit_events_for`, `get_consent`, `record_access_denied`.

`disclose(principal, couple_id, result, reports, policy, *, counselling_completed=False, pregnancy_in_progress=False)` returns a `GovernedDisclosure` (a `DisclosedResult` subclass). Pass `counselling_completed=True` once the journey records post-test counselling; the default withholds a shared or unresolved category from couple members (counselling first).

Seeding the demo: call `register_staff` (or `register_identity` / `issue_demo_token`) for each staff persona, `assign_staff(couple_id, staff_id)` (the `by=None` path is the trusted seeder path), `mark_case_synthetic` if needed, and `register_identity` for the OTP directory.

## Modules

| Module | What |
|---|---|
| `auth.py` | HMAC-SHA256 signed bearer tokens, simulated OTP (labelled). Not production authentication (ADR 0120, 0131) |
| `consent.py` | append-only consent and right-not-to-know ledgers; pure `effective_scope`; statutory basis vs consent (ADR 0121) |
| `disclosure.py` | the pure policy engine (ADR 0122, 0123, 0124) |
| `audit.py` | SHA-256 hash chain, documented canonical form (ADR 0125) |
| `third_party.py` | third-party refusal text and the EN/AR/UR refusal classifier (ADR 0126) |
| `reference_model.py`, `property_eval.py` | the independent reference model, the scenario generator and executor, the mutants, and `run_disclosure_property_evaluation(n_sequences=2000, seed)` (about 5 s; ADR 0134) |
| `refusal_eval.py`, `eval_data/` | `run_refusal_evaluation()`: dev (tuned) and held-out splits, the frozen held-out first run, the honest limit string |
| `escalation.py`, `escalation_eval.py` | 21 named triggers, two tiers, legal-read flags, evaluation (ADR 0127) |
| `deps.py` | FastAPI dependencies: `current_principal`, `require_roles(...)` (audited), `guard_couple` (wraps the controller's `assert_couple_access`, audited) |
| `service.py` | composition |
| data | `bayan/data/consent_policies.yaml`, `bayan/data/escalation_rules.yaml` |
| routers | `bayan/api/routers/{auth,consent,audit,third_party,escalation}.py` |

## Run the tests

```
cd D:\dev\bayan\backend
uv run pytest tests/governance -q          # under a minute: includes the 10,000-sequence property run
BAYAN_PROP_EXAMPLES=500 uv run pytest tests/governance -q    # quick pass
uv run ruff check src tests && uv run mypy
```

The terminal summary prints the exact property-run counts and the measured evaluation numbers.

### What the tests are

- `test_gov_disclosure_property.py`: hypothesis sequences of roles, grants, revocations, expiries, right-not-to-know, assignment and policy choice, driven through the real service and an independent REFERENCE MODEL (`bayan/governance/reference_model.py`, which imports only data types; the generator and executor are in `property_eval.py`, so the tests and the importable evaluation share one definition) that decides the allowed disclosure from first principles. Every state change must succeed or fail with the same exception class as the model predicts; every disclosure must equal the model's decision AND pass a textual leak scan (sentinel labels and gene names must not appear beyond scope).
- `test_gov_mutation_guard.py`: ten deliberately broken variants (defined in `property_eval.py`, run on isolated service instances) (partner findings leaked, trace leaked, right not to know ignored, staff without assignment, programme sees results, judge sees non-synthetic, consent gate skipped, revocation ignored, expiry ignored, assignment authorisation removed). The same property checker must fail on each. A control run passes.
- `test_gov_third_party.py`: refusal text and the 179-prompt labelled set in `governance/eval_data/` (100 dev, tuned on; 79 held-out, written after tuning and not tuned against; first run frozen in `refusal_eval.py`).
- `test_gov_escalation.py`: every trigger, the legal flags, the evaluation, and a broken-engine check.
- `test_gov_auth_audit.py`, `test_gov_consent_assign.py`, `test_gov_disclosure.py`, `test_gov_routers.py`: unit and router tests, including cross-couple denials.

## Data sources and licences

Facts are cited by clause, no tables copied. DoH Abu Dhabi Premarital Screening Standard V3 (Sept 2024) and DHA Dubai Standards for Premarital Screening Services V1 (effective 27 Mar 2026), read through research 02; ACMG 2021, ESHG 2016, NHS handbook through research 03; Decree-Law 49/2023 through the dossier. The refusal messages and phrase lists are original text. See `consent_policies.yaml` and `escalation_rules.yaml` headers.

## Known limits (stated plainly)

- Simulated authentication; tokens cannot be revoked early; no per-IP rate limit.
- In memory, single process; the audit chain does not detect tail truncation without an external anchor.
- Keyword matching is not understanding: held-out refusal recall was 61.0 percent (36 of 59 must-refuse prompts) at the first run; the escalation evaluation is generated from the same rules, so its 100 percent recall measures implementation consistency, not clinical sensitivity.
- Triggers, tiers, due-by hints and the life-threat proxy are drafts pending clinical sign-off; the Dubai counselling-first rule is a product safeguard whose DHA text was not confirmed; the right-not-to-know exception and X-linked gating are flagged for a legal read.
- No family cascade, no Art. 8 deletion workflow, no persistence (ADRs 0128 to 0132).
