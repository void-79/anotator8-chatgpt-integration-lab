# Role 01 — Product / Project / Stack Tree

> **role_id:** 01-product-stack-tree
> **purpose:** Спроецировать «Company / Vehicle / Platform Tree» на Anotator8×ChatGPT×MCP. Показать OEM, продукт, lab, зависимости, snapshot состояние.
> **canonical_inputs:** `canonical/product-dossier.yaml`, `canonical/runtime-record.yaml`, `canonical/active-canonical-index.yaml`
> **canonical_outputs:** Этот Markdown — generated view.
> **generated_from:** `canonical/product-dossier.yaml` § oem, brand, platform, model, lab_version, market, year_trim_software + `canonical/runtime-record.yaml` § node, package_manager, build, dependencies
> **last_generated:** 2026-06-07
> **coverage_score:** 0.9 (Anotator8 v24.0.0 + lab v0.4.0 — full coverage; v25+ unknown)
> **what_this_role_can_prove:** OEM, версии продуктов, snapshot состояния, runtime stack
> **what_this_role_cannot_prove:** Production runtime behavior на чужой машине, Anotator8 v25+ совместимость
> **related_truth_passports:** `truth-passport/lab-v0.4.0.yaml`
> **related_decisions:** все 3 в `canonical/decision-record/`
> **related_gaps:** G-01, G-02, G-04, G-19
> **related_discovery_leads:** `canonical/discovery-lead/index.yaml` § 10 leads
> **safe_next_actions:** OAuth 2.1 AS, reverse proxy, golden fixture
> **forbidden_shortcuts:** "production ready" claims без evidence
> **expansion_opportunities:** Добавить v25+ snapshot когда выйдет

## Tree

```text
Anotator8 × ChatGPT Integration Lab v0.4.0
├── OEM: Anotator8 team
│   └── Repo: C:\Anotator8 (untouched, REPO_EVIDENCE, 24.0.0)
├── Brand: Anotator8 (Anatator)
│   ├── Product: Anotator8 v24.0.0
│   │   ├── Frontend: React 19 + Vite
│   │   ├── Backend: FastAPI
│   │   ├── Canvas: Fabric
│   │   ├── State: Zustand
│   │   ├── CRDT: Loro CRDT (v24.0 GA)
│   │   └── Shipped tools: box, ellipse, arrow
│   └── Lab: Anotator8×ChatGPT Integration Lab v0.4.0
│       ├── Stack: Node 24.13.0 + TypeScript 5.9.3 + Zod 3.25
│       ├── Protocol: MCP 2025-06-18
│       ├── Bridge: Apps SDK 2026-01-26
│       ├── Auth: Bearer (RFC 6750) + RFC 9728 PRM foundation
│       ├── Transports: Streamable HTTP (default) + stdio
│       ├── Tests: 118/118 PASS (17 files)
│       ├── Verify: 4/4 PASS (build + test + smoke + demo:stdio)
│       └── Repo: C:\anotator8-chatgpt-integration-lab
│           ├── Old prototype: C:\chat-gpt-mcp-app (audited, do not import)
│           └── Branch: main, HEAD = 42906e1, CLEAN
└── Market: internal-demo (not commercial)
    ├── Public App Store: PLANNED (post OAuth 2.1 AS + golden fixture)
    └── Privacy: NEEDS_DPIA (FERPA / COPPA / GDPR)
```

## Таблица (model × year/market × protocol × evidence)

| Product / Lab | Version | Market | Protocol | Evidence | Confidence | Not proven | Next artifact |
|---|---|---|---|---|---|---|---|
| Anotator8 | 24.0.0 | internal | n/a | REPO_EVIDENCE `C:\Anotator8\package.json` | HIGH | v25+ shape | golden export |
| Lab | 0.4.0 | internal | MCP 2025-06-18 + Apps 2026-01-26 | REPO + RUNTIME (118/118 + 4/4 verify) | HIGH | production-ready | OAuth 2.1 AS |
| MCP SDK | 1.29.0 | upstream | n/a | REPO (`package.json`) | HIGH | recursion bug fix | upstream release |
| ext-apps | 1.7.4 | upstream | n/a | REPO (`package.json`) | HIGH | type fix | upstream release |
| Node | 24.13.0 | runtime | n/a | RUNTIME (`node --version`) | HIGH | n/a | n/a |
| Fixture `sample-project.anotator8.json` | n/a | synthetic | Anotator8 v24.0.0 | REPO + RUNTIME | MEDIUM | real Anotator8 export | golden export |
| Fixture `near-real-project.anotator8.json` | n/a | synthetic | Anotator8 v24.0.0 | RUNTIME (generator) | MEDIUM | real Anotator8 export | golden export |

## Unknowns (snapshot 2026-06-07)

- Anotator8 v25+ schema (GAP UU-02)
- Real Anotator8 export (GAP G-04)
- Real ChatGPT e2e (GAP G-02)
- Whether v0.4.0 lab is App Store ready (NO — needs OAuth 2.1 + privacy policy + screenshots + support)
- Whether v0.4.0 lab is production ready (NO — needs OAuth 2.1 AS + reverse proxy + privacy redaction)

## Architecture siblings (other MCP integrations)

- Stripe MCP server (read-only first, write with explicit scope) — analog for `decision-no-write-tool-policy`
- GitHub MCP server (similar pattern) — analog for write-tool-deferred
- Cloudflare MCP server (similar auth posture) — analog for `decision-auth-strategy`

## "Do not infer" warnings

1. **Do not infer** that "lab v0.4.0 works in production ChatGPT" — it is not e2e verified on this host.
2. **Do not infer** that "lab is OAuth 2.1 ready" — only PRM foundation is shipped; AS is missing.
3. **Do not infer** that "fixture is real Anotator8 data" — it is synthetic + deterministic near-real generator.
4. **Do not infer** that "any client that speaks MCP 2025-06-18 will accept the lab" — only specific clients tested.
5. **Do not infer** that "all Apps SDK 2026-01-26 features are supported" — only bridge + tools registered.
6. **Do not infer** that "lab handles 10k+ annotations" — not load tested.
7. **Do not infer** that "private project data is safe" — caller is responsible for redaction.
