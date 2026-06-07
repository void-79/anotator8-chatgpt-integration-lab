# Tool Contracts

Every tool returns `structuredContent` with:

```json
{ "ok": true, "error": null }
```

or:

```json
{ "ok": false, "error": { "code": "invalid_input", "message": "..." } }
```

Errors use: `invalid_input`, `unsupported_project_version`, `too_large_input`, `missing_field`, `internal_error`, `unsupported_capability`.

| Tool | Read/write | Input schema | Output schema | Errors | Tests |
| --- | --- | --- | --- | --- | --- |
| `list_capabilities` | read | empty object | features, limitations, annotation types, fixture ids | internal error | contract |
| `inspect_project` | read | `projectData` or `fixtureId`, optional `projectId` | version, source, stats, warnings, unsupported fields | missing field, invalid input, too large | integration, smoke |
| `validate_project` | read | `projectData` or `fixtureId` | valid/errors/warnings/checks | missing field, invalid input, too large | unit, integration |
| `summarize_annotations` | read | `projectData` or `fixtureId` | counts by type/shape/label and temporal distribution | missing field, invalid input, too large | contract |
| `find_annotations` | read | `projectData` or `fixtureId`, optional filters and limit | matches, total, truncation state | missing field, invalid input, too large | integration, smoke |
| `suggest_labels` | read | `projectData` or `fixtureId`, optional `includeAlreadyLabeled` | review suggestions; no invented labels | missing field, invalid input, too large | contract |
| `create_review_plan` | read | `projectData` or `fixtureId`, optional focus | detected problems, suggestions, checklist | missing field, invalid input, too large | contract |
| `export_chatgpt_report` | read | `projectData` or `fixtureId`, format, unknown-fields flag | Markdown/JSON content and filename | missing field, invalid input, too large | smoke |

## Example

```json
{
  "name": "inspect_project",
  "arguments": { "fixtureId": "sample-project" }
}
```

Returns a normalized summary. It does not read Anotator8 local files, decode media, or mutate data.
