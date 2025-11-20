# Seguridad
- Contraseñas: Argon2.
- JWT con secreto fuerte; expiración 7 días.
- Validación Zod en todas las entradas.
- Logs de acceso y errores (pino/morgan).
- CORS restringido en producción.
- Rate limiting recomendado en /auth/* (añadir express-rate-limit o rate-limiter-flexible).
- Backups de DB.
- Variables en .env (no commitear).



