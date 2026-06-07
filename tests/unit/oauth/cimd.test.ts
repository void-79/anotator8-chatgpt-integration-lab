import { describe, expect, it } from "vitest";
import { CimdResolver, CimdResolveError } from "../../../src/server/oauth/cimd.js";

function makeJsonResponder(payload: unknown, status = 200, contentType = "application/json"): typeof fetch {
  return (async (_url: string | URL | Request) => {
    return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), {
      status,
      headers: { "content-type": contentType },
    });
  }) as typeof fetch;
}

describe("oauth/cimd — Client ID Metadata Documents", () => {
  it("rejects client_id that is not a valid URL", async () => {
    const r = new CimdResolver({ allowInsecureHttp: false, allowlistHostnames: [] });
    await expect(r.resolve("not-a-url")).rejects.toThrow(CimdResolveError);
  });

  it("rejects http:// client_id when allowInsecureHttp is false", async () => {
    const r = new CimdResolver({ allowInsecureHttp: false, allowlistHostnames: [] });
    await expect(r.resolve("http://app.example.com/")).rejects.toThrow(/https/);
  });

  it("accepts https:// client_id and resolves metadata", async () => {
    const r = new CimdResolver({
      allowInsecureHttp: false,
      allowlistHostnames: [],
      fetchImpl: makeJsonResponder({
        client_name: "Test Client",
        redirect_uris: ["https://app.example.com/cb"],
      }),
    });
    const reg = await r.resolve("https://app.example.com/");
    expect(reg.client_id).toBe("https://app.example.com/");
    expect(reg.client_name).toBe("Test Client");
    expect(reg.redirect_uris).toEqual(["https://app.example.com/cb"]);
  });

  it("rejects empty/missing redirect_uris", async () => {
    const r = new CimdResolver({
      allowInsecureHttp: false,
      allowlistHostnames: [],
      fetchImpl: makeJsonResponder({ client_name: "x" }),
    });
    await expect(r.resolve("https://app.example.com/")).rejects.toThrow(/redirect_uris/);
  });

  it("rejects non-JSON content-type", async () => {
    const r = new CimdResolver({
      allowInsecureHttp: false,
      allowlistHostnames: [],
      fetchImpl: makeJsonResponder("<html/>", 200, "text/html"),
    });
    await expect(r.resolve("https://app.example.com/")).rejects.toThrow(/JSON/);
  });

  it("rejects non-200 response", async () => {
    const r = new CimdResolver({
      allowInsecureHttp: false,
      allowlistHostnames: [],
      fetchImpl: makeJsonResponder({ error: "x" }, 404),
    });
    await expect(r.resolve("https://app.example.com/")).rejects.toThrow(/HTTP 404/);
  });

  it("rejects redirect responses (CIMD must not redirect)", async () => {
    const r = new CimdResolver({
      allowInsecureHttp: false,
      allowlistHostnames: [],
      fetchImpl: makeJsonResponder({}, 302),
    });
    await expect(r.resolve("https://app.example.com/")).rejects.toThrow(/redirect/);
  });

  it("enforces the hostname allowlist when configured", async () => {
    const r = new CimdResolver({
      allowInsecureHttp: false,
      allowlistHostnames: ["trusted.example.com"],
      fetchImpl: makeJsonResponder({ redirect_uris: ["https://app/cb"] }),
    });
    await expect(r.resolve("https://app.example.com/")).rejects.toThrow(/allowlist/);
  });

  it("caches a successful resolution for the TTL", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ redirect_uris: ["https://app/cb"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const r = new CimdResolver({ allowInsecureHttp: false, allowlistHostnames: [], fetchImpl, cacheTtlSeconds: 60 });
    await r.resolve("https://app/cb");
    await r.resolve("https://app/cb");
    await r.resolve("https://app/cb");
    expect(calls).toBe(1);
  });

  it("clearCache forces a re-fetch", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ redirect_uris: ["https://app/cb"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const r = new CimdResolver({ allowInsecureHttp: false, allowlistHostnames: [], fetchImpl });
    await r.resolve("https://app/cb");
    r.clearCache();
    await r.resolve("https://app/cb");
    expect(calls).toBe(2);
  });
});
