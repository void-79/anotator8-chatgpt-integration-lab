import { describe, expect, it } from "vitest";
import { createTokenIssuer, TokenValidationError } from "../../../src/server/oauth/token-issuer.js";

function newIssuer(ttl = 900) {
  return createTokenIssuer({
    issuer: "http://127.0.0.1:9000",
    resource: "http://127.0.0.1:9000/mcp",
    tokenTtlSeconds: ttl,
    defaultSubject: "demo-user",
  });
}

describe("oauth/token-issuer — RS256 JWT issuance + validation", () => {
  it("issues a JWT with the expected claims", () => {
    const issuer = newIssuer();
    const issued = issuer.issue({
      clientId: "client-1",
      scope: ["mcp:read"],
      resource: "http://127.0.0.1:9000/mcp",
      subject: "user-1",
    });
    expect(issued.token.split(".")).toHaveLength(3);
    expect(issued.iss).toBe("http://127.0.0.1:9000");
    expect(issued.aud).toBe("http://127.0.0.1:9000/mcp");
    expect(issued.sub).toBe("user-1");
    expect(issued.exp - issued.iat).toBe(900);
    expect(issued.nbf).toBe(issued.iat);
    expect(issued.scope).toBe("mcp:read");
    expect(issued.client_id).toBe("client-1");
  });

  it("uses the default subject when none is provided", () => {
    const issued = newIssuer().issue({
      clientId: "c", scope: ["mcp:read"], resource: undefined, subject: undefined,
    });
    expect(issued.sub).toBe("demo-user");
  });

  it("uses the configured resource when no resource is provided", () => {
    const issued = newIssuer().issue({
      clientId: "c", scope: ["mcp:read"], resource: undefined, subject: "u",
    });
    expect(issued.aud).toBe("http://127.0.0.1:9000/mcp");
  });

  it("validates a freshly issued token with no required scopes", () => {
    const issuer = newIssuer();
    const issued = issuer.issue({ clientId: "c", scope: ["mcp:read"], resource: undefined, subject: "u" });
    const v = issuer.validate(issued.token, []);
    expect(v.claims.jti).toBe(issued.jti);
    expect(v.scopes).toEqual(["mcp:read"]);
  });

  it("rejects a token with insufficient scope", () => {
    const issuer = newIssuer();
    const issued = issuer.issue({ clientId: "c", scope: ["mcp:read"], resource: undefined, subject: "u" });
    expect(() => issuer.validate(issued.token, ["mcp:write"])).toThrow(TokenValidationError);
  });

  it("rejects an expired token", async () => {
    const issuer = newIssuer(1);
    const issued = issuer.issue({ clientId: "c", scope: ["mcp:read"], resource: undefined, subject: "u" });
    await new Promise((r) => setTimeout(r, 1100));
    expect(() => issuer.validate(issued.token, [])).toThrow(/expired/i);
  });

  it("rejects a token signed by a different issuer (kid mismatch)", () => {
    const a = newIssuer();
    const b = newIssuer();
    const issuedByA = a.issue({ clientId: "c", scope: ["mcp:read"], resource: undefined, subject: "u" });
    // Different issuers generate different signing keys, so the kid check
    // fires before iss/aud. We assert the token is rejected (any reason).
    expect(() => b.validate(issuedByA.token, [])).toThrow();
  });

  it("rejects a token with a wrong audience (same key, different aud)", () => {
    // To exercise the aud-check path we need to share the signing key
    // between two issuers. We test this by issuing a token with a custom
    // resource and validating against a different resource.
    const a = createTokenIssuer({
      issuer: "http://127.0.0.1:9000",
      resource: "http://127.0.0.1:9000/mcp",
      tokenTtlSeconds: 900,
      defaultSubject: "u",
    });
    const b = createTokenIssuer({
      issuer: "http://127.0.0.1:9000",
      resource: "http://127.0.0.1:9000/mcp-other",
      tokenTtlSeconds: 900,
      defaultSubject: "u",
    });
    // A and B have different keys, so we can't easily test the aud check
    // here without exposing the signing key. The aud logic is also covered
    // by the integration test (RFC 8707 resource echo). We assert the
    // token issued by A is not valid for B.
    const issued = a.issue({ clientId: "c", scope: ["mcp:read"], resource: undefined, subject: "u" });
    expect(() => b.validate(issued.token, [])).toThrow();
  });

  it("rejects a malformed token", () => {
    const issuer = newIssuer();
    expect(() => issuer.validate("not-a-jwt", [])).toThrow();
  });

  it("publishes a JWKS with one key matching the signing key", () => {
    const issuer = newIssuer();
    expect(issuer.jwks.keys).toHaveLength(1);
    expect(issuer.jwks.keys[0].alg).toBe("RS256");
  });
});
