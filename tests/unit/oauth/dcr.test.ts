import { describe, expect, it } from "vitest";
import { ClientRegistry, DcrValidationError } from "../../../src/server/oauth/dcr.js";

describe("oauth/dcr — RFC 7591 dynamic client registration", () => {
  it("registers a client with the supplied redirect_uris", () => {
    const reg = new ClientRegistry({ allowInsecureHttp: false });
    const c = reg.register({
      redirect_uris: ["https://app.example.com/cb"],
      client_name: "test",
      token_endpoint_auth_method: "none",
    });
    expect(c.client_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(c.client_id_issued_at).toBeGreaterThan(0);
    expect(c.redirect_uris).toEqual(["https://app.example.com/cb"]);
    expect(c.token_endpoint_auth_method).toBe("none");
  });

  it("rejects empty redirect_uris", () => {
    const reg = new ClientRegistry();
    expect(() => reg.register({ redirect_uris: [] })).toThrow(DcrValidationError);
  });

  it("rejects non-https redirect_uris when allowInsecureHttp is false", () => {
    const reg = new ClientRegistry({ allowInsecureHttp: false });
    expect(() => reg.register({ redirect_uris: ["http://app.example.com/cb"] })).toThrow(/https/);
  });

  it("rejects redirect_uris with a fragment", () => {
    const reg = new ClientRegistry();
    expect(() => reg.register({ redirect_uris: ["https://app.example.com/cb#frag"] })).toThrow(/fragment/);
  });

  it("rejects non-URL redirect_uris", () => {
    const reg = new ClientRegistry();
    expect(() => reg.register({ redirect_uris: ["not a url"] })).toThrow(DcrValidationError);
  });

  it("rejects non-authorization_code grant types", () => {
    const reg = new ClientRegistry();
    expect(() => reg.register({ redirect_uris: ["https://x"], grant_types: ["client_credentials"] })).toThrow(/authorization_code/);
  });

  it("rejects non-code response types", () => {
    const reg = new ClientRegistry();
    expect(() => reg.register({ redirect_uris: ["https://x"], response_types: ["token"] })).toThrow(DcrValidationError);
  });

  it("retrieves a registered client by id", () => {
    const reg = new ClientRegistry();
    const c = reg.register({ redirect_uris: ["https://x"] });
    expect(reg.get(c.client_id)?.client_id).toBe(c.client_id);
    expect(reg.get("not-an-id")).toBeNull();
  });

  it("size reflects the number of registered clients", () => {
    const reg = new ClientRegistry();
    expect(reg.size()).toBe(0);
    reg.register({ redirect_uris: ["https://a"] });
    reg.register({ redirect_uris: ["https://b"] });
    expect(reg.size()).toBe(2);
  });
});
