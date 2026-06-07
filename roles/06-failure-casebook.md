# Role 06 — Failure Casebook

> **role_id:** 06-failure-casebook
> **purpose:** Каталог failure cases, которые могут произойти при использовании lab. Каждый кейс — с early warning signs, safe alternative, test_to_prevent.
> **canonical_inputs:** `canonical/threat-record.yaml`, `docs/SECURITY.md`, `REPORT.md` § Honest remaining work, `index/GAP_HARVEST.md`
> **canonical_outputs:** Этот Markdown — generated view.
> **generated_from:** 10-row threat model + 20 gaps + 10 unknown unknowns
> **last_generated:** 2026-06-07
> **coverage_score:** 0.85 (12 cards below cover main failure modes; future expansions in 06b)
> **what_this_role_can_prove:** Какие режимы отказа учтены; какие shortcuts запрещены
> **what_this_role_cannot_prove:** Что новых сбоев не будет
> **related_truth_passports:** all 7
> **related_decisions:** all 3
> **related_gaps:** all 20
> **related_discovery_leads:** all 10
> **safe_next_actions:** Promote all FAILURE_CASEs into a contract test
> **forbidden_shortcuts:** Treating any case below as "fixed" without explicit verification
> **expansion_opportunities:** 6+ more cases (UU-01..UU-10)

## Case cards (12 обязательных + 4 системных)

### FC-01 — projection mistaken for OS
- **Mistake:** Caller assumes CarPlay / Android Auto / MirrorLink = native integration.
- **Who:** End user explaining the lab to a stakeholder.
- **Why_it_seems_logical:** "If ChatGPT can show my data, it's integrated."
- **Danger:** False mental model → wrong privacy assumptions.
- **Early warning:** User says "the connector runs inside ChatGPT, not as a separate process."
- **Safe alternative:** "ChatGPT is a host; the lab is a separate MCP server. The lab reads your project JSON only when you explicitly pass it."
- **Related roles:** 03, 04
- **Related decisions:** decision-no-write-tool-policy
- **Test to prevent:** contract test asserts server is separate process (Mcp-Session-Id lifecycle).
- **Answer fixture:** `fixtures/answer/apps-sdk-bridge-vs-mcp-conformance.md` (planned)

### FC-02 — AAOS mistaken for public VHAL
- **Mistake:** Caller assumes platform (MCP) = full access to internals (any tool).
- **Who:** Reviewer reading the lab's claims.
- **Why_it_seems_logical:** "MCP is the protocol, so any tool can be added."
- **Danger:** Believes lab can read video bytes, write to project, or call Anotator8 backend.
- **Early warning:** Claim "lab can do X" where X is not in `tools/list`.
- **Safe alternative:** "Lab has 8 read-only tools. It cannot read video bytes, cannot write to project, cannot call Anotator8 backend. See truth-passport for each tool."
- **Related roles:** 03, 09
- **Related decisions:** decision-no-write-tool-policy
- **Test to prevent:** tests/contract/mcp-tool-contracts.test.ts asserts tools/list returns exactly 8 names.

### FC-03 — VSS mistaken for real signal access
- **Mistake:** Confusing signal model (VSS) with real signal access in a specific car.
- **Who:** Anyone trying to apply the lab to a vehicle.
- **Why_it_seems_logical:** "If the schema exists, the data exists."
- **Danger:** Wrong domain; the lab is Anotator8, not automotive. VSS is N/A.
- **Early warning:** "Use this lab to read telemetry from my car."
- **Safe alternative:** "The lab reads Anotator8 project files (`.anatator.json`), not vehicle telemetry. For automotive SDV, see SDV stack (not in scope)."
- **Related roles:** 01
- **Related decisions:** n/a
- **Test to prevent:** N/A (out of domain)

### FC-04 — mock pass mistaken for production ready
- **Mistake:** "Smoke PASS" = "App Store ready" / "production ready."
- **Who:** Maintainer, demo to manager.
- **Why_it_seems_logical:** "All tests pass."
- **Danger:** Premature App Store submission; production deploy without OAuth 2.1 AS.
- **Early warning:** "npm run verify is green, so let's submit to App Store."
- **Safe alternative:** Smoke PASS = protocol conformance. App Store needs OAuth 2.1 AS, privacy policy, screenshots, support contact, App Review.
- **Related roles:** 05
- **Related decisions:** decision-auth-strategy
- **Test to prevent:** manual review against `docs/CHATGPT_APP_STORE.md` pre-submission checklist.
- **Answer fixture:** `fixtures/answer/smoke-pass-vs-app-store-ready.md`

