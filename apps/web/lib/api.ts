import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const api = axios.create({ 
  baseURL,
  timeout: 10000, // 10 segundos de timeout (reducido de 30s para mejor UX)
});

// Interceptor para manejar errores de conexión y timeout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Manejar 401 Unauthorized - token expirado o inválido
    if (error.response?.status === 401) {
      // No hacer nada aquí, dejar que cada componente maneje el 401
      // Algunos componentes redirigen al login, otros muestran un mensaje
      return Promise.reject(error);
    }
    // Manejar timeout
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      error.message = "La solicitud tardó demasiado. Por favor, intenta nuevamente.";
      error.response = { data: { error: "Timeout: La solicitud tardó demasiado. Verifica tu conexión." } };
    }
    // Manejar errores de conexión
    else if (error.code === "ECONNREFUSED" || error.message?.includes("Network Error")) {
      error.message = "No se pudo conectar con el servidor. Verifica que la API esté corriendo.";
      error.response = { data: { error: "No se pudo conectar con el servidor. Verifica tu conexión." } };
    }
    // Manejar errores sin respuesta
    else if (!error.response) {
      error.response = { 
        data: { error: error.message || "Error de conexión. Por favor, intenta nuevamente." } 
      };
    }
    return Promise.reject(error);
  }
);

export function setAuthToken(token?: string) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

export default api;


