import { create } from "zustand";
import { apiFetch } from "../services/api";

const useAuthStore = create((set, get) => ({
  token: localStorage.getItem("token") || null,
  user: null,
  gym: null,

  must_change_password: false,

  loading: false,
  error: null,

  initialized: false,

  // 🔥 HYDRATION (importante para refresh)
  hydrate: async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      set({ initialized: true });
      return;
    }

    set({ token });

    try {
      const data = await apiFetch("/api/auth/me/");

      set({
        user: { username: data.username },
        gym: data.gym ? { name: data.gym, id: data.gym_id } : null,
        must_change_password: data.must_change_password || false,
        initialized: true,
      });
    } catch {
      localStorage.removeItem("token");

      set({
        token: null,
        user: null,
        gym: null,
        must_change_password: false,
        initialized: true,
      });
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

if (typeof window !== "undefined") {
  window.addEventListener("auth:unauthorized", () => {
    const state = useAuthStore.getState();
    if (state.token) {
      state.logout();
    }
  });
}

export default useAuthStore;