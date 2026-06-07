# ChatGPT App Store Submission Runbook

> **Lab version:** 0.3.0 (RFC 9728 Protected Resource Metadata foundation; v0.4+ for App Store submission)
> **Sources:** <https://developers.openai.com/apps-sdk/app-submission-guidelines>, <https://developers.openai.com/apps-sdk/deploy/submission>, <https://community.openai.com/t/app-review-process-timelines-for-chatgpt-app-store/1378947>, <https://www.reddit.com/r/mcp/comments/1ps1sr5/my_experience_submitting_my_first_chatgpt_app/>, <https://medium.com/techtrends-digest/how-to-submit-your-app-to-chatgpt-and-actually-get-it-approved-f3b0d4b2b91f>
> **REPO_EVIDENCE:** `C:\anotator8-chatgpt-integration-lab\src\server\tools\*.ts`, `C:\anotator8-chatgpt-integration-lab\src\widget\*.ts`, `C:\anotator8-chatgpt-integration-lab\package.json`
> **Status:** Maintainer runbook. The lab is currently a **demo**, not App Store submission-ready. Items marked **[GAP]** must be produced before submission.

---

## 0. Five-line summary

1. **3 critical assets missing** before submission: a real **privacy policy** at a public URL, 3+ **screenshots** of the widget (no UI is currently captured), and a verified **support contact** channel.
2. **Tool annotations are correct**: all 8 tools are `readOnlyHint: true, destructiveHint: false, openWorldHint: false`. No write tools. No external content posting. No commerce. No ads. This is a strong starting position.
3. **Widget does not use `frameDomains`** (the App Store flag that triggers extra iframe review). All widget content is sandboxed by ChatGPT itself; no third-party iframe is embedded.
4. **Demo account is required**. The lab in demo mode is open (any client can call all 8 tools). For the App Store review, the reviewer needs a **gated** demo: set `MCP_AUTH_TOKEN` and provide the reviewer with the token + tunnel URL. The current 7-line DEMO-ONLY banner proves this is the intended demo UX.
5. **No live ChatGPT Developer Mode** end-to-end test has been run in this lab. The protocol layer is verified (112/112 tests + smoke), but the Apps SDK + ChatGPT account + tunnel has not been exercised. The maintainer must do that once before submission.

---

## 1. Pre-submission checklist

Every item below must be verified before clicking "Submit" in the OpenAI Platform Dashboard. Items marked **[GAP]** are missing today.

### 1.1 Tool surface

| Check | Status | Evidence |
| --- | --- | --- |
| All tools have human-readable names (verb + noun) | PASS | `src\server\tools\*.ts` `name` and `title` fields; e.g. `inspect_project` / "Inspect Anotator8 Project" |
| All tools have descriptions that match actual behavior | PASS | `description` field on every tool, e.g. `find_annotations` description starts "Filter normalized annotations by type..." |
| `readOnlyHint: true` on every tool | PASS | `src\server\app.ts:75` sets `annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }` for all 8 tools via `registerAppTool` |
| `destructiveHint: false` on every tool | PASS | same as above |
| `openWorldHint: false` on every tool (no scraping / no external side effects) | PASS | same as above |
| Tool names are unique within the app | PASS | `toolRegistry` (8 unique names) |
| No tool requests "full conversation history" / "raw chat transcripts" | PASS | Inputs are scoped to `projectData` / `fixtureId` + filters |
| No tool requests precise location (GPS / city) | PASS | None |
| Tool descriptions do not recommend overly-broad triggering | REVIEW | All 8 descriptions are scoped to project review; reviewer can challenge "suggest_labels" wording for over-triggering |
| Tool descriptions do not disparage other apps | PASS | All descriptions are factual; no comparisons |
| No impersonation of OpenAI | PASS | App name suggestion avoids "OpenAI" / "ChatGPT" prefix |

### 1.2 App surface

