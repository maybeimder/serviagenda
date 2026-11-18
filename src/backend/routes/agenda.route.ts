import { Router } from "express";
import { AgendaController } from "../controllers/agenda.controller";
import { validate } from "../middlewares/validate";
import { variantQuery } from "../schemas/common";
import { coordinationBody, patientCoordinationBody, patientParams, sessionsBody, sessionsQuery, stateBody } from "../schemas/agenda.schema";

/** /api/agenda: coordinación y sesiones. `?variant=current|optimal` (por defecto current). */
export const agendaRouter = Router();

agendaRouter.get("/coordination", validate({ query: variantQuery }), AgendaController.getCoordination);
agendaRouter.put("/coordination", validate({ query: variantQuery, body: coordinationBody }), AgendaController.replaceCoordination);
agendaRouter.put(
      "/coordination/:patientId",
      validate({ query: variantQuery, params: patientParams, body: patientCoordinationBody }),
      AgendaController.setPatientCoordination,
);

agendaRouter.get("/sessions", validate({ query: sessionsQuery }), AgendaController.getSessions);
agendaRouter.put("/sessions", validate({ query: variantQuery, body: sessionsBody }), AgendaController.replaceSessions);

// Coordinación + sesiones en una sola transacción (cada paciente de una sesión debe tener a su terapeuta coordinado)
agendaRouter.put("/state", validate({ query: variantQuery, body: stateBody }), AgendaController.replaceState);
