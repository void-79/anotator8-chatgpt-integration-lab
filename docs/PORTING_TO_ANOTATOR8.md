# Porting Guide: Anotator8 ChatGPT Integration Lab → Anotator8

## Overview

This guide describes how to integrate the ChatGPT MCP server from this external laboratory into the Anotator8 codebase.

## Decision: Why External First?

Building externally provides:
1. **Independent verification** - No coupling to Anotator8 internals
2. **Clean contract** - Can verify the integration model works
3. **No risk to Anotator8** - Original code untouched
4. **Easy rollback** - Just delete the integration lab folder

## Porting Plan

### Phase 1: Preparation

| Step | Change | Risk | Verification |
|------|--------|------|--------------|
| 1.1 | Review Anotator8 project export format | Low | Compare with fixture |
| 1.2 | Identify MCP server integration point | Medium | Check backend structure |
| 1.3 | Plan configuration management | Low | Decide env vs config |

### Phase 2: Adapter Porting

| Step | Change | Risk | Verification |
|------|--------|------|--------------|
| 2.1 | Copy `src/shared/types.ts` to Anotator8 | Low | TypeScript compilation |
| 2.2 | Copy `src/server/anotator8-adapter.ts` | Low | Unit tests pass |
| 2.3 | Adapt imports for Anotator8 project structure | Medium | Integration tests |
| 2.4 | Add Anotator8-specific validations | Low | Validation tests |

### Phase 3: Server Porting

| Step | Change | Risk | Verification |
|------|--------|------|--------------|
| 3.1 | Copy MCP server code | Low | Server starts |
| 3.2 | Add Anotator8 backend integration | Medium | Can load projects |
| 3.3 | Configure authentication | Medium | Secure endpoints |
| 3.4 | Add HTTPS/TLS | Low | TLS validation |

### Phase 4: Widget Porting (Optional)

| Step | Change | Risk | Verification |
|------|--------|------|--------------|
| 4.1 | Copy widget HTML/JS | Low | Renders in ChatGPT |
| 4.2 | Integrate with Anotator8 styles | Low | Visual consistency |
| 4.3 | Add deep linking | Medium | Opens correct project |

## Module Mapping

### External Lab → Anotator8 Location

| Lab Module | Anotator8 Target | Notes |
|------------|------------------|-------|
| `src/shared/types.ts` | `src/integration/chatgpt/types.ts` | Shared integration types |
| `src/server/anotator8-adapter.ts` | `src/integration/chatgpt/adapter.ts` | Project normalization |
| `src/server/index.ts` | `src/integration/chatgpt/server.ts` | MCP server |
| `src/server/tools/*.ts` | `src/integration/chatgpt/tools/` | Tool implementations |
| `src/widget/` | `public/chatgpt-widget/` | Static widget assets |
| `fixtures/` | `tests/fixtures/chatgpt/` | Integration test data |
| `tests/unit/` | `tests/integration/chatgpt/` | Unit tests |

## Required Anotator8 Changes

### 1. Project Export Enhancement

The adapter expects `ProjectFilePayload` structure. Verify Anotator8's export matches:

```typescript
interface ProjectFilePayload {
  version: string;
  videoUrl?: string;
  videoSource?: VideoSource;
  locale?: AppLocale;
  classroomId?: string;
  classroomName?: string;
  subtitleTracks?: SubtitleTrack[];
  subtitleCues?: SubtitleCue[];
  nodes: UDMNode[];
}
```

**If different:** Update adapter to handle Anotator8's actual structure.

### 2. Backend API Endpoint

Add MCP server endpoint to Anotator8 backend:

```typescript
// Example Express/Fastify endpoint
app.post('/api/chatgpt/mcp', async (req, res) => {
  // Forward to MCP server or handle directly
});
```

### 3. Configuration

Add to Anotator8 config:

```typescript
interface ChatGPTConfig {
  enabled: boolean;
  mcpServerUrl: string;
  maxProjectSize: number;
  authRequired: boolean;
}
```

### 4. User Settings

Add UI for users to:
- Enable/disable ChatGPT integration
- View connected apps
- Manage permissions

## Migration Steps

### Step 1: Create Integration Package

```bash
cd anatator
mkdir -p src/integration/chatgpt
cp -r ../anotator8-chatgpt-integration-lab/src/shared/* src/integration/chatgpt/
cp -r ../anotator8-chatgpt-integration-lab/src/server/* src/integration/chatgpt/
```

### Step 2: Update Imports

```typescript
// Before (lab)
import { adapter } from './anotator8-adapter.js';

// After (Anotator8)
import { adapter } from '@integration/chatgpt/adapter.js';
```

### Step 3: Add Backend Routes

```typescript
// Express/Fastify
import { createChatGPTServer } from '@integration/chatgpt/server.js';

const mcpServer = createChatGPTServer();

// Mount MCP handlers
app.all('/mcp', async (req, res) => {
  await mcpServer.handleRequest(req.body, res);
});
```

### Step 4: Configure HTTPS

```typescript
// Production requires HTTPS
// Use existing Anotator8 TLS configuration
```

### Step 5: Add Tests

```bash
cp -r ../anotator8-chatgpt-integration-lab/tests/* tests/integration/chatgpt/
```

## Rollback Plan

If integration causes issues:

1. **Disable in config:** Set `chatgpt.enabled = false`
2. **Remove routes:** Delete `/mcp` endpoint
3. **Delete package:** Remove `src/integration/chatgpt/`
4. **Keep lab:** External lab remains usable independently

## Testing Checklist

- [ ] Adapter tests pass with Anotator8 data
- [ ] Server starts without errors
- [ ] Tools return correct responses
- [ ] Widget renders in ChatGPT
- [ ] Auth works correctly
- [ ] Large projects handled
- [ ] Invalid projects rejected
- [ ] Error messages user-friendly

## Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Large projects | Streaming/chunked processing |
| Many annotations | Pagination in find_annotations |
| Slow normalization | Caching normalized data |
| Concurrent requests | Connection pooling |

## Monitoring

Add to Anotator8 observability:
- MCP request count
- Error rate by tool
- Response time percentiles
- Active connections

## Known Limitations

After porting:

1. **Widget not full editor** - Review panel only, not annotation editing
2. **No real-time sync** - Project state from last export
3. **Limited to exported features** - Uses project file format

## Future Enhancements

After initial port:

1. **Direct project API** - Real-time project access (not just export)
2. **Write tools** - With approval flow
3. **Streaming responses** - For large projects
4. **Multi-project queries** - Across classroom projects

## Contact

For questions about porting:
- Review `docs/ARCHITECTURE.md` for structure
- Review `docs/SECURITY.md` for security model
- Check `tests/` for usage examples
