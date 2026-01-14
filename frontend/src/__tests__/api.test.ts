import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api";
import { useAuthStore } from "../store/auth";

describe("apiFetch", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null });
    vi.restoreAllMocks();
  });

  it("adds Authorization header when token exists", async () => {
    useAuthStore.setState({ token: "token123", user: null });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/health");
    const call = fetchMock.mock.calls[0];
    const headers = call[1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token123");
  });

  it("throws error on non-2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Bad request" })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/bad")).rejects.toThrow("Bad request");
  });
});
