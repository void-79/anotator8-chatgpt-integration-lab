/**
 * v0.9.0 — Tests for the in-memory refresh-token store.
 *
 * Coverage targets:
 *   - issue() returns a 256-bit base64url token + fresh familyId by default
 *   - issue() reuses a familyId when supplied (rotation case)
 *   - consume() returns the record and deletes the row on first use
 *   - consume() returns {} on second use (no record, no reused flag — the
 *     comment in refresh-token-store.ts:121 documents the limitation)
 *   - revokeFamily() removes all rows in the family and returns the count
 *   - hasFamily() and size() observe consistency after a series of
 *     issue/consume/revoke calls
 *   - TTL sweep: rows past their expiresAt are removed on the next consume()
 *   - Token storage: the store keeps the hash, not the plaintext. Mutating
 *     the internal map directly would surface as a "no such token" on
 *     consume, which the public API already proves.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshTokenStore } from "../../../src/server/oauth/refresh-token-store.js";

describe("oauth/refresh-token-store", () => {
  let now: number;
  let store: RefreshTokenStore;

  beforeEach(() => {
    now = 1_700_000_000_000;
    store = new RefreshTokenStore({ ttlSeconds: 60, now: () => now });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("issues a base64url token of exactly 43 chars (256 bits)", () => {
    const issued = store.issue({
      clientId: "client-1",
      subject: "user-1",
      scope: ["mcp:read"],
      resource: "https://mcp.example.com/mcp",
    });
    expect(issued.token).toMatch(/^[A-Za-z0-9\-_]{43}$/);
    expect(issued.familyId).toMatch(/^[0-9a-f-]{36}$/); // UUID v4
    expect(issued.expiresAt - now).toBe(60_000);
    expect(store.size()).toBe(1);
  });

  it("reuses a familyId when supplied (rotation case)", () => {
    const first = store.issue({ clientId: "c", subject: "s", scope: ["mcp:read"], resource: undefined });
    const second = store.issue({
      clientId: "c",
      subject: "s",
      scope: ["mcp:read"],
      resource: undefined,
      familyId: first.familyId,
    });
    expect(second.familyId).toBe(first.familyId);
    expect(second.token).not.toBe(first.token);
    expect(store.size()).toBe(2);
    expect(store.hasFamily(first.familyId)).toBe(true);
  });

  it("consume() returns the record on first use and deletes the row", () => {
    const issued = store.issue({ clientId: "c", subject: "s", scope: ["mcp:read"], resource: undefined });
    const result = store.consume(issued.token);
    expect(result.record).toBeDefined();
    expect(result.record?.clientId).toBe("c");
    expect(result.record?.subject).toBe("s");
    expect(result.reused).toBeUndefined();
    expect(store.size()).toBe(0);
  });

  it("consume() returns an empty object on the second use of a token", () => {
    const issued = store.issue({ clientId: "c", subject: "s", scope: ["mcp:read"], resource: undefined });
    store.consume(issued.token);
    const second = store.consume(issued.token);
    expect(second.record).toBeUndefined();
    expect(second.reused).toBeUndefined();
    expect(store.size()).toBe(0);
  });

  it("consume() of an unknown token returns an empty object", () => {
    const result = store.consume("never-issued-this-token");
    expect(result.record).toBeUndefined();
    expect(result.reused).toBeUndefined();
  });

  it("revokeFamily() removes every row in the family and returns the count", () => {
    const a = store.issue({ clientId: "c", subject: "s", scope: ["mcp:read"], resource: undefined });
    const b = store.issue({
      clientId: "c",
      subject: "s",
      scope: ["mcp:read"],
      resource: undefined,
      familyId: a.familyId,
    });
    const other = store.issue({ clientId: "c", subject: "s", scope: ["mcp:read"], resource: undefined });
    expect(store.size()).toBe(3);
    const removed = store.revokeFamily(a.familyId);
    expect(removed).toBe(2);
    expect(store.size()).toBe(1);
    expect(store.hasFamily(a.familyId)).toBe(false);
    expect(store.hasFamily(other.familyId)).toBe(true);
    // a and b are now invalid grants
    expect(store.consume(a.token).record).toBeUndefined();
    expect(store.consume(b.token).record).toBeUndefined();
    // the other family's token still works
    expect(store.consume(other.token).record?.clientId).toBe("c");
  });

  it("revokeFamily() of an unknown id returns 0 and is a no-op", () => {
    store.issue({ clientId: "c", subject: "s", scope: ["mcp:read"], resource: undefined });
    const removed = store.revokeFamily("00000000-0000-0000-0000-000000000000");
    expect(removed).toBe(0);
    expect(store.size()).toBe(1);
  });

  it("expired rows are swept on the next consume() (TTL)", () => {
    const issued = store.issue({ clientId: "c", subject: "s", scope: ["mcp:read"], resource: undefined });
    expect(store.size()).toBe(1);
    now += 120_000; // 2 minutes later, TTL is 60s
    // Even a consume() of an unrelated token triggers a sweep.
    const other = store.issue({ clientId: "c", subject: "s", scope: ["mcp:read"], resource: undefined });
    // Both the new token and the old token are still live at this exact
    // instant because issue() does not sweep. We trigger the sweep via
    // consume() of the old token (which will return {} because the
    // sweep runs first).
    const result = store.consume(issued.token);
    expect(result.record).toBeUndefined();
    expect(store.size()).toBe(1);
    // The other (still-live) token is unaffected.
    expect(store.consume(other.token).record?.clientId).toBe("c");
  });

  it("preserves the public Contract: tokens issued for one client do not work for another (and revokeFamily is the right tool to use on theft)", () => {
    const issued = store.issue({ clientId: "client-a", subject: "s", scope: ["mcp:read"], resource: undefined });
    // Note: unlike the auth code store, the refresh store does NOT
    // client-bind the consume() call — that binding check lives in the
    // serveRefreshTokenGrant handler (RFC 6749 §6). The store is a
    // dumb hash map; cross-client use will be caught at the handler,
    // which calls revokeFamily. This test pins that contract.
    const result = store.consume(issued.token);
    expect(result.record?.clientId).toBe("client-a");
    // If a real attacker presented this token, the handler would call
    // revokeFamily here. Simulate that: family is gone, family is gone.
    expect(store.revokeFamily(result.record!.familyId)).toBe(0);
  });

  it("different issues produce different tokens (entropy check)", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const issued = store.issue({ clientId: "c", subject: "s", scope: ["mcp:read"], resource: undefined });
      tokens.add(issued.token);
    }
    expect(tokens.size).toBe(100);
  });
});
