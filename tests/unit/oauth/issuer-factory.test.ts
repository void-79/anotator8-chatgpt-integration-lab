import { describe, expect, it } from "vitest";
import { createIssuerFactory, readOauthModeFromEnv } from "../../../src/server/oauth/issuer-factory.js";

describe("oauth/issuer-factory — mode selection", () => {
  it("returns the local in-process issuer in local mode", () => {
    const result = createIssuerFactory({
      mode: "local",
      issuer: "http://127.0.0.1:8787",
      resource: "http://127.0.0.1:8787/mcp",
      tokenTtlSeconds: 900,
      defaultSubject: "demo-user",
    });
    expect(result.mode).toBe("local");
    expect(result.localIssuer).toBeDefined();
    expect(result.localIssuer!.config.issuer).toBe("http://127.0.0.1:8787");
    expect(result.validator).toBe(result.localIssuer);
  });

  it("returns a remote validator in external mode (no local issuer)", () => {
    const result = createIssuerFactory({
      mode: "external",
      issuer: "https://idp.example.com/",
      resource: "https://lab.example.com/mcp",
      idpIssuer: "https://idp.example.com/",
      jwksUrl: "https://idp.example.com/.well-known/jwks.json",
    });
    expect(result.mode).toBe("external");
    expect(result.localIssuer).toBeUndefined();
    expect(result.validator).toBeDefined();
    expect(result.validator.jwks).toEqual({ url: "https://idp.example.com/.well-known/jwks.json" });
    expect(result.description).toContain("https://idp.example.com/");
  });

  it("throws when external mode is missing jwksUrl", () => {
    expect(() =>
      createIssuerFactory({
        mode: "external",
        issuer: "https://idp.example.com/",
        resource: "https://lab.example.com/mcp",
        idpIssuer: "https://idp.example.com/",
        jwksUrl: "",
      }),
    ).toThrow(/jwksUrl/);
  });

  it("throws when external mode's idpIssuer does not match the lab's issuer", () => {
    expect(() =>
      createIssuerFactory({
        mode: "external",
        issuer: "https://lab.example.com/",
        resource: "https://lab.example.com/mcp",
        idpIssuer: "https://idp.example.com/",
        jwksUrl: "https://idp.example.com/.well-known/jwks.json",
      }),
    ).toThrow(/must equal IdP issuer/);
  });

  it("readOauthModeFromEnv defaults to local and honors explicit external", () => {
    expect(readOauthModeFromEnv({})).toBe("local");
    expect(readOauthModeFromEnv({ MCP_OAUTH_MODE: "external" })).toBe("external");
    expect(readOauthModeFromEnv({ MCP_OAUTH_MODE: "  External  " })).toBe("external");
    expect(readOauthModeFromEnv({ MCP_OAUTH_MODE: "anything-else" })).toBe("local");
  });
});
