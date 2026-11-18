import { withTransaction } from "../connection/db";
import type { CoordinationRow, SessionRow, Variant } from "../types";
import { CoordinationModel } from "./coordination.model";
import { SessionModel } from "./session.model";

/** Operaciones que tocan varias tablas de la agenda a la vez, siempre en UNA transacción. */
export const AgendaModel = {
      /**
       * Reemplaza la coordinación y las sesiones de una variante juntas: o se guarda todo o no cambia nada, así nunca
       * quedan sesiones con un terapeuta que no está en la coordinación del paciente.
       */
      async replaceState(variant: Variant, coordination: CoordinationRow[], sessions: SessionRow[]): Promise<{ links: number, sessions: number }> {
            return withTransaction(async (tx) => ({
                  links: await CoordinationModel.replaceAll(variant, coordination, tx),
                  sessions: await SessionModel.replaceAll(variant, sessions, tx),
            }));
      },
};
