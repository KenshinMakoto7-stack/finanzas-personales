# API (resumen)
- POST /auth/register { email, password, currencyCode?, locale?, timeZone? } -> { token, user }
- POST /auth/login { email, password } -> { token, user }
- GET  /auth/me -> { user }
- PUT  /auth/prefs { currencyCode?, locale?, timeZone?, name? } -> { user }

- GET  /accounts
- POST /accounts { name, type, currencyCode }
- PUT  /accounts/:id { name? }
- DELETE /accounts/:id

- GET  /categories?type=EXPENSE|INCOME
- POST /categories { name, type, parentId? }
- PUT  /categories/:id { name? }
- DELETE /categories/:id

- GET  /transactions?from&to&categoryId&accountId&page&pageSize
- POST /transactions { accountId, categoryId?, type, amountCents, occurredAt, description? }
- PUT  /transactions/:id { ... }
- DELETE /transactions/:id

- PUT  /goals/:year/:month { savingGoalCents }
- GET  /goals/:year/:month

- GET  /budget/summary?date=YYYY-MM-DD   -> cálculo promedio/rollover
- GET  /reports/monthly-by-category?year&month&type=EXPENSE|INCOME
- GET  /export/csv?from&to
- GET  /export/json?from&to
- GET  /alerts/preview?date=YYYY-MM-DD



