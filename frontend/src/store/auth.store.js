import { create } from "zustand";
import { apiFetch } from "../services/api";

const useAuthStore = create((set, get) => ({
  token: localStorage.getItem("token") || null,
  user: null,
  gym: null,

  must_change_password: false,

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

      localStorage.setItem("token", data.token);

      set({
        token: data.token,
        user: data.user || {
          username: data.username,
        },
        gym: data.gym || null,

        must_change_password:
          data.must_change_password || false,

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
      must_change_password: false,
      error: null,
    });
  },

  clearMustChangePassword: () => {
    set({
      must_change_password: false,
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