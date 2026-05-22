import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "ROLE_ADMIN" | "ROLE_ANALYST" | "ROLE_OBSERVER";

export interface AuthUser {
  username: string;
  token: string;
  role: Role;
}

interface AuthCtx {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  ready: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);
const STORAGE_KEY = "siem_auth";

// Real system authentication endpoint (Java Spring Boot)
const BASE_API = import.meta.env.VITE_API_URL || "http://localhost:8080";
const AUTH_URL = `${BASE_API}/api/auth/signin`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(AUTH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error("ACCESS DENIED · Invalid biometric signature");
      }

      const data = await response.json();
      
      let role: Role = "ROLE_OBSERVER";
      if (data.roles && data.roles.length > 0) {
        if (data.roles.includes("ROLE_ADMIN")) role = "ROLE_ADMIN";
        else if (data.roles.includes("ROLE_ANALYST")) role = "ROLE_ANALYST";
      }

      const u: AuthUser = {
        username: data.username || username.trim(),
        token: data.accessToken || data.token,
        role: role,
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      window.localStorage.setItem("siem_jwt", u.token);
      setUser(u);
      return u;
    } catch (error) {
      console.error("Login Error:", error);
      throw error;
    }
  };

  const logout = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem("siem_jwt");
    setUser(null);
  };

  return <Ctx.Provider value={{ user, login, logout, ready }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function landingFor(role: Role): "/dashboard/admin" | "/dashboard/war-room" | "/dashboard/map-view" {
  switch (role) {
    case "ROLE_ADMIN":
      return "/dashboard/admin";
    case "ROLE_ANALYST":
      return "/dashboard/war-room";
    case "ROLE_OBSERVER":
      return "/dashboard/map-view";
  }
}
