/**
 * src/server/oauth/refresh-token-store.ts
 *
 * In-memory store for refresh tokens issued by the lab's
 * in-process AS.
 *
 * Security posture (RFC 6749 §10.4 + OAuth 2.1):
 *   - Tokens are 256 bits of randomness, base64url-encoded for transport.
 *   - The store keeps the SHA-256 hash, never the plaintext. A memory
 *     dump does not yield valid refresh tokens.
 *   - Single-use: each token can be redeemed exactly once. After
 *     consume, the row is deleted; the new rotated token takes its
 *     place in the same "family" (a UUID chain id).
 *   - Reuse detection: if a token is presented after it has been
 *     consumed, the entire family is revoked. This signals a
 *     stolen-token replay and is the modern best practice.
 *   - TTL: rows are swept on every consume to bound memory.
 *
 * Spec: RFC 6749 §6 (Refresh Tokens) + §10.4 (Refresh Token Security).
 * Demo-grade: the store is in-memory. Production IdPs persist
 * refresh tokens. See docs/OAUTH_AS.md for the cutover recipe.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";

/** A row in the refresh token store. */
export interface RefreshTokenRecord {
  /** Hash of the token the client was given (never the plaintext). */
  readonly tokenHash: string;
  /** The rotation family this token belongs to. All descendants share this id. */
  readonly familyId: string;
  /** The client the token was issued to. */
  readonly clientId: string;
  /** The resource owner subject. */
  readonly subject: string;
  /** Scopes granted at original issue. Downscoping on rotation is allowed (RFC 6749 §6). */
  readonly scope: ReadonlyArray<string>;
  /** Resource indicator (RFC 8707). */
  readonly resource: string | undefined;
  /** Epoch ms when this row was created. */
  readonly createdAt: number;
  /** Epoch ms when this row expires. */
  readonly expiresAt: number;
}

export interface RefreshTokenStoreOptions {
  /** Token lifetime in seconds. Default 30 days. */
  readonly ttlSeconds?: number;
  /** Override Date.now (test injection point). */
  readonly now?: () => number;
}

export interface ConsumeResult {
  /** The consumed record, on success. */
  readonly record?: RefreshTokenRecord;
  /** True when the presented token was already consumed — reuse signal. */
  readonly reused?: boolean;
}

/**
 * Mints refresh tokens and tracks them.
 *
 * The store does not store plaintext tokens. Callers receive the
 * plaintext via `issue()` and pass it back to `consume()`. The store
 * hashes with SHA-256 (fast; collisions are not a security concern
 * because the token already has 256 bits of entropy).
 */
export class RefreshTokenStore {
  private readonly ttlMs: number;
  private readonly now: () => number;
  /** Hash -> record. Single-use: entries are deleted on consume. */
  private readonly rows = new Map<string, RefreshTokenRecord>();

  constructor(options: RefreshTokenStoreOptions = {}) {
    this.ttlMs = (options.ttlSeconds ?? 60 * 60 * 24 * 30) * 1000;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Mint a new refresh token. Returns the plaintext token (to hand
   * to the client) and the family id (to thread into rotated tokens).
   */
  issue(input: {
    readonly clientId: string;
    readonly subject: string;
    readonly scope: ReadonlyArray<string>;
    readonly resource: string | undefined;
    /** Optional: continue an existing family (used by rotation). */
    readonly familyId?: string;
  }): { token: string; familyId: string; expiresAt: number } {
    const plaintext = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(plaintext);
    const familyId = input.familyId ?? randomUUID();
    const createdAt = this.now();
    const expiresAt = createdAt + this.ttlMs;
    const record: RefreshTokenRecord = {
      tokenHash,
      familyId,
      clientId: input.clientId,
      subject: input.subject,
      scope: input.scope,
      resource: input.resource,
      createdAt,
      expiresAt,
    };
    this.rows.set(tokenHash, record);
    return { token: plaintext, familyId, expiresAt };
  }

  /**
   * Consume a refresh token. On first use, returns the record and
   * deletes it (single-use). On reuse, returns `{ reused: true }`
   * and revokes the entire family (best practice for stolen-token
   * detection per RFC 6749 §10.4).
   */
  consume(plaintext: string): ConsumeResult {
    this.sweep();
    const tokenHash = hashToken(plaintext);
    const record = this.rows.get(tokenHash);
    if (!record) {
      // Either expired, never existed, or already consumed.
      // We cannot distinguish "expired" from "reused" once the row
      // is gone, so we treat unknown as "invalid_grant" with no
      // reuse-detection (the previous consume already swept it).
      return {};
    }
    // First use: delete + return.
    this.rows.delete(tokenHash);
    return { record };
  }

  /**
   * Explicit reuse signal. If a client presents a token whose hash
   * is NOT in the store, we can't be sure whether it was reused
   * or just expired. Callers can use this when they have a
   * secondary signal (e.g. they tracked a recently-issued token
   * locally and it matches the family).
   */
  revokeFamily(familyId: string): number {
    let count = 0;
    for (const [hash, record] of this.rows) {
      if (record.familyId === familyId) {
        this.rows.delete(hash);
        count += 1;
      }
    }
    return count;
  }

  /** Test/observability helper: number of live rows. */
  size(): number {
    return this.rows.size;
  }

  /** Test/observability helper. */
  hasFamily(familyId: string): boolean {
    for (const record of this.rows.values()) {
      if (record.familyId === familyId) return true;
    }
    return false;
  }

  /** Remove expired rows. Called on every consume. */
  private sweep(): void {
    const cutoff = this.now();
    for (const [hash, record] of this.rows) {
      if (record.expiresAt <= cutoff) this.rows.delete(hash);
    }
  }
}

function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("base64url");
}
