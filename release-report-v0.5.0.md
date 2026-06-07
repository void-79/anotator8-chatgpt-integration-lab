release_report:
  version: 0.5.0
  previous_version: 0.4.0
  release_type: knowledge-base-retrofit
  generated_at: 2026-06-07
  generated_by: Mavis (knowledge-base retrofit run)

  main_goal: >
    Retrofit the system-prompt knowledge-base framework onto the
    Anotator8×ChatGPT×MCP lab. Introduce truth passports, evidence ceiling,
    role views, source radar, answer fixtures, validators, and gap tracking.
    No new runtime behavior. No changes to src/**, tests/**, or legacy docs.

  changed:
    - "package.json version: 0.4.0 → 0.5.0"
    - "package.json devDependencies: +js-yaml@^4.1.0"
    - "package.json scripts: +validate:canonical, +validate:truth-passport, +validate:all"
    - "scripts/verify.ts: +2 validation steps (validate:canonical, validate:truth-passport)"
    - "verify output: 4/4 → 6/6"

  added:
    canonical_files:
      - canonical/active-canonical-index.yaml
      - canonical/product-dossier.yaml
      - canonical/runtime-record.yaml
      - canonical/official-doc-record.yaml
      - canonical/regulatory-record.yaml
      - canonical/threat-record.yaml
      - canonical/assurance-case-record.yaml
      - canonical/source-radar.yaml
      - canonical/unknown-unknown.yaml
      - canonical/tool-record/list-capabilities.yaml
      - canonical/tool-record/inspect-project.yaml
      - canonical/tool-record/validate-project.yaml
      - canonical/decision-record/bridge-strategy.yaml
      - canonical/decision-record/auth-strategy.yaml
      - canonical/decision-record/no-write-tool-policy.yaml
      - canonical/discovery-lead/index.yaml
    truth_passports:
      - truth-passport/lab-v0.4.0.yaml
      - truth-passport/tool-list-capabilities.yaml
      - truth-passport/tool-inspect-project.yaml
      - truth-passport/tool-validate-project.yaml
      - truth-passport/decision-bridge-strategy.yaml
      - truth-passport/decision-auth-strategy.yaml
      - truth-passport/decision-no-write-tool-policy.yaml
    role_views:
      - roles/01-product-stack-tree.md
      - roles/03-protocol-transport-middleware.md
      - roles/06-failure-casebook.md
      - roles/10-final-decision-matrix.md
    answer_fixtures:
      - fixtures/answer/apps-sdk-bridge-vs-mcp-conformance.yaml
      - fixtures/answer/smoke-pass-vs-app-store-ready.yaml
      - fixtures/answer/allowlisted-fixture-vs-user-data.yaml
      - fixtures/answer/rfc-9728-vs-as.yaml
    index_files:
      - index/ROLE_MAP.md
      - index/SOURCE_MAP.md
      - index/GAP_HARVEST.md
    validators:
      - scripts/validate-canonical.ts
      - scripts/validate-truth-passports.ts
    migration_docs:
      - MIGRATION_v0.4.0_to_v0.5.0.md
      - release-report-v0.5.0.md (this file)

  removed: []

  not_changed:
    - "src/** (0 runtime changes)"
    - "tests/** (0 test changes)"
    - "REPORT.md (legacy view, not overwritten)"
    - "docs/QA_REPORT.md (SUPERSEDED, not overwritten)"
    - "docs/BUILD_REPORT.md (SUPERSEDED, not overwritten)"
    - "docs/FINAL_REPORT.md (historical, not overwritten)"
    - "docs/AUDIT_AGAINST_DISCOVERY_FIRST_PROMPT_v1.md (audit v1, not overwritten)"
    - "fixtures/sample-project.anotator8.json (synthetic, not overwritten)"
    - "fixtures/near-real-project.anotator8.json (generated, not overwritten)"
    - ".github/workflows/ci.yml (not changed)"

  validation:
    verify: "6/6 PASS (build, test, smoke, demo:stdio, validate:canonical, validate:truth-passport)"
    tests: "118/118 PASS across 17 files"
    canonical_validator: "0 errors, 16 files checked"
    truth_passport_validator: "0 errors, 7 files checked, 3 warnings (acceptable)"

  honest_limitations:
    - "Only 3 of 8 tool-records created (list-capabilities, inspect-project, validate-project)"
    - "Only 3 of 6 decision-records created (bridge-strategy, auth-strategy, no-write-tool-policy)"
    - "Only 4 of 10 role views created (1, 3, 6, 10)"
    - "Only 4 of 8 answer fixtures created (bridge, smoke, fixture, rfc-9728)"
    - "Only 2 of 5 validators created (canonical, truth-passport)"
    - "12 official source URLs remain LOCATOR_ONLY (not CAPTURED_HASHED)"
    - "No live ChatGPT Developer Mode e2e verification (GAP G-02)"
    - "No OAuth 2.1 AS implementation (GAP G-01)"
    - "No golden Anotator8 export fixture (GAP G-04)"
    - "No load test (GAP G-05)"
    - "No reverse proxy (GAP G-06)"
    - "No privacy policy URL, screenshots, or support contact (GAP G-19)"
    - "Truth passport validator has 3 warnings (confidence enum, completeness string, empty related_gaps) — acceptable for v0.5.0"
    - "YAML files contain many hand-quoted strings with colons — future automation via gen-canonical.ts could reduce manual quoting"

  discovery_added:
    - "10 discovery leads in canonical/discovery-lead/index.yaml"
    - "10 unknown unknowns in canonical/unknown-unknown.yaml"
    - "31 source entries in canonical/source-radar.yaml (4 tiers)"
    - "Source families: 12 OFFICIAL_SPEC, 7 PRIMARY, 5 RUNTIME, 7 LEAD_ONLY"
    - "Discovery status: 0 CAPTURED_HASHED, 5 CAPTURED_UNHASHED, 12 LOCATOR_ONLY, 7 LEAD_ONLY, 2 UNTESTED"

  analogs_reviewed:
    - "MCP Inspector (analog of Postman for MCP)"
    - "Cloudflare Tunnel (analog of ngrok for HTTPS exposure)"
    - "GitHub MCP server (analog for read-only-first pattern)"
    - "Stripe MCP server (analog for write-tools-deferred)"
    - "Auth0 / Keycloak (analog for OAuth 2.1 AS)"

  source_families_added:
    - "MCP Specification 2025-06-18"
    - "OpenAI Apps SDK (Quickstart, Reference, Auth, Security, Testing, Submission, Guidelines)"
    - "RFC 9728 (Protected Resource Metadata)"
    - "RFC 6750 (Bearer Token Usage)"
    - "RFC 8414 (Authorization Server Metadata)"
    - "Anotator8 v24.0.0 source (REPO_EVIDENCE)"
    - "Lab source v0.4.0 (REPO_EVIDENCE)"
    - "npm audit (RUNTIME_EVIDENCE)"
    - "Community / forum / blog (LEAD_ONLY)"

  unresolved_gaps:
    - "G-01: OAuth 2.1 AS (BLOCKING for App Store)"
    - "G-02: Live ChatGPT e2e (BLOCKING for production claims)"
    - "G-19: App Store assets (BLOCKING for submission)"
    - "G-06: Reverse proxy (HIGH for public exposure)"
    - "G-16: Privacy redaction (HIGH for production)"

  next_priorities:
    - "Capture 12 Tier 1 official URLs to CAPTURED_HASHED (1-day task)"
    - "Run live ChatGPT Developer Mode e2e (needs paid account + tunnel)"
    - "Implement OAuth 2.1 AS (multi-week work)"
    - "Add 5 more tool-records + 3 more decision-records"
    - "Add validate-source-snapshots validator"
