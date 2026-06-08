/**
 * src/server/oauth/jwks.ts
 *
 * In-memory RS256 key pair for the lab's AS. Keys are generated on
 * first use and never persisted; the lab does not survive a process
 * restart with valid tokens (re-authorization is required). This is
 * intentional and documented as a demo-grade limitation.
 *
 * Spec: RFC 7517 (JSON Web Key) + RFC 7515 (JWS) for the JWT envelope.
 *
 * Production deploys MUST replace this with a real IdP (Auth0/Okta/
 * Cognito/Stytch). See docs/OAUTH_AS.md.
 */
import { createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, type KeyObject } from "node:crypto";
import { createSign, createVerify } from "node:crypto";

/** JWS alg the lab uses. RS256 per OpenAI Apps SDK Auth + RFC 7518. */
export const JWS_ALG = "RS256" as const;

export interface JwkRsaPublicKey {
  readonly kty: "RSA";
  readonly use: "sig";
  readonly alg: "RS256";
  readonly kid: string;
  readonly n: string;
  readonly e: string;
}

export interface JwkSet {
  readonly keys: ReadonlyArray<JwkRsaPublicKey>;
}

export interface SigningKey {
  readonly kid: string;
  readonly privateKey: KeyObject;
  readonly publicKey: KeyObject;
}

/**
 * Generate a fresh RS256 signing key.
 * - 2048-bit RSA per RFC 7518 §3.3 minimum.
 * - The kid is a UUIDv4 for now; production might pin a stable kid.
 */
export function generateSigningKey(): SigningKey {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return {
    kid: randomUUID(),
    privateKey: createPrivateKey(privateKey),
    publicKey: createPublicKey(publicKey),
  };
}

/** Build a JWKS document from the public key of one signing key. */
export function jwksFromKey(key: SigningKey): JwkSet {
  const jwk = publicKeyToJwk(key);
  return { keys: [jwk] };
}

function publicKeyToJwk(key: SigningKey): JwkRsaPublicKey {
  const jwk = key.publicKey.export({ format: "jwk" }) as { n?: string; e?: string; kty?: string };
  if (jwk.kty !== "RSA" || !jwk.n || !jwk.e) {
    throw new Error("Generated key is not an RSA JWK");
  }
  return {
    kty: "RSA",
    use: "sig",
    alg: "RS256",
    kid: key.kid,
    n: jwk.n,
    e: jwk.e,
  };
}

/**
 * Sign a JWT with the given key. Returns the compact serialization.
 * Header: { alg: "RS256", typ: "JWT", kid }.
 * Payload: a JSON object (caller controls shape).
 */
export function signJwt(key: SigningKey, payload: Record<string, unknown>, headerExtras: Record<string, unknown> = {}): string {
  const header = { alg: JWS_ALG, typ: "JWT", kid: key.kid, ...headerExtras };
  const headerB64 = base64Url(Buffer.from(JSON.stringify(header), "utf8"));
  const payloadB64 = base64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(key.privateKey);
  return `${signingInput}.${base64Url(signature)}`;
}

/**
 * Verify a JWT compact serialization against the given key.
 * Returns the parsed payload (as a plain object) on success.
 * Throws on signature failure, malformed JWT, or wrong alg.
 */
export function verifyJwt(token: string, key: SigningKey): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
  const header = JSON.parse(Buffer.from(base64UrlDecode(headerB64)).toString("utf8")) as { alg?: string; kid?: string; typ?: string };
  if (header.alg !== JWS_ALG) throw new Error(`Wrong JWT alg: ${String(header.alg)}`);
  if (header.kid && header.kid !== key.kid) throw new Error(`Wrong JWT kid: ${String(header.kid)}`);
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signature = base64UrlDecode(signatureB64);
  if (!verifier.verify(key.publicKey, signature)) {
    throw new Error("JWT signature verification failed");
  }
  return JSON.parse(Buffer.from(base64UrlDecode(payloadB64)).toString("utf8")) as Record<string, unknown>;
}

function base64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice(0, (4 - (s.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}
