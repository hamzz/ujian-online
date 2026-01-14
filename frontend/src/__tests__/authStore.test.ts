import { describe, expect, it, beforeEach } from "vitest";
import { useAuthStore } from "../store/auth";

describe("auth store", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null });
  });

  it("stores token and user", () => {
    useAuthStore.getState().setAuth("token123", {
      id: "1",
      email: "user@example.com",
      role: "student"
    });
    expect(localStorage.getItem("auth_token")).toBe("token123");
    expect(useAuthStore.getState().user?.email).toBe("user@example.com");
  });

  it("clears auth data", () => {
    useAuthStore.getState().setAuth("token123", {
      id: "1",
      email: "user@example.com",
      role: "student"
    });
    useAuthStore.getState().clear();
    expect(localStorage.getItem("auth_token")).toBe(null);
    expect(useAuthStore.getState().token).toBe(null);
  });
});
