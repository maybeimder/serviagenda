import cors from "cors";
import express from "express";
import { config, env } from "./config";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { requestLogger } from "./middlewares/requestLogger";
import { apiRouter } from "./routes";

/** Construye la app de Express (sin escuchar): así se puede probar o montar en otro servidor. */
export function createApp() {
      const app = express();

      app.disable("x-powered-by");
      app.use(cors({ origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()) }));
      // sessions.json completo (miles de sesiones) pesa varios MB
      app.use(express.json({ limit: "25mb" }));
      app.use(requestLogger);

      app.use(config.apiPrefix, apiRouter);

      app.use(notFoundHandler);
      app.use(errorHandler);
      return app;
}
