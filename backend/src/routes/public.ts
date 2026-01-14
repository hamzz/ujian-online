import { Elysia } from "elysia";
import { join, basename } from "node:path";
import { query } from "../db";

export const publicRoutes = new Elysia({ prefix: "/public" })
  .get("/school-profile", async () => {
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
  .get("/uploads/:name", async ({ params, set }) => {
    const name = basename((params as any).name || "");
    if (!name) {
      set.status = 404;
      return { error: "Not found" };
    }
    const path = join(process.cwd(), "uploads", name);
    const file = Bun.file(path);
    if (!(await file.exists())) {
      set.status = 404;
      return { error: "Not found" };
    }
    return new Response(file);
  });
