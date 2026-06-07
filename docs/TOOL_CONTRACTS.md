# Tool Contracts

This document defines the input/output contracts for each MCP tool in the Anotator8 ChatGPT Integration Lab.

**Classification:**
- **R/W**: Read-write (mutates data) — requires user confirmation
- **R/O**: Read-only — safe to call without confirmation
- **N/A**: Not applicable

**REPO_EVIDENCE — sources verified against real Anotator8:**
| Concept | Source |
|---|---|
| `ProjectFilePayload` shape (version, videoUrl, videoSource, locale, classroomId, classroomName, subtitleTracks, subtitleCues, nodes) | `C:\Anotator8\src\application\services\projectFile.ts` |
| `VideoSource` discriminated union (local-file / direct-url / youtube / demo) | `C:\Anotator8\src\application\videoSources.ts` |
| YouTube URL patterns (watch, youtu.be, embed, shorts, live) | `C:\Anotator8\src\application\videoSources.ts` YOUTUBE_PATTERNS |
| `AppLocale` (en / ru / kk) | `C:\Anotator8\src\application\i18n\localeStore.ts` |
| `UDMNode` (id, type, spatial, temporal, visual, extensions, sync, parentId, fractionalIndex, createdAt, updatedAt, deletedAt, ownerId, classroomId?, isEducationRecord, dataResidency) | `C:\Anotator8\src\domain\entities\UDMNode.ts` |
| `NodeExtensions` (visual, studio, blocks, code) | same file |
| `VisualExtension.loroState` (v24.0 GA) | same file |
| `AnnotationType` (box, polygon, point, arrow, text, image, ellipse, chapter, highlight, comment, tag) | same file |
| Project filename extension `.anatator.json` (NOT `.anatator8.json`) | `C:\Anotator8\src\application\services\projectFile.ts` `PROJECT_FILE_EXTENSION` |
| `SyncMetadata` is required in real UDMNode; lab adapter degrades gracefully | same file |

> **Note on filename:** The lab's primary fixture is `sample-project.anatator8.json` for backwards-compat with the existing test suite. The real Anotator8 export format is `.anatator.json`. The adapter parses both correctly.

---

## Tool: `list_capabilities`

| Property | Value |
|----------|-------|
| Purpose | Enumerate all supported features and limitations |
| R/W | R/O |
| Cacheable | Yes (no input) |

### Input Schema

```json
{}
```

No input required.

### Output Schema

```json
{
  "supportedFeatures": ["string", "..."],
  "limitations": ["string", "..."],
  "annotationTypes": ["box", "ellipse", "arrow", "..."],
  "supportedSubtitleLanguages": ["en", "ru", "kk"]
}
```

### Errors

| Condition | Error Code | Notes |
|-----------|-----------|-------|
| Internal error | `INTERNAL_ERROR` | Returns error string, never stack trace |

---

## Tool: `inspect_project`

| Property | Value |
|----------|-------|
| Purpose | Analyze Anotator8 project JSON and return normalized summary |
| R/W | R/O |
| Max Input Size | 10MB (10,485,760 bytes as JSON string) |

### Input Schema

```json
{
  "projectData": "<Anotator8 project JSON — required>",
  "projectId": "<string — optional human-readable identifier>"
}
```

### Output Schema

```json
{
  "projectId": "string",
  "version": "string",
  "source": {
    "kind": "none | local | direct-url | youtube | unknown",
    "label": "string | undefined",
    "durationMs": "number | undefined",
    "warnings": [
      { "code": "string", "message": "string", "severity": "info | warning | error" }
    ]
  },
  "stats": {
    "totalAnnotations": "number",
    "annotationTypes": { "<type>": "number" },
    "shapeTypes": { "<shape>": "number" },
    "subtitleCueCount": "number",
    "hasTemporalData": "boolean",
    "hasVisualExtensions": "boolean"
  },
  "rawSummary": {
    "nodeCount": "number",
    "trackCount": "number",
    "version": "string"
  },
  "warnings": [
    { "code": "string", "message": "string", "severity": "string" }
  ]
}
```

### Errors

| Condition | Error Code | Notes |
|-----------|-----------|-------|
| projectData not an object | `PARSE_ERROR` | "Project file must be an object" |
| nodes array missing | `PARSE_ERROR` | "Project file must contain a 'nodes' array" |
| Data exceeds 10MB | `SIZE_LIMIT_EXCEEDED` | "Project data exceeds maximum size of X bytes" |
| Internal error | `INTERNAL_ERROR` | Safe error message only |

### Warnings (non-fatal, returned in `warnings` array)

| Code | Severity | Meaning |
|------|---------|---------|
| `NO_SOURCE` | info | No video source configured |
| `INFERRED_SOURCE` | info | Video source inferred from videoUrl field |
| `UNKNOWN_SOURCE_KIND` | warning | Video source kind not recognized |
| `NODES_SKIPPED` | info | Some nodes skipped due to limits or errors |

---

## Tool: `validate_project`

| Property | Value |
|----------|-------|
| Purpose | Check project data consistency without normalizing |
| R/W | R/O |

### Input Schema

```json
{
  "projectData": "<Anotator8 project JSON — required>"
}
```

### Output Schema

```json
{
  "valid": "boolean — true if no errors",
  "errors": [
    { "code": "string", "message": "string", "severity": "error" }
  ],
  "warnings": [
    { "code": "string", "message": "string", "severity": "warning" }
  ],
  "checks": [
    {
      "name": "string — human-readable check name",
      "passed": "boolean",
      "message": "string | undefined"
    }
  ]
}
```

