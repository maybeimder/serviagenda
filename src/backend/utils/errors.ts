/** Error con código HTTP: lo lanzan services/models y lo traduce el middleware errorHandler. */
export class AppError extends Error {
      constructor(
            public readonly status: number,
            message: string,
            public readonly code?: string,
      ) {
            super(message);
            this.name = "AppError";
      }
}

export const badRequest = (message: string, code = "BAD_REQUEST") => new AppError(400, message, code);
export const notFound = (message: string, code = "NOT_FOUND") => new AppError(404, message, code);
export const conflict = (message: string, code = "CONFLICT") => new AppError(409, message, code);
