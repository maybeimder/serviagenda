import { Day } from "../types/base";
import { CONFIG } from "./businessrules";

export const DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const { SessionDuration } = CONFIG;

export const SLOT_MINS = SessionDuration * 60;
export const MAX_WEEKLY_SLOTS = CONFIG.TherapistRelated.WeeklyHours.max / SessionDuration;
export const MIN_WEEKLY_SLOTS = CONFIG.TherapistRelated.WeeklyHours.min / SessionDuration;
export const MAX_DAILY_SLOTS = CONFIG.PatientRelated.maxDailyHours / SessionDuration;
export const MAX_PARALLEL_PATIENTS = CONFIG.TherapistRelated.PatientsAtTheSameTime.max;
/** Slots vacíos requeridos entre dos sesiones de un terapeuta en lugares distintos. */
export const TRAVEL_SLOTS = Math.ceil(CONFIG.TravelMinutes / SLOT_MINS);
/** Cada terapeuta de un paciente debe darle al menos 1h. */
export const MIN_BLOCK_SLOTS = 1 / SessionDuration;

/** Pesos del costo de colocar una sesión (menor = mejor). */
export const WEIGHTS = {
      patientAdjacent: -10,
      patientSameTherapistAdjacent: -6,
      patientGapPerSlot: 4,
      therapistAdjacent: -4,
      therapistGap: 3,
      therapistNewDay: 2,
      crossed: -5,
      /** abrir un slot nuevo a un terapeuta que aún no llega al mínimo semanal */
      belowMin: -12,
      home: 1,
      load: 6,
      dayLoad: 0.5,
      /** terapeuta que aún no completa 1h con el paciente en el mes */
      underServed: -40,
      /** repetir la misma sesión (paciente, terapeuta, día, hora) de la semana anterior */
      repeatLastWeek: -8,
      lateTieBreak: 0.001,
};
