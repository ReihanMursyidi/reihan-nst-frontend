import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (user, token) => {
        localStorage.setItem("nst_token", token);
        set({ user, token });
      },
      logout: () => {
        localStorage.removeItem("nst_token");
        set({ user: null, token: null });
      },
    }),
    {
      name: "nodewave-auth", // Key yang akan disimpan di localStorage browser
    },
  ),
);
