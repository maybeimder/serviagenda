import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType, z } from "zod";
import { badRequest } from "../utils/errors";

type Schemas = { body?: ZodType, query?: ZodType, params?: ZodType };
type Source = keyof Schemas;

const SOURCES: Source[] = ["params", "query", "body"];

/**
 * Valida (y normaliza: coerciones, defaults) body, query y params con zod antes de llegar al controller.
 * Los datos ya validados quedan en `res.locals.valid`; léelos con `valid(res, "body")`.
 * Si algo no cumple responde 400 con el detalle de cada campo.
 */
export function validate(schemas: Schemas): RequestHandler {
      return (req: Request, res: Response, next: NextFunction) => {
            const parsedData: Partial<Record<Source, unknown>> = {};

            for (const source of SOURCES) {
                  const schema = schemas[source];
                  if (!schema) continue;
                  const result = schema.safeParse(req[source]);
                  if (!result.success) {
                        const details = result.error.issues.map((i) => `${source}${i.path.length ? "." + i.path.join(".") : ""}: ${i.message}`);
                        return next(badRequest(`Datos inválidos — ${details.slice(0, 5).join("; ")}${details.length > 5 ? ` (+${details.length - 5} más)` : ""}`, "VALIDATION_ERROR"));
                  }
                  parsedData[source] = result.data;
            }

            res.locals.valid = { ...res.locals.valid, ...parsedData };
            next();
      };
}

/** Datos ya validados de una parte de la petición; el tipo sale del schema que se le pasa. */
export function valid<S extends ZodType>(res: Response, source: Source, _schema?: S): z.output<S> {
      return res.locals.valid?.[source];
}
