import { Area, Day, TimeRange } from "../types/base";
import { Patient, Session, Therapist } from "../types/dtos";
import { MonthlyResult } from "../types/scheduling";

/** Sesión de una semana concreta del mes (1 a 4). El DTO Session no sabe de semanas. */
export type WeekSession = Session & { week: number };

/** Cómo se guarda una sesión en sessions.json / opt_sessions.json (solo ids; los datos salen de patients/therapists). */
export type StoredSession = {
      week: number
      day: Day
      schedule: TimeRange
      therapistId: string
      /** patientId -> área en que se le atiende; "cruzada" es tener 2 o más */
      patients: Record<string, Area>
      atHome: boolean
};

/** Archivo de sesiones: sessionId -> sesión. */
export type StoredSessions = Record<string, StoredSession>;

export const serializeSessions = (sessions: WeekSession[]): StoredSessions =>
      Object.fromEntries(sessions.map((s) => [s.id, {
            week: s.week,
            day: s.day,
            schedule: s.schedule,
            therapistId: s.therapist.id,
            patients: Object.fromEntries(s.patient.map((p) => [p.id, s.areaPerPatient[p.id]])),
            atHome: s.atHome,
      }]));

/** Reconstruye las sesiones; ignora las que mencionan personas que ya no existen. */
export function deserializeSessions(
      stored: StoredSessions,
      patients: Map<string, Patient>,
      therapists: Map<string, Therapist>,
): WeekSession[] {
      return Object.entries(stored).flatMap(([id, s]) => {
            const therapist = therapists.get(s.therapistId);
            const sessionPatients = Object.keys(s.patients).map((pid) => patients.get(pid));
            if (!therapist || sessionPatients.length === 0 || sessionPatients.some((p) => !p)) return [];
            return [{
                  id, week: s.week, day: s.day, schedule: s.schedule, therapist,
                  patient: sessionPatients as Patient[],
                  areaPerPatient: { ...s.patients },
                  crossed: sessionPatients.length > 1,
                  atHome: s.atHome,
            }];
      });
}

/** Sesiones de todas las semanas del resultado del planificador, con ids únicos por semana. */
export const monthToSessions = (month: MonthlyResult): WeekSession[] =>
      month.weeks.flatMap((result, i) =>
            result.sessions.map((s) => ({ ...s, id: `w${i + 1}-${s.id}`, week: i + 1 })));