| Check | Status | Evidence |
| --- | --- | --- |
| App has a clear, unique purpose not native to ChatGPT | PASS | "Review Anotator8 (Anatator) video annotation projects" — clearly a workflow ChatGPT does not have natively |
| App name is not a single generic dictionary word | REVIEW | Suggested name "Anotator8 Project Review" is multi-word; reviewer can confirm |
| App description is clear and accurate | **[GAP]** | Maintainer must draft short + long description (template in §6) |
| Screenshots meet required dimensions | **[GAP]** | Maintainer must capture 3+ screenshots of the widget (see §6) |
| Support contact details are accurate and current | **[GAP]** | Maintainer must publish a support email and a website |
| Privacy policy is published at a public URL | **[GAP]** | Maintainer must publish (template in §3) |
| App is not a static frame with no interaction | PASS | The widget has live metrics + buttons that call `create_review_plan` when a bridge is available; `bridge-info` span shows state |
| App is not primarily an advertising vehicle | PASS | No ads, no commerce |
| App does not imply OpenAI endorsement | PASS | Suggested name avoids "by OpenAI" / "powered by ChatGPT" |

### 1.3 iframe / frameDomains

| Check | Status | Evidence |
| --- | --- | --- |
| App does NOT set `_meta.ui.csp.frameDomains` | PASS | `src\server\resources\widget-resource.ts:27-31` declares `connectDomains: []` and `resourceDomains: []` — no `frameDomains` is set, so the App Store iframe extra-review path is not triggered |

This is a meaningful win: ChatGPT's submission guidelines say iframe apps receive "extra manual review and are often not approved for broad distribution". The lab sidesteps that path entirely.

### 1.4 Auth and demo

| Check | Status | Evidence |
| --- | --- | --- |
| Bearer auth (or OAuth 2.1) is implemented | PARTIAL | v0.3.0 has `MCP_AUTH_TOKEN` bearer + RFC 9728 PRM foundation. OAuth 2.1 authorization server is a follow-up. The submission guidelines say OAuth is required for **public** App Store submission; bearer with a long random token may be accepted for initial review but will need OAuth before GA. |
| `MCP_AUTH_TOKEN` set for reviewer demo | **[GAP]** | Maintainer must generate `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and set it in the deployed env |
| Reviewer can log in without 2FA / extra steps | PASS in demo mode (no auth) | **[GAP]** for production submission: must provide a reviewer account that works in one step |
| Public tunnel URL is reachable | **[GAP]** | Maintainer must deploy behind `cloudflared` / `ngrok` / `tunnel-client` and confirm HTTPS |
| Privacy policy URL is reachable from the App Store listing | **[GAP]** | Same as 1.2 |
| Support URL / email is reachable | **[GAP]** | Same as 1.2 |

### 1.5 Build / runtime

| Check | Status | Evidence |
| --- | --- | --- |
| `npm run build` exits 0 | PASS | v0.3.0 build clean |
| `npm test` passes 116/116 | PASS | 16 test files, 116 tests |
| `npm run smoke` exits with `SMOKE PASS` | PASS | Real HTTP roundtrip against ephemeral server |
| `npm audit` has no `critical` in production deps | PASS | Production deps (`@modelcontextprotocol/sdk`, `ext-apps`, `zod`) have 0 vulnerabilities. The 1 critical is `vitest@<4.1.0` UI server RCE — dev-only, lab never starts the UI server. Documented in `docs\DEPENDENCY_AUDIT.md` |
| MCP Inspector (`npm run inspect`) is runnable | PASS | Wraps `npx @modelcontextprotocol/inspector@latest --server-url http://127.0.0.1:8787/mcp --transport http` |
| App can be exercised in MCP Inspector with no errors | UNCLEAR | Not run end-to-end against the deployed tunnel; maintainer must do this |
| Server logs no `error` events during a normal 5-tool walkthrough | PASS | Smoke covers 4 tools (inspect_project, validate_project, find_annotations, export_chatgpt_report) with `ok` audit status; no error events |

### 1.6 Anotator8 product fit

