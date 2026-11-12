import { Area, Day } from "./base";
import { Session } from "./dtos";

export type Mode = "home" | "site";

/** Slot de un terapeuta: modo + pacientes que atiende a la vez (>1 = sesión cruzada). */
export type Cell = { mode: Mode; patientIds: string[] };

/** Un paciente atendido por un terapeuta en un slot de 30 min. */
export type Placement = { patientId: string; therapistId: string; day: Day; slot: number; mode: Mode };

export type AreaBySlot = Map<string, Area>;

/** Plan del mes: un ScheduleResult por semana + lo que quedó sin cubrir al cierre del mes. */
export type MonthlyResult = {
      weeks: ScheduleResult[];
      unmet: { patientId: string; area: Area; missing: number }[];
      /** constraints que solo tienen sentido sobre el mes (1h mínima por terapeuta) */
      violations: string[];
      /** causas de infactibilidad que vienen de los datos (sobre la demanda mensual) */
      dataIssues: string[];
};

export type ScheduleResult = {
      sessions: Session[];
      /** sesiones requeridas que no se pudieron ubicar, por paciente y área */
      unmet: { patientId: string; area: Area; missing: number }[];
      /** horas semanales por terapeuta (slots ocupados, cruzadas cuentan 1) */
      therapistHours: Record<string, number>;
      /** incumplimientos de constraints (vacío = plan válido) */
      violations: string[];
      /** causas de infactibilidad que vienen de los datos, no del algoritmo */
      dataIssues: string[];
};
