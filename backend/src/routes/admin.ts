import { Elysia } from "elysia";
import { query, queryOne } from "../db";
import { hashPassword } from "../auth";

function ensureAdmin(auth: any) {
  return auth && auth.role === "admin";
}

export const adminRoutes = new Elysia({ prefix: "/admin" })
  .get("/users", async ({ auth, set }) => {
    if (!ensureAdmin(auth)) {
      set.status = 403;
      return { error: "Admin access required" };
    }
    const rows = await query(
      "SELECT id, email, role, profile_data, created_at FROM users ORDER BY created_at DESC"
    );
    return rows;
  })
  .post("/users", async ({ auth, body, set }) => {
    if (!ensureAdmin(auth)) {
      set.status = 403;
      return { error: "Admin access required" };
    }
    const { email, password, role } = body as any;
    if (!email || !password || !role) {
      set.status = 400;
      return { error: "email, password, role required" };
    }
    const existing = await queryOne<{ id: string }>("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) {
      set.status = 409;
      return { error: "Email already registered" };
    }
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    await query(
      "INSERT INTO users (id, email, password_hash, role, profile_data) VALUES (?, ?, ?, ?, ?)",
      [id, email, passwordHash, role, JSON.stringify({})]
    );
    return { id, email, role };
  })
  .put("/users/:id", async ({ auth, params, body, set }) => {
    if (!ensureAdmin(auth)) {
      set.status = 403;
      return { error: "Admin access required" };
    }
    const { id } = params as { id: string };
    const { email, password, role } = body as any;
    const fields: string[] = [];
    const values: any[] = [];

    if (email) {
      fields.push("email = ?");
      values.push(email);
    }
    if (role) {
      fields.push("role = ?");
      values.push(role);
    }
    if (password) {
      const passwordHash = await hashPassword(password);
      fields.push("password_hash = ?");
      values.push(passwordHash);
    }

    if (fields.length === 0) {
      set.status = 400;
      return { error: "No fields to update" };
    }

    values.push(id);
    await query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
    return { id };
  })
  .delete("/users/:id", async ({ auth, params, set }) => {
    if (!ensureAdmin(auth)) {
      set.status = 403;
      return { error: "Admin access required" };
    }
    const { id } = params as { id: string };
    await query("DELETE FROM users WHERE id = ?", [id]);
    return { id };
  })
  .get("/school-profile", async ({ auth, set }) => {
    if (!ensureAdmin(auth)) {
      set.status = 403;
      return { error: "Admin access required" };
    }
    const rows = await query<any>("SELECT * FROM school_profile WHERE id = 1");
    if (!rows.length) {
      return {
        name: "Ujian Online",
        tagline: "Platform ujian sekolah",
        logoUrl: "",
        bannerUrl: "",
        themeColor: "#2563eb"
      };
    }
    const profile = rows[0];
    return {
      name: profile.name,
      tagline: profile.tagline,
      logoUrl: profile.logo_url,
      bannerUrl: profile.banner_url,
      themeColor: profile.theme_color
    };
  })
  .put("/school-profile", async ({ auth, body, set }) => {
    if (!ensureAdmin(auth)) {
      set.status = 403;
      return { error: "Admin access required" };
    }
    const { name, tagline, logoUrl, bannerUrl, themeColor } = body as any;
    if (!name) {
      set.status = 400;
      return { error: "name required" };
    }
    await query(
      "INSERT INTO school_profile (id, name, tagline, logo_url, banner_url, theme_color) VALUES (1, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), tagline = VALUES(tagline), logo_url = VALUES(logo_url), banner_url = VALUES(banner_url), theme_color = VALUES(theme_color)",
      [name, tagline || null, logoUrl || null, bannerUrl || null, themeColor || null]
    );
    return { ok: true };
  });
