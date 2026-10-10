import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type UserRole = "FARMER" | "ADMIN";

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setAccessToken: (token: string) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAccessToken: (token) => set({ accessToken: token }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, user: null }),
    }),
    {
      name: "kb-auth",                      // localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({             // only persist these fields
        accessToken: state.accessToken,
        user: state.user,
      }),
    }
  )
);