### Validation Checks Performed

| Check | Error/Warning | Trigger |
|-------|--------------|---------|
| Valid JSON structure | error | Cannot parse payload |
| All nodes have IDs | error | Any node with missing/empty ID |
| Valid time ranges | warning | Any annotation with endTime < startTime |
| Spatial bounds valid | warning | Any annotation with x/y/width/height out of [0, 1] |
| Subtitle cue track references | warning | Any cue referencing non-existent track |
| Subtitle cue times valid | error | Any cue with endTime <= startTime |

### Errors

| Condition | Error Code |
|-----------|-----------|
| Cannot parse JSON | `PARSE_ERROR` |
| Nodes without IDs | `MISSING_NODE_ID` |
| Invalid cue time | `INVALID_CUE_TIME` |

---

## Tool: `summarize_annotations`

| Property | Value |
|----------|-------|
| Purpose | Generate statistics about annotation distribution |
| R/W | R/O |

### Input Schema

```json
{
  "projectData": "<Anotator8 project JSON — required>"
}
```

### Output Schema

```json
{
  "total": "number",
  "byType": { "<annotationType>": "number" },
  "byShape": { "<shapeType>": "number" },
  "temporalDistribution": {
    "start": "number — earliest annotation start in ms",
    "end": "number — latest annotation end/start in ms",
    "range": "number — end - start in ms"
  },
  "visualSummary": {
    "uniqueColors": "number",
    "opaqueCount": "number — annotations with opacity >= 1",
    "transparentCount": "number — annotations with transparent fill"
  }
}
```

---

## Tool: `find_annotations`

| Property | Value |
|----------|-------|
| Purpose | Query and filter annotations by criteria |
| R/W | R/O |
| Max Results | 100 (default: 50) |

### Input Schema

```json
{
  "projectData": "<Anotator8 project JSON — required>",
  "filters": {
    "type": "box | ellipse | arrow | polygon | point | text | highlight | comment | tag | undefined",
    "shapeType": "rect | circle | polygon | arrow | freehand | undefined",
    "timeRange": { "startMs": "number", "endMs": "number" } | undefined,
    "hasText": "boolean | undefined",
    "color": "string (hex) | undefined"
  } | undefined,
  "limit": "number (1-100, default: 50)"
}
```

### Output Schema

```json
{
  "matches": [
    {
      "id": "string",
      "type": "string",
      "shapeType": "string",
      "spatial": { "x": "number", "y": "number", "width": "number", "height": "number" },
      "temporal": { "startMs": "number", "endMs": "number | null" },
      "text": "string | undefined"
    }
  ],
  "total": "number — total matches (may exceed limit)",
  "filters": "object — echo of input filters"
}
```

### Filter Behavior

- `timeRange`: Returns annotations that overlap with the given range (not exact match)
- `hasText`: True → only annotations with `textContent`, False → only without
- `color`: Exact match on hex color (case-insensitive)

---

## Tool: `create_review_plan`

| Property | Value |
|----------|-------|
| Purpose | Generate a structured manual review checklist |
| R/W | R/O |

### Input Schema

```json
{
  "projectData": "<Anotator8 project JSON — required>"
}
```

### Output Schema

```json
{
  "sections": [
    {
      "title": "string",
      "checks": [
        {
          "description": "string",
          "priority": "high | medium | low",
          "type": "issue | suggestion | verification"
        }
      ]
    }
  ],
  "estimatedTime": "string — e.g., '10-20 minutes'"
}
```

### Priority Meanings

| Priority | When to use |
|----------|------------|
| high | Must verify before using project |
| medium | Recommended review step |
| low | Optional check or informational |

### Type Meanings

| Type | Meaning |
|------|---------|
| issue | A problem that needs to be fixed |
| suggestion | A recommended improvement |
| verification | A check to confirm correctness |

---

## Tool: `export_chatgpt_report`

| Property | Value |
|----------|-------|
| Purpose | Generate a portable report for use in ChatGPT |
| R/W | R/O |

### Input Schema

```json
{
  "projectData": "<Anotator8 project JSON — required>",
  "format": "markdown | json (default: markdown)",
  "includeUnknownFields": "boolean (default: false)"
}
```

### Output Schema

```json
{
  "format": "markdown | json",
  "content": "string — the report content",
  "filename": "string — suggested filename"
}
```

### Report Contents

**Markdown format includes:**
- Video source (kind, label, duration)
- Statistics (total annotations, subtitle cues, tracks)
- Annotation type breakdown
- Shape type breakdown
- Validation status (valid/invalid)
- Errors and warnings
- Validation check results table

**JSON format includes:**
- Full normalized project (version, source, stats, metadata)
- Validation result (valid, errors, warnings)
- First 100 annotations (to limit response size)
- Unknown fields (if `includeUnknownFields: true`)

---

## Error Response Format

All tools return errors in the following format:

```json
{
  "structuredContent": { "error": "Safe error message" },
  "content": [{ "type": "text", "text": "Error: Safe error message" }],
  "_meta": {}
}
```

**Error messages are sanitized** — internal file paths, stack traces, and server details are stripped before being returned to ChatGPT.

---

## Stability Guarantee

These contracts are **stable** for the current major version (0.x):
- Required input fields will not be removed
- New optional fields may be added to outputs
- Error codes will not be removed or changed without a major version bump

If a contract must change in a breaking way, it will be documented in `CHANGELOG.md`.
