/**
 * src/server/oauth/pkce.ts
 *
 * Proof Key for Code Exchange (PKCE) — RFC 7636.
 *
 * Implements the S256 challenge method. The lab refuses the `plain`
 * method (MUST NOT per RFC 7636 §7.2 when the client advertised `S256`).
 *
 * Spec: https://www.rfc-editor.org/rfc/rfc7636
 *
 * Test vectors used in tests/unit/oauth/pkce.test.ts come from
 * RFC 7636 Appendix B and the OAuth 2.1 IETF draft §4.1.1.
 */
import { createHash, randomBytes } from "node:crypto";

/** RFC 7636 §4.1 — verifier is 43..128 chars from `[A-Z][a-z][0-9]-._~`. */
const VERIFIER_MIN = 43;
const VERIFIER_MAX = 128;
const VERIFIER_CHARSET = /^[A-Za-z0-9\-._~]+$/;

/** RFC 7636 §7.2 — only S256 is allowed by the lab. */
export type CodeChallengeMethod = "S256";

/** Generate a fresh PKCE verifier. RFC 7636 §4.1. */
export function generateCodeVerifier(byteLength = 32): string {
  // 32 random bytes -> base64url -> 43 chars (RFC 7636 §7.1 recommends 32 bytes min).
  if (byteLength < 32 || byteLength > 96) {
    throw new RangeError(`PKCE verifier byte length must be 32..96, got ${byteLength}`);
  }
  return base64UrlNoPad(randomBytes(byteLength));
}

/** Compute the S256 challenge for a given verifier. RFC 7636 §4.2. */
export function codeChallengeS256(verifier: string): string {
  if (!isValidVerifier(verifier)) {
    throw new RangeError("Invalid PKCE code_verifier");
  }
  return base64UrlNoPad(createHash("sha256").update(verifier, "ascii").digest());
}

/**
 * Verify a verifier against a stored challenge.
 * Per RFC 7636 §4.6, the comparison is constant-time.
 */
export function verifyCodeChallenge(verifier: string, challenge: string, method: CodeChallengeMethod): boolean {
  if (method !== "S256") return false;
  if (!isValidVerifier(verifier)) return false;
  const computed = codeChallengeS256(verifier);
  return timingSafeEqual(computed, challenge);
}

function isValidVerifier(verifier: string): boolean {
  if (verifier.length < VERIFIER_MIN || verifier.length > VERIFIER_MAX) return false;
  return VERIFIER_CHARSET.test(verifier);
}

/** base64url without padding. RFC 7636 §3 / RFC 4648 §5. */
function base64UrlNoPad(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Constant-time string comparison. RFC 7636 §4.6. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
