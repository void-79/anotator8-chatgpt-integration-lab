import { readFile } from "node:fs/promises";
import { createHttpMcpApp } from "../src/server/app.js";
import { adapter } from "../src/server/anotator8-adapter.js";

type RpcResponse = { result?: unknown; error?: unknown };

async function rpc(url: string, body: unknown, sessionId?: string): Promise<{ json: RpcResponse; sessionId?: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "accept": "application/json, text/event-stream",
      "content-type": "application/json",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: RpcResponse = {};
  if (text.trim()) {
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      const dataLine = text.split(/\r?\n/).find((line) => line.startsWith("data: "));
      json = dataLine ? JSON.parse(dataLine.slice(6)) as RpcResponse : {};
    } else {
      json = JSON.parse(text) as RpcResponse;
    }
  }
  return { json, sessionId: response.headers.get("mcp-session-id") ?? sessionId };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const evidence: string[] = [];
  const fixtureRaw = await readFile("fixtures/sample-project.anotator8.json", "utf8");
  const fixture = JSON.parse(fixtureRaw) as unknown;
  evidence.push(`fixture bytes=${fixtureRaw.length}`);

  const normalized = adapter.normalize(fixture);
  assert(normalized.annotations.length === 3, "fixture should normalize three annotations");
  assert(Object.keys(normalized.unknownFields).includes("futureReviewState"), "unknown future field should be preserved");
  evidence.push(`adapter annotations=${normalized.annotations.length} unknownFields=${Object.keys(normalized.unknownFields).length}`);

  const validation = adapter.validate(fixture);
  assert(validation.warnings.some((warning) => warning.code === "ORPHANED_SUBTITLE_CUE"), "fixture should contain deterministic orphan cue warning");
  evidence.push(`validation valid=${validation.valid} warnings=${validation.warnings.length}`);

  const { httpServer } = createHttpMcpApp();
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  assert(address && typeof address === "object", "server should have a bound address");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const url = `${baseUrl}/mcp`;
  evidence.push(`server url=${url}`);

  try {
    // OAuth 2.0 Protected Resource Metadata (RFC 9728). Verify the
    // well-known endpoint is served and the `resource` field round-trips.
    const wellKnownRes = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
    assert(wellKnownRes.status === 200, `well-known should be 200, got ${wellKnownRes.status}`);
    assert(
      wellKnownRes.headers.get("content-type")?.includes("application/json"),
      `well-known content-type should be json, got ${wellKnownRes.headers.get("content-type")}`,
    );
    const wellKnownDoc = (await wellKnownRes.json()) as { resource: string; bearer_methods_supported?: string[] };
    assert(typeof wellKnownDoc.resource === "string" && wellKnownDoc.resource.endsWith("/mcp"),
      `well-known resource field should end with /mcp, got ${wellKnownDoc.resource}`);
    assert(Array.isArray(wellKnownDoc.bearer_methods_supported) && wellKnownDoc.bearer_methods_supported.includes("header"),
      "well-known should declare header as a supported bearer method");
    evidence.push(`oauth resource=${wellKnownDoc.resource} bearer=${wellKnownDoc.bearer_methods_supported.join(",")}`);

    const init = await rpc(url, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "smoke", version: "0.1.0" },
      },
    });
    assert(!init.json.error, `initialize failed: ${JSON.stringify(init.json.error)}`);
    assert(init.sessionId, "initialize should return mcp-session-id");
    evidence.push(`initialize session=${init.sessionId}`);

    await rpc(url, { jsonrpc: "2.0", method: "notifications/initialized", params: {} }, init.sessionId);

    const tools = await rpc(url, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, init.sessionId);
    const toolList = (tools.json.result as { tools?: Array<{ name: string }> }).tools ?? [];
    const names = toolList.map((tool) => tool.name);
    for (const required of ["inspect_project", "validate_project", "find_annotations", "export_chatgpt_report"]) {
      assert(names.includes(required), `missing registered tool ${required}`);
    }
    evidence.push(`tools=${names.join(",")}`);

    const inspect = await rpc(
      url,
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "inspect_project", arguments: { fixtureId: "sample-project" } } },
      init.sessionId,
    );
    const inspectContent = (inspect.json.result as { structuredContent?: Record<string, unknown> }).structuredContent;
    assert(inspectContent?.ok === true, "inspect_project should return ok=true");
    evidence.push(`inspect=${JSON.stringify(inspectContent?.stats)}`);

    const report = await rpc(
      url,
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "export_chatgpt_report", arguments: { fixtureId: "sample-project", format: "markdown" } } },
      init.sessionId,
    );
    const reportContent = (report.json.result as { structuredContent?: { content?: string } }).structuredContent;
    const reportText = reportContent?.content;
    assert(typeof reportText === "string" && reportText.includes("Anotator8 ChatGPT Review Report"), "report export should include report title");
    assert(!reportText.includes(".env") && !reportText.includes("SSH"), "report should not expose secret file names");
    evidence.push(`report chars=${reportText.length}`);
  } finally {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }

  console.log("SMOKE PASS");
  for (const line of evidence) console.log(line);
}

main().catch((error) => {
  console.error("SMOKE FAIL");
  console.error(error);
  process.exit(1);
});