| Check | Status | Evidence |
| --- | --- | --- |
| App solves a real user need not covered by ChatGPT natively | PASS | Anotator8 project review is a specific video-annotation workflow; ChatGPT cannot read `.anatator.json` natively |
| App is not primarily a connector / middleware | REVIEW | The app is a ChatGPT-frontend for Anotator8, not a connector to a third-party. The submission guidelines ban "apps that primarily function as unofficial connectors to third-party services" — Anotator8 IS the first-party (we built it), so this is fine. Document the relationship clearly in the listing. |
| App does not scrape or relay unauthorized third-party content | PASS | Lab never reads external files outside allowlisted fixtures; never reads Anotator8 backend unless ported |
| App does not sell restricted goods (gambling, drugs, weapons, etc.) | PASS | No commerce at all |

---

## 2. Per-tool submission card

For each of the 8 tools, here is the value to paste into the OpenAI Platform Dashboard's "Tools" section. The form fields are: **Name**, **Title**, **Description**, **Annotations** (readOnly / destructive / openWorld), **Sample Invocation** (golden prompt), **Screenshot Prompt** (description of what the screenshot should show).

### 2.1 `list_capabilities`

- **Name:** `list_capabilities`
- **Title:** List Anotator8 Capabilities
- **Description:** Return supported read-only ChatGPT integration features and limitations.
- **Annotations:** `readOnlyHint: true, destructiveHint: false, openWorldHint: false`
- **Sample invocation:** "What can this connector do?"
- **Screenshot prompt:** Show a card with the listed features, limitations, supported annotation types, supported subtitle languages, and fixture IDs.

### 2.2 `inspect_project`

- **Name:** `inspect_project`
- **Title:** Inspect Anotator8 Project
- **Description:** Normalize an Anotator8 project and return source metadata, annotation counts, subtitles, timeline health, warnings, and unsupported fields.
- **Annotations:** `readOnlyHint: true, destructiveHint: false, openWorldHint: false`
- **Sample invocation:** "Inspect fixture sample-project and tell me what's in it."
- **Screenshot prompt:** A widget panel with 3 metrics (annotations / subtitle cues / warnings), then a Warnings list with 1–3 entries.

### 2.3 `validate_project`

- **Name:** `validate_project`
- **Title:** Validate Anotator8 Project
- **Description:** Check project consistency: ids, time ranges, subtitle cue references, source metadata, and unsupported node or annotation types.
- **Annotations:** `readOnlyHint: true, destructiveHint: false, openWorldHint: false`
- **Sample invocation:** "Validate fixture sample-project and list every warning and error."
- **Screenshot prompt:** A report showing `valid: true/false`, a list of `errors` (red), `warnings` (yellow), and a `checks` array of named pass/fail rows.

### 2.4 `summarize_annotations`

- **Name:** `summarize_annotations`
- **Title:** Summarize Annotations
- **Description:** Summarize actual annotation distribution by type, shape, label presence, and temporal span without inventing labels or objects.
- **Annotations:** `readOnlyHint: true, destructiveHint: false, openWorldHint: false`
- **Sample invocation:** "How many annotations of each type are in fixture sample-project?"
- **Screenshot prompt:** A breakdown table: `byType: {box:1, ellipse:1, arrow:1}`, `byShape: {rect:1, circle:1, arrow:1}`, `byLabelPresence: {labeled:0, unlabeled:3}`, `temporalDistribution: {startMs: 4000, endMs: 30000, rangeMs: 26000}`.

### 2.5 `find_annotations`

- **Name:** `find_annotations`
- **Title:** Find Annotations
- **Description:** Filter normalized annotations by type, label/text substring, confidence if present, and time range.
- **Annotations:** `readOnlyHint: true, destructiveHint: false, openWorldHint: false`
- **Sample invocation:** "Find all `box` annotations between 0 and 10 seconds in fixture sample-project."
- **Screenshot prompt:** A list of matching annotation objects, with `total`, `truncated: false`, and the active filters echoed.

### 2.6 `suggest_labels`

- **Name:** `suggest_labels`
- **Title:** Suggest Label Review Tasks
- **Description:** Identify missing or weak annotation labels. This tool does not invent semantic labels; proposedLabel is null unless the current label can be normalized deterministically.
- **Annotations:** `readOnlyHint: true, destructiveHint: false, openWorldHint: false`
- **Sample invocation:** "Which annotations in fixture sample-project have no label?"
- **Screenshot prompt:** A list of suggestions, each with `annotationId`, `currentLabel` (or "missing"), `proposedLabel` (null unless deterministic), `reason`, and `requiresHumanChoice: true` for missing labels.

