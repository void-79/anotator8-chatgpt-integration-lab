/**
 * src/server/oauth/authorization-code-store.ts
 *
 * In-memory store for one-time authorization codes. Codes are
 * short-lived (60 seconds by default), single-use, and bound to:
 *   - the registered client_id
 *   - the redirect_uri used in the authorization request
 *   - the PKCE code_challenge (method must be S256)
 *   - the requested scope
 *   - the resource indicator (RFC 8707) if any
 *
 * NOT persisted to disk. The lab survives a process restart by
 * discarding all in-flight codes; clients re-authorize.
 *
 * Spec: RFC 6749 §4.1.2 + RFC 7636 §4.6 + RFC 8707.
 */
import { randomBytes } from "node:crypto";

export interface AuthorizationCode {
  readonly code: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scope: ReadonlyArray<string>;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: "S256";
  readonly resource: string | undefined;
  readonly subject: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly consumed: boolean;
}

export interface CreateAuthorizationCodeInput {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scope: ReadonlyArray<string>;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: "S256";
  readonly resource: string | undefined;
  readonly subject: string;
  /** Lifetime in seconds. Default 60. */
  readonly ttlSeconds?: number;
}

export class AuthorizationCodeStore {
  private readonly codes = new Map<string, AuthorizationCode>();
  private readonly ttlSeconds: number;

  constructor(options: { ttlSeconds?: number } = {}) {
    this.ttlSeconds = options.ttlSeconds ?? 60;
  }

  /** Create a fresh authorization code. */
  create(input: CreateAuthorizationCodeInput): AuthorizationCode {
    const code = base64UrlNoPad(randomBytes(32));
    const now = Date.now();
    const record: AuthorizationCode = {
      code,
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      scope: input.scope,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      resource: input.resource,
      subject: input.subject,
      createdAt: now,
      expiresAt: now + (input.ttlSeconds ?? this.ttlSeconds) * 1000,
      consumed: false,
    };
    this.codes.set(code, record);
    // Sweep opportunistically so the map does not grow unbounded in long demos.
    this.sweep();
    return record;
  }

  /**
   * Look up a code, check it's valid, and atomically mark it consumed.
   * Returns null if the code is unknown, expired, already used, or
   * the client/redirect don't match.
   */
  consume(code: string, clientId: string, redirectUri: string): AuthorizationCode | null {
    const record = this.codes.get(code);
    if (!record) return null;
    if (record.consumed) return null;
    if (Date.now() > record.expiresAt) {
      this.codes.delete(code);
      return null;
    }
    if (record.clientId !== clientId) return null;
    if (record.redirectUri !== redirectUri) return null;
    // Single-use: mark consumed and remove from the map.
    this.codes.delete(code);
    return record;
  }

  /** Test helper: how many codes are currently live. */
  size(): number {
    return this.codes.size;
  }

  /** Remove all expired codes. */
  sweep(): void {
    const now = Date.now();
    for (const [code, record] of this.codes) {
      if (now > record.expiresAt) this.codes.delete(code);
    }
  }
}

function base64UrlNoPad(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
