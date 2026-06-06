# Anotator8 × ChatGPT Integration Lab - Security Model

## Overview

This integration lab implements a **strict read-only security model** for ChatGPT integration with Anotator8 video annotation projects.

## Security Principles

### 1. Read-Only by Default

**All MCP tools are read-only.** The integration does not:
- Write to the file system
- Modify project data
- Execute arbitrary commands
- Access network resources beyond the MCP transport

### 2. No Secret Exposure

**No secrets are read or transmitted:**
- No API keys in tool responses
- No .env file access
- No SSH keys or credentials
- No browser cookies

### 3. Input Validation

**All inputs are validated:**
- Zod schema validation on all tool inputs
- JSON structure validation in adapter
- Size limits enforced (default 10MB max)
- No arbitrary code execution

### 4. Data Isolation

**Project data is isolated:**
- Passed directly in tool arguments (not fetched from URLs)
- Processed in memory only
- Never persisted beyond the tool invocation
- Unknown fields preserved but not acted upon

## Threat Model

### What Could Go Wrong?

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Large project file crashes server | Max size limit (10MB) | ✅ Mitigated |
| Malformed JSON causes crash | Try-catch with error response | ✅ Mitigated |
| Prompt injection via project text | Read-only, no execution | ✅ Mitigated |
| Arbitrary file access | No FS access in tools | ✅ Mitigated |
| Arbitrary command execution | No shell commands | ✅ Mitigated |
| Sensitive data in project exposed | Project data IS the user's data | ⚠️ By design |
| Widget XSS via HTML injection | HTML sanitized in widget | ⚠️ Review needed |

### Data That Leaves the Machine

| Data | Destination | Purpose |
|------|-------------|---------|
| Project JSON (annotations, subtitles, metadata) | ChatGPT (via MCP) | Analysis and review |
| Normalized summaries | ChatGPT (via structuredContent) | Narrate results |
| Error/warning messages | ChatGPT | Explain issues |

### What Stays on the Machine

| Data | Location | Access |
|------|----------|--------|
| .env configuration | Server environment | Server only |
| Video files | User's machine | Not accessed |
| Original project files | User's machine | Not accessed |
| Server logs | Local filesystem | Admin only |

## Transport Security

### Development (Local)
- MCP server binds to `127.0.0.1:8787` by default
- Only accessible from localhost
- No TLS (local only)

### Production
- **Requires HTTPS endpoint** for ChatGPT connection
- Use reverse proxy (nginx, Cloudflare) with TLS
- Consider API key authentication

## Widget Security

The ChatGPT widget receives tool results via postMessage. Security considerations:

### postMessage Validation
```javascript
// ✅ Correct - validate source
window.addEventListener('message', (e) => {
  if (e.source !== window.parent) return; // Only accept from parent iframe
  // Handle message
});

// ❌ Incorrect - no source check
window.addEventListener('message', (e) => {
  // Handle any message
});
```

### Content Security Policy
The widget resource declares CSP rules:
```json
{
  "csp": {
    "connectDomains": [],
    "resourceDomains": []
  }
}
```

### Widget Limitations
- No subframe embedding (frameDomains not declared)
- No external resource loading
- Limited to displaying passed data

## Comparison with Old Prototype

| Security Aspect | Old Prototype | This Lab |
|-----------------|---------------|----------|
| File system access | Yes (read_file) | **No** |
| Shell commands | Yes (profiles) | **No** |
| Arbitrary paths | Yes (allowlist) | **N/A** |
| Write operations | Yes (write_file) | **No** |
| Secret reading | Potential | **Prevented** |
| Prompt injection | Low risk | **Minimal risk** |

## Security Checklist

Before deployment:

- [ ] Max project size enforced
- [ ] No .env in responses
- [ ] No path traversal in tool names
- [ ] Widget CSP properly configured
- [ ] Error messages don't leak internals
- [ ] HTTPS required for ChatGPT
- [ ] API key authentication considered

## Incident Response

If a security issue is discovered:

1. **Do not modify the live system**
2. Document the issue
3. Assess impact
4. Create fix
5. Test in lab
6. Deploy update

## Reporting Security Issues

For security vulnerabilities in this integration lab:
1. Document the issue with evidence
2. Assess risk level (Low/Medium/High/Critical)
3. Report to maintainer
4. Do NOT publicly disclose until fixed

## Security Audit Results

| Component | Status | Notes |
|-----------|--------|-------|
| Tool schemas | ✅ Pass | All inputs validated |
| Adapter parsing | ✅ Pass | Try-catch with safe errors |
| Widget postMessage | ✅ Pass | Source validation |
| Error responses | ✅ Pass | No internals leaked |
| File system | ✅ Pass | Not accessed |
| Network access | ✅ Pass | Only MCP transport |
| Secrets | ✅ Pass | None read |