### 2.7 `create_review_plan`

- **Name:** `create_review_plan`
- **Title:** Create Review Plan
- **Description:** Create a manual review checklist that separates detected project problems from optional suggestions.
- **Annotations:** `readOnlyHint: true, destructiveHint: false, openWorldHint: false`
- **Sample invocation:** "Build a review plan focused on subtitles for fixture sample-project."
- **Screenshot prompt:** A checklist with rows: `area`, `priority` (high/medium/low), `kind` (detected-problem / manual-check / suggestion), `text`. A separate `detectedProblems` list and a `suggestions` list.

### 2.8 `export_chatgpt_report`

- **Name:** `export_chatgpt_report`
- **Title:** Export ChatGPT Report
- **Description:** Generate a portable JSON or Markdown report. The report is returned to the caller only; no file is written.
- **Annotations:** `readOnlyHint: true, destructiveHint: false, openWorldHint: false`
- **Sample invocation:** "Export a Markdown review report for fixture sample-project."
- **Screenshot prompt:** A Markdown report with sections: Counts, Validation, Annotation Types, Limitations. The user can copy the markdown out of ChatGPT.

---

## 3. Privacy policy draft (template)

This is a **template** the maintainer must adapt, publish at a public URL, and link from the App Store listing. Aligned with the FERPA / COPPA / GDPR posture documented in `C:\anotator8-chatgpt-integration-lab\docs\PRODUCT_SURFACE.md`.

> **REPLACE `[Your Entity]`, `[contact@your-domain]`, `[effective date]`, `[your domain]` before publishing. Have a lawyer review.**

```text
# Anotator8 Project Review — Privacy Policy

Effective: [YYYY-MM-DD]
Contact: [contact@your-domain]

## What this app does

Anotator8 Project Review is a read-only ChatGPT connector that inspects
Anotator8 (.anatator.json) project files you provide. It summarizes
annotations, validates project consistency, and produces a portable review
report. The app does not modify the project file, does not upload video
bytes, and does not call any third-party service other than the ChatGPT
host itself.

## Data we process

For each tool call, we process:
- The `.anatator.json` project data you explicitly pass to the connector
  (or the built-in synthetic `sample-project` fixture you select).
- The MCP session id and Bearer access token (if you set MCP_AUTH_TOKEN).
- The OpenAI / ChatGPT conversation context that triggered the tool call.

We do NOT process:
- Video files, image files, or any binary media.
- The full ChatGPT conversation history. We only see the tool arguments you
  choose to send.
- Any data from your Anotator8 account, classroom, or backend unless you
  configure the lab to load it (out of scope for this ChatGPT connector).

## How we use the data

The data above is used solely to:
- Compute the tool response (normalization, validation, summary, report).
- Emit one structured `[audit]` line to the local stderr stream of the
  server hosting the connector. Audit lines include the tool name, status,
  and a 500-character summary; bearer tokens and `MCP_AUTH_TOKEN=...`
  values are regex-redacted. Audit lines are local to the operator's host
  and are not transmitted off-host by the app.

## Where the data goes

- Tool responses go back to the ChatGPT conversation that called the tool.
  The model and the user can see the response.
- Audit lines stay on the host running the lab server. They are not
  uploaded to us or to any third party.
- We do not persist any project data. There is no database, no log file,
  no analytics pipeline.

## Education records (FERPA / COPPA)

If the `.anatator.json` you provide contains education records, those
records are subject to FERPA in the US and equivalent regulations
elsewhere. The lab preserves the `isEducationRecord` and `ownerId` /
`classroomId` fields but does not interpret, filter, or transmit them.
The maintainer of the deployment is responsible for the FERPA / COPPA /
GDPR posture of the data the user chooses to submit.

## Data residency

Anotator8 project files can carry a `dataResidency` field with one of
`us-east | eu-central | us-west | kz-central`. The lab preserves the
field but does not act on it. Operators hosting the connector must
ensure the host region matches the residency requirement.

## Children's privacy (COPPA)

This app is suitable for general audiences. It is not directed at
children under 13. The maintainer must not enable this connector in
classrooms serving children under 13 without first implementing the
controls described in `docs\PORTING_TO_ANOTATOR8.md` step 5 (OAuth 2.1
+ per-tool scope checks + classroom filtering).

## Your controls

- Don't pass a project file to the connector if you don't want it seen
  by the model. The connector is read-only; you cannot accidentally
  mutate the file.
- Rotate `MCP_AUTH_TOKEN` if you suspect compromise.
- Remove the connector from your ChatGPT settings to revoke access.
- The lab does not store data, so there is nothing to delete on our
  side. If you need to confirm no retention, inspect the host's stderr
  log and clear it.

## Security

- Bearer auth via `MCP_AUTH_TOKEN` (comma-separated tokens supported).
  v0.3.0 also ships an RFC 9728 Protected Resource Metadata endpoint at
  `/.well-known/oauth-protected-resource[/<path>]` and a 401 `WWW-Authenticate:
  Bearer resource_metadata=...` challenge.
- All read-only tool calls. No mutation, no `run_shell`, no arbitrary
  filesystem access.
- 10MB maximum project payload; larger payloads are rejected with
  `IntegrationError("too_large_input", ...)`.
- Subprocess execution: zero. Verified by `grep -rn "child_process\|exec\|spawn" src/`.

## International transfers

The data above is processed in the region where the connector is
hosted. We do not transfer data to other regions.

## Changes to this policy

Material changes will be reflected in this document and announced in
the connector's release notes. The previous version will remain
archived at `[your-domain]/privacy-policy/previous/`.

## Contact

[contact@your-domain] — privacy questions, data requests, complaints.
```

