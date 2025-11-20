export const openApiDoc = {
  openapi: "3.0.0",
  info: { title: "Personal Finance API", version: "1.0.0" },
  servers: [{ url: "http://localhost:4000" }],
  paths: {
    "/auth/register": { post: { summary: "Registro", responses: { "200": { description: "OK" } } } },
    "/auth/login": { post: { summary: "Login", responses: { "200": { description: "OK" } } } },
    "/budget/summary": { get: { summary: "Resumen presupuesto", parameters: [{ name: "date", in: "query" }], responses: { "200": { description: "OK" } } } }
    // Agrega más rutas según controllers
  }
} as const;



