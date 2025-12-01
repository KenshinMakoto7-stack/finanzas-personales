import { create } from "zustand";
import { persist } from "zustand/middleware";
import api, { setAuthToken } from "../lib/api";

type User = { id: string; email: string; name?: string; currencyCode: string; locale?: string; timeZone?: string };
type State = { 
  user?: User; 
  token?: string; 
  initialized: boolean;
  login: (email:string, password:string)=>Promise<void>; 
  logout: ()=>void; 
  register:(p:any)=>Promise<void>;
  initAuth: ()=>void;
};

export const useAuth = create<State>()(
  persist(
    (set, get) => ({
      initialized: false,
      initAuth() {
        const token = get().token;
        if (token) {
          setAuthToken(token);
        }
        set({ initialized: true });
      },
      async login(email, password) {
        try {
          const res = await api.post("/auth/login", { email, password });
          setAuthToken(res.data.token);
          set({ token: res.data.token, user: res.data.user });
        } catch (error: any) {
          if (error.code === "ECONNREFUSED" || error.message?.includes("Network Error")) {
            throw new Error("No se pudo conectar con el servidor.");
          }
          throw error;
        }
      },
      logout() {
        setAuthToken(undefined);
        set({ token: undefined, user: undefined });
      },
      async register(payload) {
        try {
          const res = await api.post("/auth/register", payload);
          setAuthToken(res.data.token);
          set({ token: res.data.token, user: res.data.user });
        } catch (error: any) {
          // Mejorar manejo de errores con más detalles
          if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
            throw new Error("La solicitud tardó demasiado. Verifica tu conexión e intenta nuevamente.");
          }
          if (error.code === "ECONNREFUSED" || error.message?.includes("Network Error")) {
            throw new Error("No se pudo conectar con el servidor. Verifica tu conexión.");
          }
          // Re-lanzar el error para que el componente lo maneje
          throw error;
        }
      }
    }),
    {
      name: "auth-storage",
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          setAuthToken(state.token);
        }
        state?.initAuth();
      }
    }
  )
);


