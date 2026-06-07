# Dependency Audit

> **Lab version:** 0.2.1
> **Last audited:** 2026-06-07
> **Tool:** `npm audit --json` against `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, `zod`, `vitest`, `tsx`, `typescript`, `@types/node`.

## TL;DR

| Audit run | Critical | High | Moderate | Low | Total | Tests pass |
| --- | --- | --- | --- | --- | --- | --- |
| `vitest@^2.1.9` (v0.2.1 baseline) | 1 | 0 | 4 | 0 | 5 | 60/60 |
| `vitest@^3.2.4` (current) | 1 | 0 | 0 | 0 | 1 | 60/60 |
| `vitest@^4.1.8` (theoretical clean) | 0 | 0 | 0 | 0 | 0 | **BLOCKED** — rolldown native binding fails to load on this Windows host |

The current `vitest@^3.2.4` resolves all 4 moderate transitive vulnerabilities. The 1 remaining critical is in the Vitest UI server, which the lab does not use (it runs `vitest run`, never `vitest --ui`). The vitest 4.x line would fix the critical too, but pulls in `rolldown` (a Rust-based bundler) whose native binding is blocked by Windows Application Control in this environment.

## Detail: vitest@^2.1.9 baseline

| Package | Severity | CVE | Vulnerability | Lab exposure |
| --- | --- | --- | --- | --- |
| `vitest` (<4.1.0) | **critical** (CVSS 9.8) | GHSA-5xrq-8626-4rwp | When Vitest UI server is listening, arbitrary file can be read and executed | None — lab never starts the UI server. CI runs `npm test` = `vitest run`. |
| `vite` (<=6.4.1) | moderate | GHSA-4w7w-66w2-5vf9 | Path traversal in optimized deps `.map` handling | None — lab has no vite-based dev server. |
| `esbuild` (<=0.24.2) | moderate | GHSA-67mh-4wv8-2f99 | Dev server accepts arbitrary requests | None — lab does not serve the dev build to the network. |
| `vite-node` (<=2.2.0-beta.2) | moderate | (transitive of vite) | Same as vite | None. |
| `@vitest/mocker` (<=3.0.0-beta.4) | moderate | (transitive of vite) | Same as vite | None. |

All of these are reachable only through the dev server. The lab ships compiled TypeScript (`tsc` output in `dist/`) and does not start `vite` or `vitest --ui` in production.

## Detail: vitest@^3.2.4 (current)

| Package | Severity | Note |
| --- | --- | --- |
| `vitest` (<4.1.0) | **critical** (CVSS 9.8) | Same UI server RCE. Lab not exposed. |

4 transitive moderates are gone because vitest 3.x pulls newer versions of `vite`, `esbuild`, `vite-node`, `@vitest/mocker`.

## Detail: vitest@^4.1.8 (theoretical clean)

`npm install` succeeds. `npm audit` reports 0 vulnerabilities. `npm run build` is clean. **But `npm test` fails to start**:

```text
Error: Cannot find native binding.
cause: Error: An Application Control policy has blocked this file.
  \\?\C:\anotator8-chatgpt-integration-lab\node_modules\@rolldown\binding-win32-x64-msvc\rolldown-binding.win32-x64-msvc.node
    code: 'ERR_DLOPEN_FAILED'
```

Vitest 4.x replaces esbuild with `rolldown` (Rust-based bundler) and ships a pre-built native binding via `@rolldown/binding-win32-x64-msvc`. Windows Application Control / Defender SmartScreen blocks loading the `.node` binary in this environment.

### Workarounds tried

1. `npm i --include=optional` → no change.
2. `npm i` after removing `package-lock.json` and `node_modules` → no change (per the error message's suggestion).
3. Confirmed the file exists: `node_modules\@rolldown\binding-win32-x64-msvc\rolldown-binding.win32-x64-msvc.node`.
4. Confirmed the platform string: `win32-x64-msvc` matches the host.

The block is at the OS / Defender policy layer, not at the npm or Node layer. Possible mitigations not attempted (out of scope for the lab):

- Add the project directory to Windows Defender Application Control allowed list.
- Run from a developer-policy context (corporate IT decision).
- Use WSL2 or a Linux container where the binding can `dlopen` normally.

### Decision

Stay on `vitest@^3.2.4` for now. Document the upgrade path. Re-evaluate when one of:

- Windows policy is updated.
- Anotator8 lab moves to a Linux CI runner.
- vitest 5.x ships without rolldown.

## Production runtime exposure

The lab is a TypeScript app compiled to `dist/` by `tsc`. Production deployment runs `node dist/server/index.js`. **None of the audited packages is loaded in production runtime**:

- `vitest` — dev only
- `vite`, `vite-node`, `@vitest/mocker`, `esbuild` — transitive of vitest, dev only
- `tsx` — dev only
- `typescript` — dev only
- `@types/node` — dev only

Production dependencies: `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, `zod`. All three have no known vulnerabilities at this time (verified 2026-06-07).

## How to re-run

```powershell
cd C:\anotator8-chatgpt-integration-lab
npm audit --json
npm audit
```

## How to upgrade to vitest 4.x when the binding is unblocked

```powershell
# 1. Update package.json
#    "vitest": "^4.1.8"
# 2. Reinstall
npm install
# 3. Verify
npm test
npm audit
# Expected: 60+/60+ tests pass, 0 vulnerabilities
```

## Source links

- `vitest` UI server RCE: <https://github.com/advisories/GHSA-5xrq-8626-4rwp>
- `vite` path traversal: <https://github.com/advisories/GHSA-4w7w-66w2-5vf9>
- `esbuild` dev server: <https://github.com/advisories/GHSA-67mh-4wv8-2f99>
- `rolldown` binding (Windows): <https://github.com/rolldown/rolldown/issues>
