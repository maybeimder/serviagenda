import { z } from "zod";
import { areaSchema, daySchema, timeRangeSchema, variantSchema } from "./common";

/** patientId -> therapistId, o lista de therapistIds. */
export const coordinationBody = z.record(z.string(), z.union([z.string(), z.array(z.string())]));

export const patientParams = z.object({ patientId: z.string().min(1) });

export const patientCoordinationBody = z.object({ therapistIds: z.array(z.string().min(1)) });

export const sessionsQuery = z.object({
      variant: variantSchema.default("current"),
      week: z.coerce.number().int().min(1).optional(),
      therapistId: z.string().min(1).optional(),
      patientId: z.string().min(1).optional(),
});

/** sessions.json: sessionId -> sesión (solo ids; los datos salen de patients/therapists). */
const sessionsRecord = z.record(z.string(), z.object({
      week: z.number().int().min(1),
      day: daySchema,
      schedule: timeRangeSchema,
      therapistId: z.string().min(1),
      patients: z.record(z.string().min(1), areaSchema).refine((p) => Object.keys(p).length > 0, "Una sesión necesita al menos un paciente"),
      atHome: z.boolean(),
}));

export const sessionsBody = sessionsRecord;

/** Coordinación y sesiones de una variante, guardadas juntas. */
export const stateBody = z.object({ coordination: coordinationBody, sessions: sessionsRecord });