---

## 4. App review process timeline expectations

Based on the OpenAI community thread and the Reddit first-submitter experience:

| Stage | Typical duration | Notes |
| --- | --- | --- |
| Submit to Dashboard | < 1 hour | Form is structured; the per-tool cards in §2 pre-fill the metadata fields |
| Acknowledgement email | minutes | Per the community thread: "received an acknowledgement email as soon as we submitted" |
| First reviewer pass | 1–3 weeks | Most submissions in the community thread waited 1–2 weeks; some took 3+ |
| Iteration cycles | variable | The reviewer will reject for fixable issues; resubmission restarts the timer but reviewers remember context |
| Approval + rollout | 1–7 days after approval | Apps "begin rolling out to users starting early 2026" per the OpenAI press release on third-party app submissions |
| **Total realistic window** | **2–6 weeks** | Plan for the upper bound; do not announce a launch date until approval is in hand |

**Subagent note:** this is anecdotal, not an SLA. There is no published SLA from OpenAI for App Store review. Plan slack.

---

## 5. Common rejection reasons and how to avoid them

Synthesized from the Reddit first-submitter experience and the App Store submission guidelines.

| Rejection reason | How the lab already avoids it | What the maintainer must still do |
| --- | --- | --- |
| **Screenshots don't meet dimensions** | n/a | Capture 3+ screenshots at the dimensions OpenAI requires (check Dashboard before upload). Show the widget in ChatGPT, not a raw browser. |
| **Tool permissions over-declared** | All 8 tools are `readOnlyHint: true, destructiveHint: false, openWorldHint: false` — no over-declaration possible | None |
| **Domain verification failures** | n/a — lab does not need domain verification for a public HTTPS endpoint on a tunnel | Verify the tunnel domain in the Dashboard before submission |
| **Missing privacy policy** | Template in §3 | Publish it at a public URL, paste the URL into the listing |
| **Implying OpenAI endorsement** | App name suggestion avoids "by OpenAI" / "powered by ChatGPT" | Review the final short + long description for any phrasing that could be read as endorsement |
| **Static frames with no interaction** | Widget shows live metrics + has a focus panel that calls `create_review_plan` when a bridge is available; `bridge-info` span shows state | Ensure the screenshots show the bridge-info span populated with a real value |
| **App is primarily an unofficial connector** | n/a — Anotator8 is the maintainer's own first-party product | Document the relationship clearly in the listing description: "First-party ChatGPT frontend for the Anotator8 video annotation tool" |
| **Missing demo account / locked behind 2FA** | Lab can be run with `MCP_AUTH_TOKEN` set | Generate a long random token, set it in the deployed env, provide both the URL and the token in the submission form's "Test credentials" field |
| **App requires account signup before demo** | n/a — lab in demo mode requires no signup | For production submission, the reviewer can use the demo account flow above |
| **iframe / frameDomains without justification** | Widget does NOT set `frameDomains` | None |
| **Tools request full chat history or precise location** | None of the 8 tools do | None |
| **App has write tools that aren't labeled** | No write tools | If write tools are added later (the `propose_annotation_changes` / `apply_annotation_patch` follow-ups), they MUST be labeled with `readOnlyHint: false, destructiveHint: true` and require explicit user confirmation per tool call |
| **Description compares to other apps** | Descriptions are factual | Reviewer check |
| **App shows ads or sells restricted goods** | No ads, no commerce | None |
| **App targets children under 13** | n/a | The maintainer must NOT submit if the deployment is for under-13 classrooms. App Store has a 13+ minimum. |

