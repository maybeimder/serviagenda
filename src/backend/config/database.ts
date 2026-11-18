import type { PoolConfig } from "pg";
import { AppError } from "../utils/errors";
import { env } from "./env";

/** Esquema de Postgres donde vive todo lo de la agenda. */
export const SCHEMA = "agenda";

/**
 * Convierte SUPABASE_CONNECTION_STRING en la configuración del Pool.
 * - Quita el prefijo `jdbc:` si lo trae.
 * - Si la cadena no trae usuario/clave, los toma de SUPABASE_DB_USER / SUPABASE_DB_PASSWORD.
 */
export function buildPoolConfig(): PoolConfig {
      const raw = env.SUPABASE_CONNECTION_STRING.replace(/^jdbc:/i, "");
      const url = new URL(raw);

      if (env.SUPABASE_DB_USER) url.username = env.SUPABASE_DB_USER;
      if (env.SUPABASE_DB_PASSWORD) url.password = env.SUPABASE_DB_PASSWORD;

      const hasCredentials = url.username !== "" && url.password !== "";
      if (!hasCredentials)
            throw new AppError(
                  503,
                  "La cadena de conexión no incluye usuario y contraseña. Usa una URL completa " +
                  "(postgresql://usuario:clave@host:puerto/db) o define SUPABASE_DB_USER y SUPABASE_DB_PASSWORD en el .env.",
                  "DB_CONFIG",
            );

      return {
            connectionString: url.toString(),
            ssl: env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
            max: 10,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
            // Sin `options: -c search_path`: el pooler de Supabase (modo transacción) no admite ese parámetro de arranque.
            // Por eso todas las consultas llevan el esquema explícito (agenda.<tabla>).
      };
}
