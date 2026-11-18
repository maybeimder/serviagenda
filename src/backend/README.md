# Backend (Express + Postgres/Supabase)

Guarda en el esquema `agenda` lo que hoy vive como JSON en `src/data/`.

```
src/backend/
  server.ts            arranque + cierre ordenado
  app.ts               arma Express (cors, json, logger, rutas, errores)
  config/              env.ts (variables validadas), database.ts (config del Pool)
  connection/db.ts     Pool, query(), withTransaction(), withReadOnly()
  routes/              agenda.route.ts, users.route.ts, health.route.ts, index.ts
  controllers/         SOLO HTTP: leen lo validado, llaman al service y responden
  services/            reglas de negocio; consumen lo que devuelven los models
  models/              TODO lo de la base (SQL) — devuelven filas, no JSON de la API
  schemas/             validación de entrada con zod
  middlewares/         validate, errorHandler (+404), requestLogger
  db/                  migrations/*.sql y scripts: inspect, migrate, seed
  utils/errors.ts      AppError (código HTTP + mensaje)
```

Capas: `route → middleware(validate) → controller → service → model → db`.

## .env

| Variable | |
|---|---|
| `SUPABASE_CONNECTION_STRING` | `postgresql://usuario:clave@host:puerto/db`, o `jdbc:postgresql://host:puerto/db` si usuario y clave van aparte |
| `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD` | solo si la cadena no trae credenciales |
| `PORT` (3001), `CORS_ORIGINS`, `DB_SSL` (true) | opcionales |

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm api:dev` / `pnpm api:start` | servidor en `http://localhost:3001/api` |
| `pnpm db:inspect` | solo lectura (transacción `READ ONLY`): esquemas, tablas de `agenda` y filas |
| `pnpm db:migrate` | solo lectura: dice qué migraciones faltan. `-- --apply` las aplica (solo `CREATE … IF NOT EXISTS`) |
| `pnpm db:seed` | solo lectura: valida los JSON y muestra qué cargaría. `-- --apply` carga si las tablas están vacías; `--force` reemplaza; `--only=patients,therapists,coordination,sessions` |

## Docker

- **Dev (por defecto):** `docker compose up --build` -> frontend con Vite en http://localhost:5173 y API en http://localhost:3001/api, con el código montado como volumen (recarga en caliente, sin build).
- **Producción:** `docker compose -f docker-compose.prod.yml up --build` -> frontend compilado en nginx (http://localhost:8080, redirige `/api` a la API).

Usan el `.env` de la raíz. Scripts de la base: `docker compose run --rm api pnpm db:inspect`.

## Frontend

`pnpm dev` (Vite) proxea `/api/agenda|users|health` a `http://localhost:3001` (`API_URL` lo cambia), así que hay que tener `pnpm api:dev` corriendo. `src/frontend/data/dataFiles.ts` es la única capa que habla con la API; al arrancar, `app/Boot.tsx` carga pacientes y terapeutas antes de montar la app. Con `VITE_DATA_SOURCE=files` se vuelve a los JSON de `src/data` (plugin de Vite, sin base).

## Endpoints

`?variant=current|optimal` (por defecto `current`) elige entre el estado real y el óptimo calculado.

| | |
|---|---|
| `GET /api/health` · `GET /api/health/db` | vivo · conexión + esquema + tablas (503 si no está lista) |
| `GET /api/users/patients` · `/:id` · `PUT /:id` | mapa id → paciente (igual que patients.json); edición parcial |
| `GET /api/users/therapists` · `/:id` · `PUT /:id` | ídem para terapeutas |
| `GET /api/agenda/coordination` | mapa `patientId → therapistId \| therapistId[]` |
| `PUT /api/agenda/coordination` | reemplaza todo el mapa de la variante |
| `PUT /api/agenda/coordination/:patientId` `{ therapistIds }` | reemplaza solo a ese paciente |
| `GET /api/agenda/sessions?week=&therapistId=&patientId=` | mapa `sessionId → sesión` (igual que sessions.json) |
| `PUT /api/agenda/sessions` | reemplaza todas las sesiones de la variante |
| `PUT /api/agenda/state` `{ coordination, sessions }` | guarda ambas JUNTAS en una transacción; 400 `SESSION_WITHOUT_COORDINATION` si una sesión tiene un terapeuta que no está en la coordinación de su paciente |

Errores: siempre `{ "error": { "code", "message" } }`.
