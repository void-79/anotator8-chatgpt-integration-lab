# Official Docs Research

## Official Docs Research

| Source | Key findings | Architecture implications | Security notes |
|--------|--------------|------------------------|----------------|
| **OpenAI Developer Mode** | Full MCP client support; SSE/Streamable HTTP; Plus/Pro/Business/Enterprise | MCP server needs SSE transport; Developer Mode for custom connectors | Write tools require confirmation; `readOnlyHint` annotation critical |
| **Apps SDK** | MCP-based + proprietary widget layer; UI via postMessage; MCP Apps bridge | Can use standard MCP OR Apps SDK extras; Widget is optional | CSP rules required; structuredContent for model |
| **MCP Protocol Spec** | JSON-RPC 2.0; tools/list, tools/call; annotations for readOnlyHint; outputSchema support | Server must declare `capabilities.tools`; All tools need proper schema | Human-in-loop required; Validate all inputs |
| **MCP TypeScript SDK** | @modelcontextprotocol/sdk + @modelcontextprotocol/ext-apps; Zod v3 for schemas; McpServer class | Use official SDK not raw implementation; Zod for validation | SDK handles protocol complexity |
| **ChatGPT Apps** | October 2025 launch; Widget iframe via MCP Apps bridge; structuredContent pattern | Widget is iframe inside ChatGPT; Communication via postMessage | CSP, domain required for widget |

## Key Architectural Patterns

### 1. MCP Server Structure
```
McpServer (name, version)
  ├── capabilities: { tools: { listChanged: true } }
  ├── instructions (server-wide guidance)
  └── tools
      ├── name, title, description
      ├── inputSchema (Zod)
      ├── outputSchema (Zod)
      └── annotations: { readOnlyHint, openWorldHint, destructiveHint }
```

### 2. Tool Response Pattern
```typescript
{
  content: [{ type: 'text', text: JSON.stringify(data) }],
  structuredContent: data,  // For model + widget
  _meta: { warnings: [] }   // Widget-only data
}
```

### 3. Developer Mode Setup
- Settings → Apps → Advanced → Developer mode
- Create app from MCP URL (SSE endpoint)
- OAuth / No Auth / Mixed Auth supported
- Tools appear in Developer Mode menu during conversation

### 4. ChatGPT MCP Transport
- **Required**: HTTPS endpoint
- **Protocol**: SSE or Streamable HTTP
- **Testing**: MCP Inspector (`npx @modelcontextprotocol/inspector`)

## Security Model (Official)

### Read-Only Detection
- `readOnlyHint: true` → treated as read-only
- Missing annotation → treated as write (requires confirmation)

### User Confirmation
- Write tools show full JSON input/output
- User can "remember" approve/deny per conversation
- New conversation → re-prompt

### Prompt Injection
- Users warned about injection risks
- Model can make mistakes on write actions
- Always review tool input before confirming

## Tool Schema Requirements

### Input Schema
```typescript
{
  name: 'tool_name',
  title: 'Human Readable Title',
  description: 'Use this when...',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: '...' }
    },
    required: ['param1']
  }
}
```

### Annotations
```typescript
{
  annotations: {
    readOnlyHint: true,     // Read-only tool
    openWorldHint: false,   // Only affects bounded target
    destructiveHint: false  // No irreversible changes
  }
}
```

## Widget (Apps SDK)

### Resource Registration
- MIME type: `text/html;profile=mcp-app`
- Template URI: `ui://widget/widget-name.html`
- CSP rules: connectDomains, resourceDomains

### postMessage Bridge
- Method: `ui/notifications/tool-result`
- Receives: structuredContent, _meta
- Can call back: `tools/call`

## Connection Methods

| Method | Use Case | ChatGPT Support |
|--------|---------|----------------|
| stdio | Local development | Claude Desktop, some IDEs |
| SSE | Remote MCP server | ChatGPT Developer Mode ✓ |
| Streamable HTTP | Production | ChatGPT Developer Mode ✓ |

## Rate Limits / Quotas

- No explicit MCP limits documented
- ChatGPT conversation limits apply
- Consider streaming for large responses

## Important Dates

| Event | Date |
|-------|------|
| MCP launched by Anthropic | November 2024 |
| OpenAI joins MCP | March 27, 2025 |
| Apps SDK launched | October 6, 2025 |
| Developer Mode for MCP | September 11, 2025 |
| Current spec date | June 2025 |
