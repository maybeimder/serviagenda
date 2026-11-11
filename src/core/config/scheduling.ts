import { Day } from "../types/base";
import { CONFIG } from "./businessrules";

export const DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const { SessionDuration } = CONFIG;

/** Duración de un slot, en minutos. */
export const SLOT_MINS = SessionDuration * 60;
/** Máximo de slots semanales de un terapeuta. */
export const MAX_WEEKLY_SLOTS = CONFIG.TherapistRelated.WeeklyHours.max / SessionDuration;
/** Cada terapeuta de un paciente debe darle al menos 1h. */
export const MIN_BLOCK_SLOTS = 1 / SessionDuration;
