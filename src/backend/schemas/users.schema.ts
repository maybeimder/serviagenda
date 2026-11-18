import { z } from "zod";
import { areaSchema, citySchema, scheduleSchema } from "./common";

/** Edición parcial de un paciente: solo los campos que vienen cambian. */
export const updatePatientBody = z.object({
      name: z.string().trim().min(1).optional(),
      city: citySchema.optional(),
      disponibility: z.object({ home: scheduleSchema.optional(), site: scheduleSchema }).optional(),
      sessionsRequirements: z.partialRecord(areaSchema, z.number().int().positive()).optional(),
}).strict().refine((b) => Object.keys(b).length > 0, "Envía al menos un campo");

export const updateTherapistBody = z.object({
      name: z.string().trim().min(1).optional(),
      city: citySchema.optional(),
      disponibility: scheduleSchema.optional(),
}).strict().refine((b) => Object.keys(b).length > 0, "Envía al menos un campo");
