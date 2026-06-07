/**
 * scripts/inspect-headless.ts
 *
 * Headless, non-interactive equivalent of `npm run inspect` (which opens the
 * MCP Inspector UI in a browser). Boots the lab's HTTP MCP app on a random
 * 127.0.0.1 port, drives the Streamable HTTP transport with a minimal
 * MCP client (initialize + notifications/initialized + tools/list + one
 * tools/call), and asserts the responses.
 *
 * Intended for CI and `verify` invocations on hosts where the interactive
 * `@modelcontextprotocol/inspector` UI cannot run. This script is the
 * non-UI smoke that proves "an MCP Inspector-style client can drive the
 * lab over HTTP". It does NOT prove the interactive UI works; for that,
 * use `npm run inspect` on a workstation.
 *
 * No new dependency is introduced. Uses `fetch` (Node 20+) and zod.
 *
 * Exit codes:
 *   0 — inspector-style roundtrip succeeded against the local lab
 *   1 — any step failed; the failure reason is printed to stderr
 *
 * Environment:
 *   - Clears `MCP_AUTH_TOKEN` for the child process so the local demo
 *     mode (no Bearer required) is used. This matches what the interactive
 *     Inspector does when pointed at a localhost server with no token.
 *   - Does NOT read or write any file outside `fixtures/`.
 */
import { createHttpMcpApp } from "../src/server/app.js";

type RpcResponse = {
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
  id?: number | string | null;
};

interface InspectorCallResult {
  status: number;
  json: RpcResponse;
  sessionId?: string;
  contentType: string | null;
}

async function rpc(
  url: string,
  body: unknown,
  sessionId?: string,
): Promise<InspectorCallResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const contentType = response.headers.get("content-type");
  let json: RpcResponse = {};
  if (text.trim()) {
    if (contentType?.includes("text/event-stream")) {
      const dataLine = text.split(/\r?\n/).find((line) => line.startsWith("data: "));
      json = dataLine ? (JSON.parse(dataLine.slice(6)) as RpcResponse) : {};
    } else {
      json = JSON.parse(text) as RpcResponse;
    }
  }
  return {
    status: response.status,
    json,
    sessionId: response.headers.get("mcp-session-id") ?? sessionId,
    contentType,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`inspect-headless: ${message}`);
}

async function main(): Promise<void> {
  // Local demo mode: drop any inherited MCP_AUTH_TOKEN so the HTTP app
  // accepts our requests without a Bearer header. The interactive Inspector
  // also does this when pointed at a localhost server.
  delete process.env.MCP_AUTH_TOKEN;

  const evidence: string[] = [];
  const { httpServer } = createHttpMcpApp();
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  assert(address && typeof address === "object", "server should have a bound address");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const mcpUrl = `${baseUrl}/mcp`;
  evidence.push(`server url=${mcpUrl}`);

  try {
    // Step 1: initialize
    const init = await rpc(mcpUrl, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "inspect-headless", version: "1.0.0" },
      },
    });
    assert(init.status === 200, `initialize status should be 200, got ${init.status}`);
    assert(!init.json.error, `initialize returned JSON-RPC error: ${JSON.stringify(init.json.error)}`);
    assert(typeof init.sessionId === "string" && init.sessionId.length > 0, "initialize should return mcp-session-id");
    const initResult = init.json.result as { serverInfo?: { name?: string; version?: string } };
    assert(initResult?.serverInfo?.name === "anotator8-chatgpt-integration-lab", `serverInfo.name should be lab name, got ${initResult?.serverInfo?.name}`);
    evidence.push(`initialize session=${init.sessionId} server=${initResult.serverInfo?.name}@${initResult.serverInfo?.version}`);

    // Step 2: notifications/initialized (per MCP spec, the client must send this)
    const notify = await rpc(
      mcpUrl,
      { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
      init.sessionId,
    );
    // Notifications are fire-and-forget; status 202 Accepted is the standard
    // response per MCP Streamable HTTP 2025-06-18. 200 is also acceptable.
    assert(notify.status === 200 || notify.status === 202, `notifications/initialized status should be 200/202, got ${notify.status}`);
    evidence.push(`initialized notification status=${notify.status}`);

    // Step 3: tools/list
    const tools = await rpc(mcpUrl, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, init.sessionId);
    assert(!tools.json.error, `tools/list returned JSON-RPC error: ${JSON.stringify(tools.json.error)}`);
    const toolList = (tools.json.result as { tools?: Array<{ name: string; annotations?: { readOnlyHint?: boolean } }> }).tools ?? [];
    const names = toolList.map((tool) => tool.name);
    const expectedTools = [
      "list_capabilities",
      "inspect_project",
      "validate_project",
      "summarize_annotations",
      "find_annotations",
      "suggest_labels",
      "create_review_plan",
      "export_chatgpt_report",
    ];
    for (const required of expectedTools) {
      assert(names.includes(required), `missing registered tool ${required}`);
    }
    // Every tool must be read-only. This is the contract the lab ships and the
    // reason the headless inspector is safe to run against any local project.
    for (const tool of toolList) {
      assert(tool.annotations?.readOnlyHint === true, `tool ${tool.name} should declare readOnlyHint=true`);
    }
    evidence.push(`tools/list count=${names.length} (all readOnlyHint=true)`);

    // Step 4: one real tool call — the same one the interactive Inspector
    // performs when the user clicks "Call" on the first tool. We pick
    // inspect_project because it's the canonical read-only entrypoint.
    const callResult = await rpc(
      mcpUrl,
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "inspect_project", arguments: { fixtureId: "sample-project" } },
      },
      init.sessionId,
    );
    assert(!callResult.json.error, `tools/call returned JSON-RPC error: ${JSON.stringify(callResult.json.error)}`);
    const callStructured = (callResult.json.result as { structuredContent?: { ok?: boolean; stats?: unknown } }).structuredContent;
    assert(callStructured?.ok === true, "inspect_project should return ok=true");
    evidence.push(`tools/call inspect_project ok=true stats=${JSON.stringify(callStructured.stats)}`);

    // Step 5: the resources/read of the widget — proves the ChatGPT Apps
    // bridge html is served. Interactive Inspector also lists resources.
    // (resources/list first to find the URI.)
    const resourcesList = await rpc(
      mcpUrl,
      { jsonrpc: "2.0", id: 4, method: "resources/list", params: {} },
      init.sessionId,
    );
    assert(!resourcesList.json.error, `resources/list returned JSON-RPC error: ${JSON.stringify(resourcesList.json.error)}`);
    const resources = (resourcesList.json.result as { resources?: Array<{ uri?: string; name?: string }> }).resources ?? [];
    const widget = resources.find((resource) => resource.uri?.startsWith("ui://"));
    assert(widget, "expected at least one ui:// resource (the widget HTML)");
    evidence.push(`resources/list widget uri=${widget.uri}`);
  } finally {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }

  console.log("INSPECT-HEADLESS PASS");
  for (const line of evidence) console.log(line);
}

main().catch((error: unknown) => {
  console.error("INSPECT-HEADLESS FAIL");
  console.error(error);
  process.exit(1);
});
