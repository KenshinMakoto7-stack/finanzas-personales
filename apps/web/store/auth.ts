import { create } from "zustand";
import api, { setAuthToken } from "../lib/api";

type User = { id: string; email: string; name?: string; currencyCode: string; locale?: string; timeZone?: string };
type State = { user?: User; token?: string; login: (email:string, password:string)=>Promise<void>; logout: ()=>void; register:(p:any)=>Promise<void> };

export const useAuth = create<State>((set) => ({
  async login(email, password) {
    try {
      const res = await api.post("/auth/login", { email, password });
      setAuthToken(res.data.token);
      set({ token: res.data.token, user: res.data.user });
      if (typeof window !== "undefined") localStorage.setItem("token", res.data.token);
    } catch (error: any) {
      if (error.code === "ECONNREFUSED" || error.message?.includes("Network Error")) {
        throw new Error("No se pudo conectar con el servidor. Verifica que la API esté corriendo en http://localhost:4000");
      }
      throw error;
    }
  },
  logout() {
    setAuthToken(undefined);
    set({ token: undefined, user: undefined });
    if (typeof window !== "undefined") localStorage.removeItem("token");
  },
  async register(payload) {
    try {
      const res = await api.post("/auth/register", payload);
      setAuthToken(res.data.token);
      set({ token: res.data.token, user: res.data.user });
      if (typeof window !== "undefined") localStorage.setItem("token", res.data.token);
    } catch (error: any) {
      if (error.code === "ECONNREFUSED" || error.message?.includes("Network Error")) {
        throw new Error("No se pudo conectar con el servidor. Verifica que la API esté corriendo en http://localhost:4000");
      }
      throw error;
    }
  }
}));


