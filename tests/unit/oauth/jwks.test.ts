import { describe, expect, it } from "vitest";
import { generateSigningKey, jwksFromKey, signJwt, verifyJwt } from "../../../src/server/oauth/jwks.js";

describe("oauth/jwks — RS256 key gen, sign, verify", () => {
  it("generates a 2048-bit RSA key with a UUID kid", () => {
    const key = generateSigningKey();
    expect(key.kid).toMatch(/^[0-9a-f-]{36}$/);
    expect(key.privateKey).toBeDefined();
    expect(key.publicKey).toBeDefined();
  });

  it("exports a JWKS document with one RS256 public key", () => {
    const key = generateSigningKey();
    const jwks = jwksFromKey(key);
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0].kty).toBe("RSA");
    expect(jwks.keys[0].alg).toBe("RS256");
    expect(jwks.keys[0].use).toBe("sig");
    expect(jwks.keys[0].kid).toBe(key.kid);
    expect(jwks.keys[0].n.length).toBeGreaterThan(100);
    expect(jwks.keys[0].e).toBe("AQAB"); // 65537
  });

  it("signs a JWT and verifies it with the same key", () => {
    const key = generateSigningKey();
    const token = signJwt(key, { iss: "test", sub: "user1" });
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    const payload = verifyJwt(token, key);
    expect(payload.iss).toBe("test");
    expect(payload.sub).toBe("user1");
  });

  it("rejects a JWT signed with a different key", () => {
    const keyA = generateSigningKey();
    const keyB = generateSigningKey();
    const token = signJwt(keyA, { iss: "test" });
    expect(() => verifyJwt(token, keyB)).toThrow();
  });

  it("rejects a tampered JWT (signature altered)", () => {
    const key = generateSigningKey();
    const token = signJwt(key, { iss: "test" });
    const [h, p, s] = token.split(".");
    // Flip a bit in the middle of the signature.
    const sigBytes = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + "===", "base64");
    sigBytes[Math.floor(sigBytes.length / 2)] = sigBytes[Math.floor(sigBytes.length / 2)]! ^ 0x01;
    const tampered = `${h}.${p}.${sigBytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
    expect(() => verifyJwt(tampered, key)).toThrow();
  });

  it("rejects a JWT with the wrong alg in the header", () => {
    const key = generateSigningKey();
    const token = signJwt(key, { iss: "test" });
    // Replace header with alg=HS256 (lab only verifies RS256).
    const [_, p, s] = token.split(".");
    const badHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT", kid: key.kid }), "utf8")
      .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(() => verifyJwt(`${badHeader}.${p}.${s}`, key)).toThrow(/Wrong JWT alg/);
  });

  it("rejects a malformed JWT", () => {
    const key = generateSigningKey();
    expect(() => verifyJwt("not.a.valid.jwt", key)).toThrow(/Malformed/);
    expect(() => verifyJwt("two-parts", key)).toThrow(/Malformed/);
  });

  it("rejects a JWT with the wrong kid", () => {
    const keyA = generateSigningKey();
    const keyB = generateSigningKey();
    const token = signJwt(keyA, { iss: "test" });
    expect(() => verifyJwt(token, keyB)).toThrow(/Wrong JWT kid/);
  });
});