### FC-05 — read-only mistaken for privacy-safe
- **Mistake:** "All tools are read-only" = "lab is privacy-safe by default."
- **Who:** Compliance officer, DPO.
- **Why_it_seems_logical:** "No write = no risk."
- **Danger:** Caller can pass student data; widget receives `_meta.projectData`; LLM reads structuredContent.
- **Early warning:** "Just drop your .anatator.json in."
- **Safe alternative:** Read-only = no mutation. Privacy = caller must redact PII, education records, ownerId, classroomId before passing to ChatGPT.
- **Related roles:** 06
- **Related decisions:** decision-no-write-tool-policy
- **Test to prevent:** docs/PRODUCT_SURFACE.md § Privacy, privacy policy template in CHATGPT_APP_STORE.md § 3.
- **Answer fixture:** `fixtures/answer/allowlisted-fixture-vs-user-data.md`

### FC-06 — source URL mistaken for captured evidence
- **Mistake:** "I read it on the URL" = "the URL is evidence."
- **Who:** Anyone citing official docs.
- **Why_it_seems_logical:** "The OpenAI docs say it."
- **Danger:** Stale URL, breaking change upstream, no hash to compare.
- **Early warning:** "According to https://..." without snapshot.
- **Safe alternative:** "URL is locator only. For evidence, need CAPTURED_HASHED (URL + sha256 + reviewer). All 12 official URLs are LOCATOR_ONLY as of 2026-06-07."
- **Related roles:** 03
- **Related decisions:** n/a
- **Test to prevent:** `canonical/source-radar.yaml` distinguishes LOCATOR_ONLY from CAPTURED_HASHED.
- **Answer fixture:** `fixtures/answer/apps-sdk-bridge-vs-mcp-conformance.md`

### FC-07 — forum lead mistaken for verified claim
- **Who:** Anyone making policy decisions based on community posts.
- **Why_it_seems_logical:** "Multiple Reddit threads agree."
- **Danger:** Misalignment with Apps SDK submission guidelines (which are authoritative).
- **Early warning:** "I read on r/mcp that..."
- **Safe alternative:** Forum = LEAD_ONLY. Apps SDK submission guidelines = authoritative.
- **Related roles:** 03
- **Related decisions:** n/a
- **Test to prevent:** `canonical/source-radar.yaml` § TIER-4-LEAD-ONLY.

### FC-08 — infotainment confused with safety-critical ECU
- **Mistake:** Apply lab thinking to safety-critical automotive ECU.
- **Who:** Anyone porting the lab to vehicle.
- **Why_it_seems_logical:** "MCP is a protocol, can run anywhere."
- **Danger:** Out of domain; lab has no safety case for brakes / steering / BMS / airbag / ADAS.
- **Early warning:** "Let's use the lab for powertrain diagnostics."
- **Safe alternative:** Lab is for Anotator8, not for safety-critical ECUs. For safety-critical, use ISO 26262 / AUTOSAR / ASIL workflow (different domain, different tools).
- **Related roles:** 01
- **Related decisions:** n/a
- **Test to prevent:** N/A (out of domain)

### FC-09 — driver-distraction ignored (N/A here, but listed for analog)
- **Mistake:** Assume driver-distraction rules apply to ChatGPT.
- **Who:** Anyone porting automotive HMI assumptions to ChatGPT widget.
- **Why_it_seems_logical:** "Both are in-vehicle UI."
- **Danger:** Wrong mental model.
- **Early warning:** "My widget needs to lock when car is moving."
- **Safe alternative:** ChatGPT widget runs in ChatGPT, not in a car. No motion lock needed. For automotive HMI, see OEM-specific UX guidelines.
- **Related roles:** N/A (out of domain)
- **Related decisions:** n/a
- **Test to prevent:** N/A

### FC-10 — market/year/trim ignored
- **Mistake:** "Anotator8 supports X" without market/year/software version.
- **Who:** Anyone making broad product claims.
- **Why_it_seems_logical:** "Anotator8 is one product."
- **Danger:** False claim; product evolves.
- **Early warning:** Claim that doesn't specify v24.0.0.
- **Safe alternative:** Always specify `Anotator8 v24.0.0 + lab v0.4.0 + MCP SDK 1.29.0 + ext-apps 1.7.4`. v25+ is unknown.
- **Related roles:** 01
- **Related decisions:** n/a
- **Test to prevent:** N/A (process)

