# ChatGPT App Setup

## Local

```powershell
npm install
npm run dev
```

Local MCP endpoint:

```text
http://127.0.0.1:8787/mcp
```

Localhost is useful for MCP Inspector, not direct ChatGPT connection.

## MCP Inspector

```powershell
npm run dev
npm run inspect
```

In Inspector, use:

```json
{ "fixtureId": "sample-project" }
```

for `inspect_project`, `validate_project`, and other fixture-aware tools.

## ChatGPT Developer Mode

Based on OpenAI Apps SDK docs:

1. Expose the MCP endpoint over HTTPS. Use Secure MCP Tunnel, ngrok, Cloudflare Tunnel, or deployment.
2. Set `MCP_AUTH_TOKEN` at minimum for demos; production needs OAuth 2.1.
3. In ChatGPT, enable Developer Mode in Settings -> Apps & Connectors -> Advanced settings.
4. Create a connector.
5. Use connector URL:

```text
https://your-public-host.example/mcp
```

6. Confirm ChatGPT lists these tools:

```text
list_capabilities
inspect_project
validate_project
summarize_annotations
find_annotations
suggest_labels
create_review_plan
export_chatgpt_report
```

7. Test a golden prompt:

```text
Use the Anotator8 connector. Inspect fixture sample-project, validate it, summarize annotations, and create a review plan focused on subtitles.
```

## Production Auth Gap

This lab has optional bearer auth only. Before real deployment with user/customer/student project data, implement OAuth 2.1 protected resource metadata and token scope enforcement.
