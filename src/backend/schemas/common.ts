import { z } from "zod";
import { VARIANTS } from "../types";

export const citySchema = z.enum(["CTG", "STM", "NVA"]);
export const areaSchema = z.enum(["fono", "fisio", "teo", "psico", "acom", "inte", "neuro"]);
export const daySchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export const variantSchema = z.enum(VARIANTS);

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida, usa HH:MM");
export const timeRangeSchema = z.object({ start: hhmm, end: hhmm }).refine((r) => r.end > r.start, "El fin debe ser posterior al inicio");

/** { mon: { start, end }, ... } con solo los días que aplican. */
export const scheduleSchema = z.partialRecord(daySchema, timeRangeSchema);

export const idParams = z.object({ id: z.string().min(1) });
export const variantQuery = z.object({ variant: variantSchema.default("current") });
