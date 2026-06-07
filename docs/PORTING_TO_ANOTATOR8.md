# Porting To Anotator8

The lab must remain usable independently before any Anotator8 port begins.

## Porting Plan

| Integration lab module | Future Anotator8 location | Required changes | Risk |
| --- | --- | --- | --- |
| `src/shared/types.ts` | shared package or `src/application/integrations/chatgpt/types.ts` | Replace copied UDM/project types with imports from Anotator8 domain types | Type drift if copied long term |
| `src/server/anotator8-adapter.ts` | shared package boundary | Import official project parser or schema once Anotator8 exports one | Adapter assumptions must track save/open schema |
| `src/server/schemas.ts` | integration server package | Keep external; do not put MCP schemas in React state | Coupling to UI internals |
| `src/server/tools/*` | external MCP service or backend integration package | Add project source resolver only after auth/path policy is defined | Data exfiltration if broad reads are added |
| `src/widget/*` | external app widget package | Optionally style with Anotator8 design tokens | Full editor temptation; keep review scope |
| `fixtures/*` | Anotator8 contract fixtures | Replace synthetic fixture with exported golden project fixtures | Privacy review needed |
| `tests/contract/*` | shared contract tests | Run against Anotator8 golden exports in CI | Flaky if tied to browser state |

## Shared Package Candidate

The best candidate for a shared package is the adapter plus stable project-file domain types. It should not import Zustand stores or React components.

## Remain External

The MCP/App server, ChatGPT widget, auth, audit, deployment, and tunnel setup should remain external unless Anotator8 intentionally ships a backend-hosted connector.

## Save/Open Schema Needs

Anotator8 should eventually export a versioned JSON schema for:

- Project payload top-level fields.
- UDM node shape.
- Video source payload.
- Subtitle tracks and cues.
- Future timeline tracks/clips when no longer implicit.

## UI Entry Point Later

Add an Anotator8 UI command such as "Export ChatGPT review package" that creates a redacted project JSON or report. Avoid reading live React/Zustand state from the MCP server.

## Migration Steps

1. Keep lab external and green.
2. Add Anotator8 golden fixtures exported through the real UI.
3. Replace copied type definitions with exported schema/types.
4. Run adapter contract tests against golden fixtures.
5. Add OAuth/path policy if any real user projects are loaded server-side.
6. Add patch proposal tools only after read-only contracts remain stable.

## Rollback

Disable the connector in ChatGPT, stop the external MCP server, and keep Anotator8 unchanged. No rollback inside Anotator8 is needed for this lab.
