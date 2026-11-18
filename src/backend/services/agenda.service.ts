import { CONFIG } from "../../core/config/businessrules";
import { MAX_PATIENTS_AT_HOME } from "../../core/sessions/edit";
import { AgendaModel } from "../models/agenda.model";
import { CoordinationModel } from "../models/coordination.model";
import { PatientModel } from "../models/patient.model";
import { SessionModel } from "../models/session.model";
import { TherapistModel } from "../models/therapist.model";
import type { CoordinationMap, CoordinationRow, SessionFilters, SessionRow, StoredSessions, Variant } from "../types";
import { badRequest, notFound } from "../utils/errors";

const idsOf = (value: string | string[]) => Array.isArray(value) ? value : [value];

/** Mapa del JSON <-> filas de la tabla. Un paciente sin terapeutas simplemente no tiene filas. */
const rowsFromMap = (map: CoordinationMap): CoordinationRow[] =>
      Object.entries(map).flatMap(([patientId, value]) => [...new Set(idsOf(value))].map((therapistId) => ({ patientId, therapistId })));

function mapFromRows(rows: CoordinationRow[]): CoordinationMap {
      const grouped = new Map<string, string[]>();
      for (const { patientId, therapistId } of rows) grouped.set(patientId, [...(grouped.get(patientId) ?? []), therapistId]);
      return Object.fromEntries([...grouped].map(([patientId, ids]) => [patientId, ids.length === 1 ? ids[0] : ids]));
}

/** Lanza 400 si alguno de los ids no existe, nombrando cuáles (mejor que el error genérico de llave foránea). */
async function assertKnown(patientIds: Iterable<string>, therapistIds: Iterable<string>) {
      const [patients, therapists] = await Promise.all([PatientModel.findAll(), TherapistModel.findAll()]);
      const knownPatients = new Set(patients.map((p) => p.id)), knownTherapists = new Set(therapists.map((t) => t.id));
      const missing = [
            ...[...new Set(patientIds)].filter((id) => !knownPatients.has(id)).map((id) => `paciente ${id}`),
            ...[...new Set(therapistIds)].filter((id) => !knownTherapists.has(id)).map((id) => `terapeuta ${id}`),
      ];
      if (missing.length > 0)
            throw badRequest(`No existen: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? ` (+${missing.length - 8} más)` : ""}`, "UNKNOWN_REFERENCE");
      return { patients, therapists };
}

/** Cada terapeuta debe ser de la ciudad de su paciente. */
function assertSameCity(rows: CoordinationRow[], patients: { id: string, city: string }[], therapists: { id: string, city: string }[]) {
      const patientCity = new Map(patients.map((p) => [p.id, p.city])), therapistCity = new Map(therapists.map((t) => [t.id, t.city]));
      for (const { patientId, therapistId } of rows)
            if (patientCity.get(patientId) !== therapistCity.get(therapistId))
                  throw badRequest(`El terapeuta ${therapistId} no es de la ciudad del paciente ${patientId}`, "CITY_MISMATCH");
}

/** Una sesión en casa solo puede tener un paciente. */
function assertHomeSessions(entries: [string, StoredSessions[string]][]) {
      for (const [id, s] of entries)
            if (s.atHome && Object.keys(s.patients).length > MAX_PATIENTS_AT_HOME)
                  throw badRequest(`La sesión ${id} es en casa y tiene más de ${MAX_PATIENTS_AT_HOME} paciente`, "HOME_SESSION_PATIENTS");
}

const sessionRowsFrom = (entries: [string, StoredSessions[string]][]): SessionRow[] => entries.map(([id, s]) => ({
      id, week: s.week, day: s.day, start: s.schedule.start, end: s.schedule.end,
      therapistId: s.therapistId, atHome: s.atHome, patients: s.patients,
}));

