import { Router } from "express";
import { agendaRouter } from "./agenda.route";
import { healthRouter } from "./health.route";
import { usersRouter } from "./users.route";

/** Todas las rutas de la API, montadas bajo /api (ver app.ts). */
export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/agenda", agendaRouter);
