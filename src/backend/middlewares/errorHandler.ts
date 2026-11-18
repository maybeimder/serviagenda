import type { ErrorRequestHandler, RequestHandler } from "express";
import { isProduction } from "../config";
import { AppError } from "../utils/errors";

/** Rutas que no existen. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
      next(new AppError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`, "ROUTE_NOT_FOUND"));
};

/** Código de error de Postgres -> respuesta HTTP entendible. */
function fromPostgres(code: string | undefined): AppError | null {
      switch (code) {
            case "42P01": // undefined_table
            case "3F000": // invalid_schema_name
                  return new AppError(503, "El esquema `agenda` todavía no está creado. Ejecuta `pnpm db:migrate -- --apply`.", "SCHEMA_NOT_READY");
            case "28P01": // invalid_password
            case "28000": // invalid_authorization_specification
                  return new AppError(503, "La base de datos rechazó las credenciales.", "DB_AUTH");
            case "ENOTFOUND": // el host no resuelve (Supabase: `db.<ref>.supabase.co` es solo IPv6; en redes IPv4 hay que usar el pooler)
                  return new AppError(503, "No se encontró el host de la base de datos. Si es `db.<proyecto>.supabase.co` y tu red no tiene IPv6, usa la cadena del Session pooler (Supabase > Connect): `aws-0-<región>.pooler.supabase.com`, con usuario `postgres.<proyecto>`.", "DB_HOST_NOT_FOUND");
            case "ECONNREFUSED":
            case "ETIMEDOUT":
            case "ENETUNREACH":
                  return new AppError(503, "No se pudo conectar a la base de datos (host o puerto inalcanzable).", "DB_UNREACHABLE");
            case "23503": // foreign_key_violation
                  return new AppError(409, "Hace referencia a un paciente o terapeuta que no existe.", "FOREIGN_KEY");
            case "23505": // unique_violation
                  return new AppError(409, "Ya existe un registro igual.", "DUPLICATE");
            case "23514": // check_violation
                  return new AppError(400, "Un valor no cumple las reglas de la base de datos.", "CHECK_VIOLATION");
            default:
                  return null;
      }
}

/** Último middleware: toda la app responde errores con la misma forma { error: { code, message } }. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
      const code = (err as { code?: string }).code;
      const known = err instanceof AppError ? err : fromPostgres(code);

      // JSON mal formado en el body
      if (!known && (err as { type?: string }).type === "entity.parse.failed")
            return void res.status(400).json({ error: { code: "INVALID_JSON", message: "El cuerpo no es un JSON válido." } });
      if (!known && (err as { type?: string }).type === "entity.too.large")
            return void res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "El cuerpo es demasiado grande." } });

      if (known) {
            if (known.status >= 500) console.error(`[api] ${known.code}:`, err);
            return void res.status(known.status).json({ error: { code: known.code, message: known.message } });
      }

      console.error("[api] error no controlado:", err);
      res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: isProduction ? "Error interno del servidor." : String((err as Error)?.message ?? err) },
      });
};
