import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const api = axios.create({ baseURL });

// Interceptor para manejar errores de conexión
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ECONNREFUSED" || error.message?.includes("Network Error")) {
      error.message = "No se pudo conectar con el servidor. Verifica que la API esté corriendo en http://localhost:4000";
    }
    return Promise.reject(error);
  }
);

export function setAuthToken(token?: string) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

export default api;


