/**
 * External mode: in-process AS endpoints must 404 with as_disabled.
 *
 * This is the v0.8.0 cutover seam — when `MCP_OAUTH_MODE=external` is
 * set, the lab is configured to validate tokens against a production
 * IdP's JWKS, and the in-process AS endpoints must be turned off so
 * clients fail fast and use the IdP instead.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHttpMcpApp } from "../../../src/server/app.js";

describe("oauth — external mode disables in-process AS endpoints", () => {
  let baseUrl = "";
  let httpServer: ReturnType<typeof createHttpMcpApp>["httpServer"];
  let transports: ReturnType<typeof createHttpMcpApp>["transports"];

  // Snapshot env before the suite so we can restore it even if the
  // SDK recursion suppression fails to reach afterAll. Without this
  // the leaked env vars would push subsequent test files into
  // external mode and cascade-fail them.
  const envSnapshot = { ...process.env };

  beforeAll(async () => {
    process.env.MCP_OAUTH_MODE = "external";
    // The IdP's `iss` and JWKS URL. The lab does not actually fetch
    // the JWKS during these tests; we only verify gating behavior.
    process.env.MCP_OAUTH_IDP_ISSUER = "https://idp.example.com/";
    process.env.MCP_OAUTH_IDP_JWKS_URL = "https://idp.example.com/.well-known/jwks.json";
    // The lab's `issuer` must equal the IdP's issuer (validated by
    // the issuer factory). For testing purposes we override the
    // MCP_OAUTH_ISSUER to align them.
    process.env.MCP_OAUTH_ISSUER = "https://idp.example.com/";
    process.env.MCP_OAUTH_ALLOW_INSECURE_HTTP = "false";

    const app = createHttpMcpApp();
    httpServer = app.httpServer;
    transports = app.transports;
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const addr = httpServer.address();
    if (!addr || typeof addr === "string") throw new Error("Could not bind ephemeral port");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    // Restore env regardless of teardown order.
    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) delete process.env[key];
    }
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === undefined) continue;
      process.env[key] = value;
    }
    try {
      for (const session of transports.values()) {
        await session.transport.close();
        await session.server.close();
      }
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    } catch {
      // The MCP SDK can throw during shutdown (known recursion
      // bug); we have already restored env so the next suite is safe.
    }
  });

  it("/.well-known/oauth-authorization-server returns 404 as_disabled", async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string; error_description: string };
    expect(body.error).toBe("as_disabled");
    expect(body.error_description).toMatch(/external IdP/);
  });

  it("/oauth2/v1/token returns 404 as_disabled", async () => {
    const res = await fetch(`${baseUrl}/oauth2/v1/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=authorization_code&code=anything",
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("as_disabled");
  });

  it("/oauth/jwks.json returns 404 as_disabled (lab no longer publishes its own key)", async () => {
    const res = await fetch(`${baseUrl}/oauth/jwks.json`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("as_disabled");
  });

  it("still serves /health and /ready", async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    const ready = await fetch(`${baseUrl}/ready`);
    expect(ready.status).toBe(200);
  });
});