---

## 6. Required assets the maintainer must produce

This is the gap list. Each item has a template below. Mark each as **DONE** when published.

### 6.1 App name

Suggestion: **"Anotator8 Project Review"** (multi-word, brand-tied, no "OpenAI" / "ChatGPT" prefix).

### 6.2 Short description (1 sentence, ≤ 60 chars)

> Read-only ChatGPT connector for Anotator8 video annotation projects. Summarizes, validates, and reports — never mutates.

### 6.3 Long description (3–5 sentences)

> Anotator8 Project Review is a read-only ChatGPT connector for the Anotator8 video annotation tool. Paste an Anotator8 project file (or use the built-in sample) and ChatGPT can inspect the source, summarize annotation distribution, validate ids and time ranges, surface subtitle cue issues, and produce a portable review report. The connector never modifies the project file, never reads video bytes, and never calls third-party services other than the ChatGPT host. The widget panel shows live metrics, warnings, and a one-click path to a focused review plan.

### 6.4 Screenshots (≥ 3)

1. **Widget overview** — chat with the widget open, metrics panel populated with real numbers (3 annotations, 1 subtitle cue, 1 warning), Warnings list visible.
2. **Create-review-plan result** — chat showing the focus panel buttons (Annotations / Subtitles / Timeline) and the resulting checklist after one is clicked.
3. **Export Markdown report** — chat showing a Markdown report returned by `export_chatgpt_report`, ready to copy.

Capture at the exact dimensions the OpenAI Dashboard requests. Do not upscale.

### 6.5 Privacy policy URL

Publish the §3 template at, e.g., `https://your-domain/privacy/anotator8-chatgpt/`. Have a lawyer review before publication.

### 6.6 Support email

e.g. `support@your-domain`. Must respond within 48 hours per App Store guidelines (or longer for developer-tier apps — confirm with OpenAI).

### 6.7 Demo tunnel URL + token

```
Tunnel URL: https://your-public-host.example/mcp
MCP_AUTH_TOKEN: <generated via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))`>
```

Submit the token in the "Test credentials" field of the submission form.

### 6.8 Public homepage

A short page (1–3 paragraphs) at `https://your-domain/anotator8-chatgpt/` that:
- Explains what the connector does in 1–2 sentences
- Links to the privacy policy
- Shows the connector URL (`https://your-public-host.example/mcp`) for transparency
- Has a "Support" link to the support email

This page is what ChatGPT's "App website" field in the listing will point at.

### 6.9 Open graph image (optional but recommended)

1200×630 PNG that the App Store listing can use as a preview thumbnail. The widget has no current design system to draw from, so a simple text-on-color image with the Anotator8 brand color and the words "Project Review for ChatGPT" is enough.

---

## 7. Submission form field walkthrough

Based on the OpenAI Platform Dashboard submission flow. Values below are recommended for this lab.

