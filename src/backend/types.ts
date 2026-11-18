import type { Area, City, Day, Schedule, TimeRange } from "../core/types/base";

/** 'current' = estado real (coordination.json / sessions.json); 'optimal' = óptimo calculado (opt_*.json). */
export const VARIANTS = ["current", "optimal"] as const;
export type Variant = (typeof VARIANTS)[number];

/** Forma de una persona tal como se guarda en patients.json / therapists.json (el id es la llave del mapa). */
export type PatientRecord = {
      name: string
      city: City
      disponibility: { home?: Schedule, site: Schedule }
      sessionsRequirements: Partial<Record<Area, number>>
};
export type TherapistRecord = { name: string, city: City, disponibility: Schedule };

export type PatientsMap = Record<string, PatientRecord>;
export type TherapistsMap = Record<string, TherapistRecord>;

/** Una sesión como la guarda sessions.json: solo ids, los datos salen de patients/therapists. */
export type StoredSession = {
      week: number
      day: Day
      schedule: TimeRange
      therapistId: string
      patients: Record<string, Area>
      atHome: boolean
};
export type StoredSessions = Record<string, StoredSession>;

/** patientId -> therapistId, o una lista de therapistIds si son varios. */
export type CoordinationMap = Record<string, string | string[]>;

export type SessionFilters = { week?: number, therapistId?: string, patientId?: string };

/** Fila de coordinación tal como sale de la base. */
export type CoordinationRow = { patientId: string, therapistId: string };

/** Fila de sesión (ya con sus pacientes) tal como sale de la base. */
export type SessionRow = {
      id: string
      week: number
      day: Day
      start: string   // "HH:MM"
      end: string     // "HH:MM"
      therapistId: string
      atHome: boolean
      patients: Record<string, Area>
};
