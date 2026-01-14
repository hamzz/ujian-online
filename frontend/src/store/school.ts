import { create } from "zustand";
import { apiFetch } from "../api";

type SchoolProfile = {
  name: string;
  tagline: string;
  logoUrl: string;
  bannerUrl: string;
  themeColor: string;
};

type SchoolState = {
  profile: SchoolProfile | null;
  load: () => Promise<void>;
  setProfile: (profile: SchoolProfile) => void;
};

export const useSchoolStore = create<SchoolState>((set) => ({
  profile: null,
  load: async () => {
    const data = await apiFetch<SchoolProfile>("/public/school-profile");
    set({ profile: data });
  },
  setProfile: (profile) => set({ profile })
}));