| Field | Recommended value |
| --- | --- |
| App name | Anotator8 Project Review |
| Short description | (see §6.2) |
| Long description | (see §6.3) |
| Category | Productivity / Education (subject to OpenAI's current category list) |
| App website | `https://your-domain/anotator8-chatgpt/` (§6.8) |
| Privacy policy URL | `https://your-domain/privacy/anotator8-chatgpt/` (§6.5) |
| Support email | `support@your-domain` (§6.6) |
| MCP server URL (Connector URL) | `https://your-public-host.example/mcp` (§6.7) |
| Test credentials / Auth token | the bearer value from §6.7, marked as "Bearer" |
| Tools (8 cards) | §2.1 through §2.8 |
| Screenshots | 3+ from §6.4 |
| App icon | 512×512 PNG (not currently produced — **[GAP]**) |
| Open graph image | §6.9 |
| Region availability | Start with US, expand after the first approval |
| Pricing | Free (the lab is a developer tool, not a commercial product) |
| Monetization | None |
| Frame domains | DO NOT declare any — the widget does not use them |
| Permissions justification | All 8 tools read project JSON; no other access |

---

## 8. Post-submission monitoring

| What to watch | Where | Action |
| --- | --- | --- |
| Status change emails | email | Read immediately; OpenAI notifies on every state transition |
| Dashboard review status | `platform.openai.com/apps-manage` | Check daily |
| Reviewer comments / questions | email + Dashboard | Reply within 48h; slow replies trigger abandonment |
| Reject reasons (if rejected) | Dashboard | Address the specific reasons; do not resubmit without changes |
| User feedback after approval | reviews / email | Triage; update the connector |
| Tunnel uptime | external monitor (e.g. UptimeRobot) | The connector goes offline if the tunnel drops; ChatGPT surfaces this to users |
| `npm audit` after any new dep | local CI | Block the release if a new critical appears in production deps |

---

## 9. Honest unknowns

| Question | Why unclear | How to resolve |
| --- | --- | --- |
| Exact screenshot dimensions OpenAI requires | Not published in the submission guidelines; varies by app type | Check the Dashboard at upload time |
| Whether the lab is in scope for "unauthorized connector" rule | The lab does not wrap a third-party API; it inspects the maintainer's own Anotator8 format. Should be fine but no precedent | Submit and see; or email OpenAI developer support pre-submission |
| Whether iframe review is skipped when `frameDomains` is unset | OpenAI says "extra manual review" when frameDomains is set; the inverse (no frameDomains = no review) is implied but not stated | Pre-submission email to OpenAI |
| Exact OAuth 2.1 deadline | Not published for App Store; current requirement is "before public App Store submission" | Land the lab's OAuth 2.1 AS in v0.4–v0.5; submit only after that |
| Whether Bearer-only auth is accepted for initial review | Apps SDK docs say OAuth 2.1 is expected; reviewer may reject bearer-only for production submissions | Plan to add OAuth 2.1 between initial review and GA rollout |

---

## 10. Reference evidence links

- OpenAI Apps SDK submission guidelines: <https://developers.openai.com/apps-sdk/app-submission-guidelines>
- OpenAI Apps SDK security & privacy guide: <https://developers.openai.com/apps-sdk/guides/security-privacy>
- OpenAI Apps SDK submission process: <https://developers.openai.com/apps-sdk/deploy/submission>
- OpenAI Apps SDK troubleshoot: <https://developers.openai.com/apps-sdk/deploy/troubleshooting>
- MCP authorization spec (2025-06-18): <https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization>
- MCP Apps in ChatGPT: <https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt>
- ChatGPT App review process community thread: <https://community.openai.com/t/app-review-process-timelines-for-chatgpt-app-store/1378947>
- Reddit "first ChatGPT app submission" experience: <https://www.reddit.com/r/mcp/comments/1ps1sr5/my_experience_submitting_my_first_chatgpt_app/>
- Medium "how to submit your app" guide: <https://medium.com/techtrends-digest/how-to-submit-your-app-to-chatgpt-and-actually-get-it-approved-f3b0d4b2b91f>
- This lab's `docs/CHATGPT_APP_SETUP.md` (tunnel options, dev setup)
- This lab's `docs/SECURITY.md` (security model)
- This lab's `docs/PORTING_TO_ANOTATOR8.md` (port plan; OAuth 2.1 step)
- This lab's `docs/DEPENDENCY_AUDIT.md` (security audit)
