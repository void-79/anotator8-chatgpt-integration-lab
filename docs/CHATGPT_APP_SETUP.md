# ChatGPT App Setup Guide

## Overview

This guide explains how to connect the Anotator8 ChatGPT Integration Lab to ChatGPT using the MCP (Model Context Protocol) protocol. Two connection methods are supported:

1. **ChatGPT Developer Mode** (recommended for development) — free with Plus/Pro, connects to any MCP server via HTTPS URL
2. **ChatGPT Apps SDK** (production, Oct 2025 launch) — publish an app in the ChatGPT Store

## Prerequisites

- ChatGPT Plus, Pro, Business, or Enterprise subscription (Developer Mode)
- Node.js ≥ 20
- Public HTTPS endpoint for the MCP server (or ngrok/cloudflared for local dev)

## Method 1: ChatGPT Developer Mode (Recommended for Dev)

### Step 1: Deploy the MCP Server

**Option A: Local with Cloudflare Tunnel (free, no server needed)**

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -o cloudflared.exe

# In one terminal: start the MCP server
cd anotator8-chatgpt-integration-lab
npm install
npm run dev

# In another terminal: create the tunnel
cloudflared tunnel --url http://localhost:8787
# → Copy the .trycloudflare.com URL
```

**Option B: Local with ngrok (free account required)**

```bash
ngrok config add-authtoken <YOUR_TOKEN>
ngrok http 8787
# → Copy the https://*.ngrok.io URL
```

**Option C: Deploy to a VPS (production)**

```bash
# On your VPS
git clone <repo>
cd anotator8-chatgpt-integration-lab
npm install --production
npm run build
MCP_HOST=0.0.0.0 MCP_PORT=8787 npm start
```

### Step 2: Configure Authentication (Recommended)

Generate a secure Bearer token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to your `.env`:

```bash
MCP_AUTH_TOKEN=<generated-token>
```

### Step 3: Connect in ChatGPT

1. Open ChatGPT (chatgpt.com)
2. Go to **Settings → Developer** (or **Settings → Beta → Developer mode**)
3. Toggle **Developer mode** to ON
4. Click **Add MCP Server**
5. Enter your server URL:
   - If using auth: `https://your-tunnel.trycloudflare.com/mcp`
   - With token: you'll need to provide the Bearer token separately
6. Click **Connect**

### Step 4: Verify Connection

In ChatGPT, type:

```
Use list_capabilities to show me what you can do with Anotator8 projects.
```

You should see a capabilities list. If you see a connection error, check:
- The server is running (`npm run dev`)
- The tunnel URL is correct and HTTPS
- The auth token matches your `.env`

## Method 2: ChatGPT Apps (Production)

*Note: ChatGPT Apps require publishing to the ChatGPT Store. This method is for production deployment.*

### Prerequisites

- ChatGPT App developer account (requires approval)
- Your MCP server deployed with HTTPS and authentication

### Build Your App

1. Create a manifest file (`manifest.json`) in `public/`:
   ```json
   {
     "name": "Anotator8 Review Assistant",
     "description": "Analyze and review Anotator8 video annotation projects",
     "serverUrl": "https://your-mcp-server.com/mcp",
     "categories": ["Productivity", "Education"],
     "icon": "/icon-512.png"
   }
   ```

2. Deploy your app with the manifest accessible at the root URL

3. Submit to ChatGPT Store for review

### App Review Notes

The ChatGPT team reviews apps for:
- Data privacy (what data is sent to your server)
- Clear user consent for data sharing
- Security of your MCP server
- Quality of tool descriptions

**Important:** The Anotator8 integration sends project JSON (annotations, subtitles, metadata) to ChatGPT. You must disclose this in your app's privacy policy.

## Security Considerations

### What Data is Shared

| Data | Sent to ChatGPT | Notes |
|------|-----------------|-------|
| Project JSON (annotations, subtitles, metadata) | ✅ Yes | Only when you explicitly call a tool |
| Video files | ❌ No | Never uploaded |
| File system | ❌ No | Server has no file access |
| Original project files | ❌ No | Data is passed in tool arguments |

### Protecting Your Server

1. **Always use HTTPS** — never HTTP
2. **Set `MCP_AUTH_TOKEN`** — prevents unauthorized access
3. **Rate limiting** — already configured (100 req/min per IP)
4. **Keep the token secret** — never commit `.env` to git

### Data Privacy

When using ChatGPT Developer Mode, project data is processed by OpenAI's servers as part of the ChatGPT conversation. This is the same as any other ChatGPT conversation.

For enterprise deployments, consider:
- ChatGPT Enterprise (data not used for training)
- Deploying a private MCP server on your own infrastructure
- Using MCP's OAuth 2.0 support for fine-grained access control

## Testing Without ChatGPT

### MCP Inspector (Protocol Testing)

```bash
npx @modelcontextprotocol/inspector \
  --name "Anotator8 Lab" \
  --command "npm" \
  --args '["run", "dev"]' \
  --cwd "$(pwd)"
```

Or test against an already-running server:

```bash
npx @modelcontextprotocol/inspector \
  --url http://localhost:8787/mcp
```

### Smoke Test

```bash
npm run smoke
# → 6/6 checks pass
```

### Unit Tests

```bash
npm test
# → All tests pass
```

## Troubleshooting

### "Connection refused" or timeout

- Check the server is running: `curl http://localhost:8787/health`
- Check the tunnel is active and the URL is HTTPS
- Check firewall rules allow outbound connections on the tunnel port

### "Invalid session ID" errors

- Make sure you're using the same session ID for all requests in a conversation
- The MCP session ID is set by ChatGPT in the `mcp-session-id` header

### Tools not appearing in ChatGPT

- Verify Developer Mode is enabled in Settings
- Try refreshing the ChatGPT page
- Check the browser console for connection errors

### Auth errors (401/403)

- Make sure `MCP_AUTH_TOKEN` is set in `.env`
- When connecting, ensure the token is provided in the Authorization header
- The token format should be: `Bearer <your-token>`

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MCP_HOST` | No | `127.0.0.1` | Host to bind |
| `MCP_PORT` | No | `8787` | Port to listen on |
| `MCP_AUTH_TOKEN` | No | — | Bearer token for auth |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window (ms) |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origin |

## Production Checklist

- [ ] Server deployed with HTTPS
- [ ] `MCP_AUTH_TOKEN` set with a secure random token
- [ ] Rate limiting configured for expected usage
- [ ] Health endpoint (`/health`) monitored
- [ ] Logs being collected
- [ ] Server restarted automatically on crash (systemd, pm2, Docker)
- [ ] Domain pointed to server with TLS certificate
- [ ] Data privacy policy updated if publishing as App