### FC-11 — platform source mistaken for exact vehicle proof
- **Mistake:** "MCP spec says X" = "lab v0.4.0 does X in production."
- **Who:** Anyone citing spec.
- **Why_it_seems_logical:** "If the spec says so, the implementation must."
- **Danger:** False assumption about real behavior.
- **Early warning:** Claim that starts with "MCP spec says..." and ends with "...so the lab does Y."
- **Safe alternative:** "Spec says X; lab claims to implement X (verified by tests); ChatGPT host behavior is separate question (GAP G-02)."
- **Related roles:** 03
- **Related decisions:** n/a
- **Test to prevent:** N/A (process)

### FC-12 — analogy mistaken for evidence
- **Mistake:** "MCP Inspector works, so the lab works" (Inspector is a tool, not a real client).
- **Who:** Anyone demoing to stakeholders.
- **Why_it_seems_logical:** "Inspector talks to the lab, so..."
- **Danger:** Inspector is a debug tool, not a real ChatGPT client. Different transport, different auth posture.
- **Early warning:** "I tested it in Inspector, so it's working in ChatGPT."
- **Safe alternative:** Inspector = protocol conformance. ChatGPT = real e2e (GAP G-02).
- **Related roles:** 05
- **Related decisions:** n/a
- **Test to prevent:** N/A (process)

### FC-13 — synthetic data mistaken for captured real data
- **Mistake:** "The fixture is real Anotator8 data."
- **Who:** Anyone reading the lab's claims.
- **Why_it_seems_logical:** "It looks real."
- **Danger:** False claim; fixture is synthetic + near-real generator.
- **Early warning:** Claim that doesn't specify "synthetic" or "real."
- **Safe alternative:** "Fixture is synthetic + deterministic near-real (24-annotation generator). NOT from real Anotator8 export (GAP G-04)."
- **Related roles:** 01, 05
- **Related decisions:** n/a
- **Test to prevent:** tests/contract/fixtures-compatibility.test.ts, tests/contract/near-real-fixture.test.ts

### FC-14 — DEMO-ONLY banner ignored
- **Mistake:** "Let me tunnel without setting MCP_AUTH_TOKEN."
- **Who:** Anyone exposing on public tunnel.
- **Why_it_seems_logical:** "I read docs/SECURITY.md, I know the risks."
- **Danger:** Open server, any reachable client can call 8 tools.
- **Early warning:** Skip MCP_AUTH_TOKEN; tunnel URL is up.
- **Safe alternative:** Set MCP_AUTH_TOKEN before any tunnel. Banner is unmissable on stderr.
- **Related roles:** 03
- **Related decisions:** decision-auth-strategy
- **Test to prevent:** docs/SECURITY.md + docs/CHATGPT_APP_SETUP.md
- **Gap:** G-15

### FC-15 — public tunnel without reverse proxy / rate limit
- **Mistake:** "Tunnel is up, lab is up, done."
- **Who:** Anyone deploying for public access.
- **Why_it_seems_logical:** "It works."
- **Danger:** DoS possible; no rate limit; no WAF.
- **Early warning:** No nginx / cloudflared config; no rate limit.
- **Safe alternative:** Front with nginx (rate_limit_zone) or cloudflared. GAP G-06.
- **Related roles:** 03
- **Related decisions:** decision-auth-strategy
- **Test to prevent:** N/A (deployment)
- **Gap:** G-06
- **Discovery lead:** discovery-lead/reverse-proxy-mcp

### FC-16 — App Store submission without privacy policy
- **Mistake:** "All 8 tools are read-only, we can submit."
- **Who:** Anyone submitting to App Store.
- **Why_it_seems_logical:** "Tool surface is solid."
- **Danger:** Apps SDK requires privacy policy at public URL; without it, App Review rejects.
- **Early warning:** No privacy policy URL; no screenshots; no support contact.
- **Safe alternative:** Publish privacy policy using template in CHATGPT_APP_STORE.md § 3. Capture 3+ screenshots. Provide support email. GAP G-19.
- **Related roles:** 03
- **Related decisions:** decision-auth-strategy
- **Test to prevent:** docs/CHATGPT_APP_STORE.md § 1 pre-submission checklist
- **Gap:** G-19

## What this casebook does NOT cover

- Failure cases in production ChatGPT (untested, GAP G-02)
- Failure cases under load (untested, GAP G-05)
- Failure cases with golden fixture (not available, GAP G-04)
- Failure cases under concurrent sessions (not tested, UU-04)
- Failure cases with prompt injection in labels (not tested, UU-05)

These are tracked in `index/GAP_HARVEST.md` and `canonical/unknown-unknown.yaml`.
