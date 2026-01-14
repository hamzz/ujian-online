import { describe, expect, it } from "bun:test";
import { hashPassword, verifyPassword } from "../src/auth";

describe("auth hashing", () => {
  it("hashes and verifies password", async () => {
    const hash = await hashPassword("P@ssw0rd!");
    const ok = await verifyPassword("P@ssw0rd!", hash);
    expect(ok).toBe(true);
  });

  it("rejects invalid password", async () => {
    const hash = await hashPassword("P@ssw0rd!");
    const ok = await verifyPassword("wrong", hash);
    expect(ok).toBe(false);
  });
});
