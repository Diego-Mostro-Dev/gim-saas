import { create } from "zustand";
import { apiFetch } from "../services/api";

const useAuthStore = create((set, get) => ({
  token: localStorage.getItem("token") || null,
  user: null,
  gym: null,

  loading: false,
  error: null,

  // 🔥 HYDRATION (importante para refresh)
  hydrate: () => {
    const token = localStorage.getItem("token");

    if (token) {
      set({ token });
    }
  },

  login: async ({ username, password }) => {
    try {
      set({ loading: true, error: null });

      const data = await apiFetch("/api/auth/login/", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
        }),
      });

      // 🔥 persistencia
      localStorage.setItem("token", data.token);

      set({
        token: data.token,
        user: data.user || {
          username: data.username,
        },
        gym: data.gym || null,
        loading: false,
      });

      return true;
    } catch (err) {
      set({
        error: err.message,
        loading: false,
      });

      return false;
    }
  },

  logout: () => {
    localStorage.removeItem("token");

    set({
      token: null,
      user: null,
      gym: null,
      error: null,
    });
  },

  setGym: (gym) => {
    set({ gym });
  },

  isAuthenticated: () => {
    return !!get().token;
  },
}));

export default useAuthStore;