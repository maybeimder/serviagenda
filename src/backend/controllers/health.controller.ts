import type { Request, Response } from "express";
import { HealthService } from "../services/health.service";

export const HealthController = {
      /** El proceso está vivo (no toca la base). */
      live(_req: Request, res: Response) {
            res.json({ status: "ok", uptime: Math.round(process.uptime()) });
      },

      /** Estado de la base: conexión, esquema y tablas. 503 si no está lista. */
      async database(_req: Request, res: Response) {
            const status = await HealthService.database();
            res.status(status.ready ? 200 : 503).json(status);
      },
};
