import "dotenv/config";
import { z } from "zod";

/**
 * Variables de entorno validadas una sola vez al arrancar. Cualquier otro archivo del backend importa `env`,
 * nunca lee `process.env` directamente.
 */
const schema = z.object({
      NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
      PORT: z.coerce.number().int().positive().default(3001),

      /** Orígenes permitidos por CORS, separados por coma. */
      CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:4173"),

      /**
       * Cadena de conexión a Supabase/Postgres. Acepta `postgresql://usuario:clave@host:puerto/db` o el formato JDBC
       * `jdbc:postgresql://host:puerto/db` (sin credenciales: entonces hacen falta SUPABASE_DB_USER y SUPABASE_DB_PASSWORD).
       */
      SUPABASE_CONNECTION_STRING: z.string().min(1, "Falta SUPABASE_CONNECTION_STRING en el .env"),
      SUPABASE_DB_USER: z.string().optional(),
      SUPABASE_DB_PASSWORD: z.string().optional(),

      /** SSL hacia la base. Supabase lo exige; se puede apagar con DB_SSL=false para una base local. */
      DB_SSL: z.enum(["true", "false"]).default("true"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
      const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`Configuración inválida:\n${problems}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
