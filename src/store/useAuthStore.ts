import { create } from "zustand";

interface User {
  id: string;
  name: string;
  role: string;
  department: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
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
}));
