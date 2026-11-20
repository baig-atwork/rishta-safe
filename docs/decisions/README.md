# Decision records

One record per design call and per cut. Superseded records stay, marked. Number blocks: 0001-0099 controller; 0100-0119 genetics and haematology aid; 0120-0139 governance; 0140-0159 journey and explainer; 0160-0179 frontend; 0180-0199 infrastructure; 0200-0219 declarations; 0220-0229 submission documents (0226 is the non-Azure hosting route).

84 records. The parking lot (`docs/parking-lot.md`) is only an index of deferred items; each cut has its own record.

| No. | Title | Status |
|---|---|---|
| [0001](0001-entry-scope-and-positioning.md) | Entry scope and positioning | Accepted |
| [0002](0002-uae-first-pathway-id-type-is-a-setting.md) | UAE-first pathway; the identity type is a setting | Accepted |
| [0003](0003-no-runtime-llm-static-reviewed-templates.md) | No runtime LLM; static reviewed templates plus a deterministic checker | Accepted (owner informed) |
| [0004](0004-cut-private-set-intersection.md) | Cut: private set intersection and any cryptographic pre-check | Accepted |
| [0005](0005-closed-result-vocabulary-no-residual-risk-number.md) | Closed result vocabulary; detection rate instead of a residual-risk number | Accepted |
| [0006](0006-evaluation-design-synthetic-couples-only.md) | Evaluation design: measured on synthetic couples; what is not measured | Accepted |
| [0007](0007-v2-registry-grid-direction-supersedes-lineage-folio.md) | Registry Grid direction and a new UX model supersede "Lineage Folio" | Accepted (supersedes ADR 0163 for look and for the interacti |
| [0008](0008-demo-names-and-flagship-gene-differ-from-the-field.md) | Demo names and the flagship shared gene differ from the rest of the field | Accepted |
| [0009](0009-citation-strings-never-point-to-internal-notes.md) | Citation strings never point to internal notes | Accepted |
| [0100](0100-hbb-locus-pairing-and-specialist-read-conditions.md) | Pair carriers across conditions at the HBB locus; send other haemoglobin variants and HbH to a specialist read | Accepted (draft ruleset, clinician sign-off pending) |
| [0101](0101-residual-closed-forms-internal-only.md) | Residual-chance closed forms exist as internal analysis only | Accepted |
| [0102](0102-panel-mismatch-compares-only-covered-loci.md) | Different panels give "more information needed" only where the comparison is genuinely unknown | Accepted (refines the brief; draft ruleset, sign-off pending |
| [0103](0103-synthetic-generator-scope-and-cuts.md) | Scope and cuts of the synthetic couple generator | Accepted |
| [0104](0104-haem-label-mapping-and-deviations-from-the-draft.md) | How the draft haematology rule table maps to the closed vocabulary, and where this build deviates from the draft | Accepted (draft ruleset, clinician sign-off pending) |
| [0105](0105-review-priority-ladder-and-x-linked-handling.md) | Staff-only review priority ladder, and how X-linked results are handled in the couple result | Accepted (design rules with no external source; draft, sign- |
| [0120](0120-demo-auth-is-simulated-signed-tokens-and-otp.md) | Authentication is simulated and labelled so (signed bearer tokens, simulated one-time codes) | Accepted for the prototype. Production authentication is a c |
| [0121](0121-consent-ledger-append-only-and-the-statutory-basis.md) | The consent ledger is append-only, and mandatory screening is not consent-based | Accepted (statute reading from the project dossier; legal re |
| [0122](0122-disclosure-policies-abu-dhabi-and-dubai.md) | Two selectable disclosure policies, and what actually differs between them | Accepted (draft; clinical sign-off and a legal read pending) |
| [0123](0123-right-not-to-know-and-the-life-threat-exception.md) | Right not to know withholds results in the app; the life-threat exception escalates to a human | Accepted as an interpretation; flagged `needs_legal_read` |
| [0124](0124-role-visibility-and-care-team-assignment.md) | Role visibility rules, and care-team assignment is itself access-controlled | Accepted |
| [0125](0125-audit-hash-chain-canonical-form-and-limits.md) | The audit chain, its canonical form, and what it does not detect | Accepted |
| [0126](0126-refusal-classifier-keyword-matching-and-its-measured-limits.md) | A deterministic refusal classifier, and what its numbers do and do not show | Accepted (draft; Arabic and Urdu lists unreviewed by a nativ |
| [0127](0127-escalation-library-two-tiers-legal-flags-and-what-the-evaluation-proves.md) | Escalation library: two tiers, legal-read flags, and what the evaluation proves | Accepted (every trigger and tier is a draft: clinical sign-o |
| [0128](0128-cut-family-cascade-invitation-and-relative-sharing.md) | Cut: the family cascade invitation and sharing with relatives | Cut for the prototype |
| [0129](0129-cut-durable-storage-and-external-audit-anchoring.md) | Cut: durable consent and audit storage, and an external anchor for the audit head hash | Cut for the prototype (spec section 3: state in memory behin |
| [0130](0130-cut-withdrawal-data-deletion-workflow-art-8.md) | Cut: the data-deletion workflow that Art. 8 attaches to withdrawal | Cut for the prototype |
| [0131](0131-cut-production-authentication-token-revocation-mfa-rate-limits.md) | Cut: production authentication, token revocation, MFA and network rate limiting | Cut for the prototype (see ADR 0120) |
| [0132](0132-cut-semantic-and-transliteration-aware-refusal.md) | Cut: semantic refusal, Roman-script Urdu and Arabizi, leetspeak and obfuscation handling | Cut for the prototype |
| [0133](0133-corrections-to-the-brief-and-the-research-found-by-the-governance-lane.md) | Corrections to the brief and the research, and additive contract notes | Accepted |
| [0134](0134-property-and-refusal-evaluations-are-importable-callables.md) | The disclosure property run and the refusal evaluation are importable callables | Accepted (refines ADR 0125 to 0127; supersedes where the tes |
| [0140](0140-english-text-is-draft-too-and-every-document-shows-it.md) | English explainer text carries language_status draft, not reviewed | Accepted |
| [0141](0141-cut-home-collection-pakistan-variant-adapter-parked.md) | Cut: home blood collection and partner-lab ordering; the screening visit is a simulated booking hand-off | Accepted |
| [0142](0142-cut-voice-proforma-and-dictation.md) | Cut: voice-to-proforma and dictation | Accepted |
| [0143](0143-cut-marriage-decision-field-service-interest-opt-in.md) | Cut: the per-person marriage-decision field; an opt-in service-interest field replaces it | Accepted |
| [0144](0144-explain-lane-no-runtime-llm-deterministic-checker.md) | The explain lane has no runtime model call; a deterministic checker gates every release | Accepted |
| [0145](0145-cut-standard-instruments-original-items-only.md) | Cut: DCS, DRS, GCOS-24, MMIC and NVS; eight original patient items and a SILS stratifier | Accepted |
| [0146](0146-human-comprehension-test-not-run.md) | The human comprehension test is not run; protocol and instrument only | Accepted |
| [0147](0147-detection-labels-shown-as-supplied-and-reasons-passed-as-argument.md) | Detection-rate labels are shown as the engine supplies them; reasons for more_information_needed are an argument to render | Accepted |
| [0148](0148-referral-time-standard-is-illustrative.md) | The time limit for the referral step is illustrative; the 90 percent target is sourced | Accepted |
| [0149](0149-preliminary-risk-opt-in-off-by-default-no-source-wired.md) | Preliminary pre-test risk: opt-in only, off by default, returns nothing when off, unavailable until a cited source is wired | Accepted |
| [0150](0150-referral-tasks-fhir-shaped-no-fhir-server.md) | Referral tasks are FHIR R5 Task shaped objects; there is no FHIR server and no integration | Accepted |
| [0160](0160-self-hosted-fonts-via-public-folder.md) | self hosted fonts via public folder |  |
| [0161](0161-pin-typescript-6-and-eslint-9.md) | pin typescript 6 and eslint 9 |  |
| [0162](0162-one-api-adapter-two-transports-and-mock-switch.md) | one api adapter two transports and mock switch |  |
| [0163](0163-design-direction-lineage-folio.md) | design direction lineage folio |  |
| [0164](0164-pathway-diagram-as-ordered-list-with-svg-nodes.md) | pathway diagram as ordered list with svg nodes |  |
| [0165](0165-frontend-cuts-and-deferrals.md) | frontend cuts and deferrals |  |
| [0166](0166-css-motion-and-the-route-js-budget.md) | css motion and the route js budget |  |
| [0167](0167-anti-corruption-layer-for-the-real-backend.md) | anti corruption layer for the real backend |  |
| [0168](0168-audit-table-cap-and-arabic-urdu-typography-rules.md) | audit table cap and arabic urdu typography rules |  |
| [0169](0169-product-copy-names-no-other-entry-and-evidence-is-english-only.md) | product copy names no other entry and evidence is english only |  |
| [0170](0170-threshold-nothing-preselected-and-result-not-fetched-before-a-choice.md) | threshold nothing preselected and result not fetched before a choice |  |
| [0171](0171-read-together-pairs-by-heading-section-and-never-guesses.md) | read together pairs by heading section and never guesses |  |
| [0172](0172-visibility-matrix-fixed-columns-are-data-not-controls.md) | visibility matrix fixed columns are data not controls |  |
| [0173](0173-couple-forms-keep-their-logic-only-the-presentation-changed.md) | couple forms keep their logic only the presentation changed |  |
| [0174](0174-evidence-probes-run-server-side-and-show-the-wire-response.md) | evidence probes run server side and show the wire response |  |
| [0175](0175-landing-fed-by-recorded-api-responses-not-a-live-call.md) | landing fed by recorded api responses not a live call |  |
| [0176](0176-case-bench-deep-links-use-a-second-session-action.md) | case bench deep links use a second session action |  |
| [0177](0177-governance-is-a-clause-register-and-the-third-party-demo-moved.md) | governance is a clause register and the third party demo moved |  |
| [0178](0178-staff-instrument-is-one-route-tree-with-the-selected-case-in-the-url.md) | staff instrument is one route tree with the selected case in the url |  |
| [0179](0179-haem-aid-is-a-two-pane-instrument-with-the-trace-as-a-table.md) | haem aid is a two pane instrument with the trace as a table |  |
| [0180](0180-demo-hosted-in-france-central-design-target-uae-north.md) | The demo runs in Azure France Central; the design target is UAE North | **Superseded by [ADR 0186](0186-region-attempts-for-bayans-o |
| [0181](0181-join-the-existing-container-apps-environment.md) | Rishta Safe's apps join the existing Container Apps environment from their own resource group | **Superseded by [ADR 0185](0185-bayan-gets-its-own-container |
| [0182](0182-in-memory-state-for-the-demo-single-replica.md) | The demo keeps its state in memory, so the api runs exactly one replica and no database is deployed | Accepted (infra lane, on the controller's brief of 2026-11-2 |
| [0183](0183-deploy-from-the-laptop-github-workflow-unverified.md) | Deploy from the laptop with `deploy.ps1`; the GitHub deploy workflow exists but is unverified | Accepted (infra lane, on the controller's brief of 2026-11-2 |
| [0184](0184-infra-hardening-cuts-for-the-demo.md) | Infrastructure hardening that the demo does not get (cuts) | Accepted (infra lane). Each cut is also one line in `docs/pa |
| [0185](0185-bayan-gets-its-own-container-apps-environment.md) | Rishta Safe gets its own resource group, own Log Analytics workspace and own Container Apps environment | **Superseded by [ADR 0187](0187-app-service-for-containers-a |
| [0186](0186-region-attempts-for-bayans-own-environment.md) | Region attempts for Rishta Safe's own environment: all three refused; no Rishta Safe hosting exists | Accepted as a record of what happened. The open question (ho |
| [0187](0187-app-service-for-containers-and-its-quota-refusal.md) | Host Rishta Safe on Azure App Service for Containers (Linux); the subscription has no App Service quota, so nothing is deployed | Design decided by the controller (2026-11-20) and implemente |
| [0200](0200-data-provenance-cited-facts-no-bulk-dataset.md) | Data provenance: cited facts and hand-written tables, no bulk third-party dataset | Accepted |
| [0201](0201-cut-standards-text-and-named-instruments.md) | Cut: the standards' text and gene list, and the named patient-reported instruments | Accepted |
| [0202](0202-declare-authoring-time-language-model-and-ai-assisted-authoring.md) | Declare the authoring-time language model and AI-assisted authoring | Accepted |
| [0203](0203-regulatory-posture-assert-intended-use-not-exemption.md) | Regulatory posture: assert the intended use, do not claim an exemption | Accepted |
| [0204](0204-prior-art-statement-names-and-honest-positioning.md) | Prior-art statement: what we name, what we claim | Accepted |
| [0205](0205-commercial-path-shadow-pilot-and-labelled-pricing-assumption.md) | Commercial path: shadow pilot first, pricing only as a labelled assumption | Accepted |
| [0206](0206-declarations-packaged-as-static-markdown-with-open-risks-copy.md) | Declarations are packaged static Markdown, with a copy of the open risks | Accepted |
| [0220](0220-submission-drafts-say-nothing-about-where-the-demo-is-hosted.md) | The submission drafts say nothing about where the demo is hosted until a deployment is read back | Accepted |
| [0221](0221-submission-numbers-come-from-the-scoreboard-or-a-command.md) | Every number in the submission drafts comes from the scoreboard or from a command that was run | Accepted |
| [0222](0222-audit-verification-beat-needs-a-screen-check-before-recording.md) | The audit-chain verification beat of the video is marked for a screen check, with a fallback | Accepted |
| [0223](0223-form-text-limits-are-borrowed-and-unconfirmed.md) | The form-text character limits are the sibling entry's, not confirmed for this challenge | Accepted |
| [0224](0224-submission-drafts-name-no-rival-repository-and-no-person.md) | The submission drafts name no person, no team, no rival repository and no other competition entry | Accepted |
| [0225](0225-submission-documents-name-and-count-no-other-entry.md) | The submission documents name and count no other entry, and the audit-verify video fallback is retired | Accepted (supersedes the one-name and one-count allowance in |
| [0226](0226-single-container-image-and-render-free-path-as-the-non-azure-route.md) | A single-container image and a Render free-tier blueprint are the non-Azure route to a public demo | Accepted as a prepared option (nothing deployed) |
| [0227](0227-product-renamed-to-rishta-safe-internal-identifiers-follow-later.md) | The product is renamed Rishta Safe; internal identifiers follow after submission | Accepted |