/** La agenda: con quién se coordina cada paciente y las sesiones del mes. */
export const AgendaService = {
      // ---------- coordinación ----------
      async getCoordination(variant: Variant): Promise<CoordinationMap> {
            return mapFromRows(await CoordinationModel.findAll(variant));
      },

      /** Reemplaza todo el mapa de una variante. Cada paciente debe tener como máximo `maxTherapists` y terapeutas de su ciudad. */
      async replaceCoordination(variant: Variant, map: CoordinationMap): Promise<{ patients: number, links: number }> {
            const rows = rowsFromMap(map);
            const { patients, therapists } = await assertKnown(rows.map((r) => r.patientId), rows.map((r) => r.therapistId));
            assertSameCity(rows, patients, therapists);

            const perPatient = new Map<string, number>();
            for (const { patientId } of rows) perPatient.set(patientId, (perPatient.get(patientId) ?? 0) + 1);
            for (const [patientId, n] of perPatient)
                  if (n > CONFIG.PatientRelated.maxTherapists)
                        throw badRequest(`El paciente ${patientId} tiene ${n} terapeutas; el máximo es ${CONFIG.PatientRelated.maxTherapists}`, "TOO_MANY_THERAPISTS");

            const links = await CoordinationModel.replaceAll(variant, rows);
            return { patients: perPatient.size, links };
      },

      /** Reemplaza los terapeutas de UN paciente, sin tocar a los demás. Lista vacía = quitarle todos. */
      async setPatientCoordination(variant: Variant, patientId: string, therapistIds: string[]): Promise<CoordinationMap> {
            const patient = await PatientModel.findById(patientId);
            if (!patient) throw notFound(`No existe el paciente ${patientId}`);

            const unique = [...new Set(therapistIds)];
            const { therapists } = await assertKnown([], unique);
            if (unique.length > CONFIG.PatientRelated.maxTherapists)
                  throw badRequest(`Un paciente puede tener como máximo ${CONFIG.PatientRelated.maxTherapists} terapeutas`, "TOO_MANY_THERAPISTS");
            const wrongCity = therapists.find((t) => unique.includes(t.id) && t.city !== patient.city);
            if (wrongCity) throw badRequest(`El terapeuta ${wrongCity.id} no es de la ciudad del paciente (${patient.city})`, "CITY_MISMATCH");

            await CoordinationModel.replaceForPatient(variant, patientId, unique);
            return mapFromRows((await CoordinationModel.findAll(variant)).filter((r) => r.patientId === patientId));
      },

      // ---------- sesiones ----------
      async getSessions(variant: Variant, filters: SessionFilters): Promise<StoredSessions> {
            const rows = await SessionModel.findAll(variant, filters);
            return Object.fromEntries(rows.map((s) => [s.id, {
                  week: s.week, day: s.day, schedule: { start: s.start, end: s.end },
                  therapistId: s.therapistId, patients: s.patients, atHome: s.atHome,
            }]));
      },

      /** Reemplaza todas las sesiones de una variante. Una sesión en casa solo puede tener un paciente. */
      async replaceSessions(variant: Variant, stored: StoredSessions): Promise<{ sessions: number }> {
            const entries = Object.entries(stored);
            assertHomeSessions(entries);
            await assertKnown(entries.flatMap(([, s]) => Object.keys(s.patients)), entries.map(([, s]) => s.therapistId));
            return { sessions: await SessionModel.replaceAll(variant, sessionRowsFrom(entries)) };
      },

      // ---------- estado completo (coordinación + sesiones) ----------
      /**
       * Guarda la coordinación y las sesiones de una variante JUNTAS, en una sola transacción. Además de las
       * validaciones de cada una, exige que cada paciente de una sesión tenga a su terapeuta en la coordinación:
       * así el estado es consistente y no pasa que un paciente tenga sesiones con un terapeuta que "no le corresponde".
       * (El máximo de terapeutas por paciente no se exige aquí: lo respeta el optimizador, y una edición manual no debe
       * impedir guardar toda la agenda.)
       */
      async replaceState(variant: Variant, state: { coordination: CoordinationMap, sessions: StoredSessions }): Promise<{ patients: number, links: number, sessions: number }> {
            const coordination = rowsFromMap(state.coordination);
            const entries = Object.entries(state.sessions);
            assertHomeSessions(entries);

            const { patients, therapists } = await assertKnown(
                  [...coordination.map((r) => r.patientId), ...entries.flatMap(([, s]) => Object.keys(s.patients))],
                  [...coordination.map((r) => r.therapistId), ...entries.map(([, s]) => s.therapistId)],
            );
            assertSameCity(coordination, patients, therapists);

            const linked = new Set(coordination.map((r) => `${r.patientId}|${r.therapistId}`));
            const missing = new Set<string>();
            for (const [, s] of entries) for (const patientId of Object.keys(s.patients))
                  if (!linked.has(`${patientId}|${s.therapistId}`)) missing.add(`${patientId} con ${s.therapistId}`);
            if (missing.size > 0)
                  throw badRequest(`Hay sesiones sin coordinación: ${[...missing].slice(0, 6).join(", ")}${missing.size > 6 ? ` (+${missing.size - 6} más)` : ""}`, "SESSION_WITHOUT_COORDINATION");

            const saved = await AgendaModel.replaceState(variant, coordination, sessionRowsFrom(entries));
            return { patients: new Set(coordination.map((r) => r.patientId)).size, ...saved };
      },
};
