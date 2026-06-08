import { describe, expect, it } from "vitest";
import { codeChallengeS256, generateCodeVerifier, verifyCodeChallenge } from "../../../src/server/oauth/pkce.js";

describe("oauth/pkce — RFC 7636 S256", () => {
  it("generates a 43-char verifier (32 random bytes → base64url no pad)", () => {
    const v = generateCodeVerifier();
    expect(v.length).toBe(43);
    expect(/^[A-Za-z0-9\-._~]+$/.test(v)).toBe(true);
  });

  it("rejects byte lengths outside 32..96", () => {
    expect(() => generateCodeVerifier(16)).toThrow(RangeError);
    expect(() => generateCodeVerifier(128)).toThrow(RangeError);
  });

  it("produces a stable 43-char S256 challenge for a given verifier", () => {
    const v = generateCodeVerifier();
    const c1 = codeChallengeS256(v);
    const c2 = codeChallengeS256(v);
    expect(c1).toBe(c2);
    expect(c1.length).toBe(43);
    expect(/^[A-Za-z0-9\-_]+$/.test(c1)).toBe(true);
  });

  it("RFC 7636 Appendix B test vector", () => {
    // verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    // challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(codeChallengeS256(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("verifyCodeChallenge returns true for matching verifier+challenge", () => {
    const v = generateCodeVerifier();
    const c = codeChallengeS256(v);
    expect(verifyCodeChallenge(v, c, "S256")).toBe(true);
  });

  it("verifyCodeChallenge returns false for wrong verifier", () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    const c = codeChallengeS256(v1);
    expect(verifyCodeChallenge(v2, c, "S256")).toBe(false);
  });

  it("verifyCodeChallenge returns false for non-S256 method (lab policy)", () => {
    const v = generateCodeVerifier();
    const c = codeChallengeS256(v);
    // The lab does not implement the `plain` method; the function signature
    // only accepts "S256", so any other method returns false.
    expect(verifyCodeChallenge(v, c, "plain" as never)).toBe(false);
  });

  it("verifyCodeChallenge rejects too-short verifier", () => {
    const c = codeChallengeS256(generateCodeVerifier());
    expect(verifyCodeChallenge("too-short", c, "S256")).toBe(false);
  });

  it("verifyCodeChallenge rejects verifier with invalid charset", () => {
    const c = codeChallengeS256(generateCodeVerifier());
    expect(verifyCodeChallenge("$$$".padEnd(43, "$"), c, "S256")).toBe(false);
  });

  it("verifyCodeChallenge is constant-time on length (sanity)", () => {
    // Just exercising the path; the real timing property is not asserted.
    const v = generateCodeVerifier();
    const c = codeChallengeS256(v);
    expect(verifyCodeChallenge(v, c, "S256")).toBe(true);
    expect(verifyCodeChallenge(v, c.slice(0, -1) + "X", "S256")).toBe(false);
  });
});
