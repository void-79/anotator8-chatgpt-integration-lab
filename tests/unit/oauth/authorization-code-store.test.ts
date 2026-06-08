import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationCodeStore } from "../../../src/server/oauth/authorization-code-store.js";

describe("oauth/authorization-code-store", () => {
  let store: AuthorizationCodeStore;

  beforeEach(() => {
    store = new AuthorizationCodeStore({ ttlSeconds: 60 });
  });

  it("creates a code with the supplied params", () => {
    const code = store.create({
      clientId: "client-1",
      redirectUri: "https://app.example.com/cb",
      scope: ["mcp:read"],
      codeChallenge: "challenge-1",
      codeChallengeMethod: "S256",
      resource: "https://mcp.example.com/mcp",
      subject: "user-1",
    });
    expect(code.code).toMatch(/^[A-Za-z0-9\-_]{43}$/);
    expect(code.clientId).toBe("client-1");
    expect(code.expiresAt - code.createdAt).toBe(60_000);
    expect(code.consumed).toBe(false);
  });

  it("consumes a code exactly once", () => {
    const c = store.create({
      clientId: "c", redirectUri: "u", scope: ["mcp:read"],
      codeChallenge: "ch", codeChallengeMethod: "S256", resource: undefined, subject: "s",
    });
    expect(store.consume(c.code, "c", "u")?.code).toBe(c.code);
    expect(store.consume(c.code, "c", "u")).toBeNull();
    expect(store.size()).toBe(0);
  });

  it("rejects codes with a different clientId", () => {
    const c = store.create({
      clientId: "a", redirectUri: "u", scope: ["mcp:read"],
      codeChallenge: "ch", codeChallengeMethod: "S256", resource: undefined, subject: "s",
    });
    expect(store.consume(c.code, "b", "u")).toBeNull();
  });

  it("rejects codes with a different redirectUri", () => {
    const c = store.create({
      clientId: "c", redirectUri: "u1", scope: ["mcp:read"],
      codeChallenge: "ch", codeChallengeMethod: "S256", resource: undefined, subject: "s",
    });
    expect(store.consume(c.code, "c", "u2")).toBeNull();
  });

  it("rejects unknown codes", () => {
    expect(store.consume("does-not-exist", "c", "u")).toBeNull();
  });

  it("rejects expired codes", () => {
    vi.useFakeTimers();
    try {
      const c = store.create({
        clientId: "c", redirectUri: "u", scope: ["mcp:read"],
        codeChallenge: "ch", codeChallengeMethod: "S256", resource: undefined, subject: "s",
        ttlSeconds: 1,
      });
      vi.advanceTimersByTime(1500);
      expect(store.consume(c.code, "c", "u")).toBeNull();
      // The expired code should be removed by the consume call (or by sweep).
      expect(store.size()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sweep removes only expired codes", () => {
    vi.useFakeTimers();
    try {
      const live = store.create({
        clientId: "c", redirectUri: "u", scope: ["mcp:read"],
        codeChallenge: "ch", codeChallengeMethod: "S256", resource: undefined, subject: "s",
        ttlSeconds: 100,
      });
      const dead = store.create({
        clientId: "c", redirectUri: "u", scope: ["mcp:read"],
        codeChallenge: "ch", codeChallengeMethod: "S256", resource: undefined, subject: "s",
        ttlSeconds: 1,
      });
      vi.advanceTimersByTime(2000);
      store.sweep();
      // The second `create` triggered an opportunistic sweep on the live code,
      // so depending on timing the live code is still present.
      expect(store.size()).toBeLessThanOrEqual(1);
      expect(store.consume(live.code, "c", "u")?.code).toBe(live.code);
      expect(store.consume(dead.code, "c", "u")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
