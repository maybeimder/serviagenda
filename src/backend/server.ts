import { createApp } from "./app";
import { env } from "./config";
import { closePool } from "./connection/db";

const app = createApp();
const server = app.listen(env.PORT, () => console.log(`[api] escuchando en http://localhost:${env.PORT}/api (${env.NODE_ENV})`));

// Cierre ordenado: deja de aceptar peticiones y libera las conexiones a la base
function shutdown(signal: string) {
      console.log(`[api] ${signal}: cerrando…`);
      server.close(async () => { await closePool(); process.exit(0); });
      setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
