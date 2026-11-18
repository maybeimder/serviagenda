import type { RequestHandler } from "express";

/** Una línea por petición: método, ruta, estado y duración. */
export const requestLogger: RequestHandler = (req, res, next) => {
      const start = process.hrtime.bigint();
      res.on("finish", () => {
            const ms = Number(process.hrtime.bigint() - start) / 1e6;
            console.log(`[api] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms.toFixed(0)} ms)`);
      });
      next();
};
