import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const refresh = useCallback(async () => {
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
