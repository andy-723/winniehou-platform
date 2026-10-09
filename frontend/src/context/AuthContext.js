import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { DEV_AUTOLOGIN_ENABLED, DEV_ADMIN } from "@/lib/config";

// Hard-guard: auto-login can ONLY run on the preview host, never on a deployed domain.
const DEV_AUTOLOGIN = DEV_AUTOLOGIN_ENABLED && typeof window !== "undefined" && /(^|\.)preview\./.test(window.location.hostname);

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const refresh = useCallback(async () => {
    // DEV/TESTING: if no session yet, sign in as admin automatically (preview only).
    if (DEV_AUTOLOGIN && !localStorage.getItem("access_token")) {
      try {
        const { data } = await api.post("/auth/login", DEV_ADMIN);
        localStorage.setItem("access_token", data.access_token);
        setUser(data.user);
        return;
      } catch { /* fall through to normal flow */ }
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      try {
        const { data } = await api.post("/auth/refresh");
        localStorage.setItem("access_token", data.access_token);
        setUser(data.user);
      } catch {
        localStorage.removeItem("access_token");
        setUser(false);
      }
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const applyAuth = (data) => {
    localStorage.setItem("access_token", data.access_token);
    setUser(data.user);
    return data.user;
  };

  const login = async (email, password) => applyAuth((await api.post("/auth/login", { email, password })).data);
  const register = async (name, email, password) =>
    applyAuth((await api.post("/auth/register", { name, email, password })).data);
  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("access_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refresh, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
