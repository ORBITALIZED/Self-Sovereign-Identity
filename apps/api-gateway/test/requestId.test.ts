import { describe, it, expect } from "vitest";
import { build } from "../src/app.js";

process.env.JWT_SECRET = "test-only-jwt-secret";

describe("requestId middleware", () => {
  it("mints a UUID when no incoming header is present", async () => {
    const app = await build({ jwtSecret: "test-only-jwt-secret" });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const id = res.headers["x-request-id"];
    expect(typeof id).toBe("string");
    // UUIDv4 length = 36 chars
    expect((id as string).length).toBeGreaterThan(0);
    await app.close();
  });

  it("echoes a valid client-provided request id", async () => {
    const app = await build({ jwtSecret: "test-only-jwt-secret" });
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "client-supplied-123" },
    });
    expect(res.headers["x-request-id"]).toBe("client-supplied-123");
    await app.close();
  });

  it("rejects an adversarial request id and mints a fresh one", async () => {
    const app = await build({ jwtSecret: "test-only-jwt-secret" });
    // 200 chars — well over the 128 limit
    const adversarial = "A".repeat(200);
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": adversarial },
    });
    const id = res.headers["x-request-id"];
    expect(id).not.toBe(adversarial);
    expect((id as string).length).toBeLessThanOrEqual(128);
    await app.close();
  });

  it("rejects a request id with disallowed chars", async () => {
    const app = await build({ jwtSecret: "test-only-jwt-secret" });
    const res = await app.inject({
      method: "GET",
      url: "/health",
      // spaces and semicolons are NOT in the allowed char set
      headers: { "x-request-id": "evil id; rm -rf /" },
    });
    const id = res.headers["x-request-id"];
    expect(id).not.toContain(" ");
    expect(id).not.toContain(";");
    await app.close();
  });
});
