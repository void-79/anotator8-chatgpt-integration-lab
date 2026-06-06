# Anotator8 × ChatGPT Integration Lab - Architecture

## Overview

This integration lab provides a **read-only MCP server** that enables ChatGPT to analyze and review Anotator8 video annotation projects. It is designed as an **external laboratory** that can be tested independently before porting into Anotator8.

```
┌─────────────────────────────────────────────────────────────┐
│                        ChatGPT                               │
│  (User prompts → Model decides → Calls MCP tools)           │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTPS / Secure MCP Tunnel
                  ▼
┌─────────────────────────────────────────────────────────────┐
│         Anotator8 ChatGPT Integration Lab                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              MCP Server (@modelcontextprotocol/sdk)   │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│  │  │ inspect │ │validate │ │summarize│ │  find   │   │   │
│  │  │_project │ │_project │ │_annotations│ │_annotations│ │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐              │   │
│  │  │ list_   │ │ create_ │ │ export_ │              │   │
│  │  │capabilities│ │review_plan│ │chatgpt_report│              │   │
│  │  └─────────┘ └─────────┘ └─────────┘              │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │           Anotator8 Adapter Layer                   │   │
│  │  - Parse raw .anatator.json                         │   │
│  │  - Normalize to integration model                   │   │
│  │  - Validate consistency                            │   │
│  │  - Preserve unknown fields                         │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │              Fixtures / Test Data                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. MCP Server (`src/server/index.ts`)

Built using `@modelcontextprotocol/sdk` and `@modelcontextprotocol/ext-apps` for ChatGPT Apps compatibility.

**Responsibilities:**
- Register all MCP tools with Zod schemas
- Handle tool invocation requests
- Return structured responses (`structuredContent`, `content`, `_meta`)
- Register widget resource for ChatGPT UI

**Tool Registry:**
| Tool | Purpose | Read/Write |
|------|---------|------------|
| `list_capabilities` | Show available features | Read |
| `inspect_project` | Analyze project structure | Read |
| `validate_project` | Check data consistency | Read |
| `summarize_annotations` | Generate annotation stats | Read |
| `find_annotations` | Search/filter annotations | Read |
| `create_review_plan` | Generate review checklist | Read |
| `export_chatgpt_report` | Create portable report | Read |

### 2. Anotator8 Adapter (`src/server/anotator8-adapter.ts`)

**Responsibilities:**
- Parse raw Anotator8 project JSON
- Normalize to stable integration model
- Validate data consistency
- Compute statistics
- Preserve unknown fields

**Key Types:**
```typescript
interface NormalizedProject {
  version: string;
  source: NormalizedVideoSource;
  annotations: NormalizedAnnotation[];
  subtitleTracks: NormalizedSubtitleTrack[];
  timelineTracks: NormalizedTimelineTrack[];
  metadata: { locale?, classroomId?, classroomName? };
  unknownFields: Record<string, unknown>;
  warnings: IntegrationWarning[];
  stats: Statistics;
}
```

### 3. Shared Types (`src/shared/types.ts`)

TypeScript type definitions for:
- Anotator8 domain types (UDMNode, VideoSource, etc.)
- Integration model types
- Tool result types

### 4. Fixtures (`fixtures/`)

Sample Anotator8 project data for testing:
- `sample-project.anatator8.json` - Full demo project with annotations, subtitles

## Data Flow

### Tool Invocation Flow

```
1. User: "Analyze my Anotator8 project"
        ↓
2. ChatGPT Model receives prompt
        ↓
3. Model decides to call inspect_project tool
        ↓
4. MCP request → MCP Server
        ↓
5. Server passes project data to Adapter
        ↓
6. Adapter.normalizes() → NormalizedProject
        ↓
7. Server builds structuredContent response
        ↓
8. MCP response → ChatGPT
        ↓
9. Model narrates results to user
```

### Adapter Normalization Flow

```
Raw .anatator.json
    ↓
Parse payload (validate structure)
    ↓
Normalize video source
    ↓
Normalize annotations (UDMNode → NormalizedAnnotation)
    ↓
Normalize subtitle tracks
    ↓
Build timeline tracks
    ↓
Compute statistics
    ↓
NormalizeProject (stable output)
```

## Security Model

**Read-only by design:**
- No file system access
- No project mutation
- No arbitrary command execution
- Project data passed directly in tool arguments

**Input validation:**
- Zod schema validation on all inputs
- Adapter validates data consistency
- Warnings generated for non-critical issues
- Errors generated for critical issues

## Widget Integration

The MCP server registers a ChatGPT widget resource (`ui://widget/anotator8-widget.html`) that can display:
- Project summary stats
- Warnings and errors
- Review status

The widget receives tool results via the MCP Apps bridge (`ui/notifications/tool-result`).

## Testing Strategy

### Unit Tests (`tests/unit/`)
- Adapter normalization
- Schema validation
- Edge cases

### Integration Tests (`tests/integration/`)
- Full tool invocations
- End-to-end flows

### Smoke Test (`npm run smoke`)
- Server starts correctly
- Fixture loads
- Basic operations work

## Future Extension Points

1. **Write Tools** (when ready):
   - `propose_annotation_changes` - Return patch proposals
   - `apply_annotation_patch` - Apply approved patches

2. **Widget Enhancements**:
   - Interactive annotation browser
   - Visual timeline editor

3. **Anotator8 Porting**:
   - Move adapter to shared package
   - Integrate MCP server into Anotator8 backend
   - Expose project data via internal API

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^1.29.0",
  "@modelcontextprotocol/ext-apps": "^1.7.4",
  "express": "^4.19.0",
  "zod": "^3.23.8"
}
```

## Configuration

Environment variables (`.env`):
```bash
ANOTATOR8_PROJECT_PATH=./fixtures/sample-project.anatator8.json
MCP_HOST=127.0.0.1
MCP_PORT=8787
MAX_PROJECT_SIZE=10485760
MAX_ANNOTATIONS_SUMMARY=1000
```
