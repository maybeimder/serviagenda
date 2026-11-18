import type { Request, Response } from "express";
import { valid } from "../middlewares/validate";
import { variantQuery } from "../schemas/common";
import { coordinationBody, patientCoordinationBody, patientParams, sessionsBody, sessionsQuery, stateBody } from "../schemas/agenda.schema";
import { AgendaService } from "../services/agenda.service";

/** Solo HTTP: leer lo ya validado, llamar al service y responder. */
export const AgendaController = {
      // ---------- coordinación ----------
      async getCoordination(_req: Request, res: Response) {
            const { variant } = valid(res, "query", variantQuery);
            res.json(await AgendaService.getCoordination(variant));
      },

      async replaceCoordination(_req: Request, res: Response) {
            const { variant } = valid(res, "query", variantQuery);
            res.json(await AgendaService.replaceCoordination(variant, valid(res, "body", coordinationBody)));
      },

      async setPatientCoordination(_req: Request, res: Response) {
            const { variant } = valid(res, "query", variantQuery);
            const { patientId } = valid(res, "params", patientParams);
            const { therapistIds } = valid(res, "body", patientCoordinationBody);
            res.json(await AgendaService.setPatientCoordination(variant, patientId, therapistIds));
      },

      // ---------- sesiones ----------
      async getSessions(_req: Request, res: Response) {
            const { variant, ...filters } = valid(res, "query", sessionsQuery);
            res.json(await AgendaService.getSessions(variant, filters));
      },

      async replaceSessions(_req: Request, res: Response) {
            const { variant } = valid(res, "query", variantQuery);
            res.json(await AgendaService.replaceSessions(variant, valid(res, "body", sessionsBody)));
      },

      // ---------- coordinación + sesiones, juntas ----------
      async replaceState(_req: Request, res: Response) {
            const { variant } = valid(res, "query", variantQuery);
            res.json(await AgendaService.replaceState(variant, valid(res, "body", stateBody)));
      },
};
