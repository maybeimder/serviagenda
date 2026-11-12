import { Area } from "../types/base";
import { Patient, Session, Therapist } from "../types/dtos";

/** Paciente de una sesión junto con el área en que se le atiende. */
export type PatientArea = { patient: Patient, area: Area };

/** Una sesión en casa atiende a un solo paciente. */
export const MAX_PATIENTS_AT_HOME = 1;

/**
 * Reemplaza los pacientes de la sesión (agregar, quitar o cambiar áreas). Es cruzada si quedan 2 o más.
 * Una sesión en casa solo admite un paciente.
 */
export function withPatients(session: Session, entries: PatientArea[]): Session {
      if (entries.length === 0) throw new Error("Una sesión necesita al menos un paciente");
      if (session.atHome && entries.length > MAX_PATIENTS_AT_HOME)
            throw new Error("Una sesión en casa solo puede tener un paciente");

      return {
            ...session,
            patient: entries.map((e) => e.patient),
            areaPerPatient: Object.fromEntries(entries.map((e) => [e.patient.id, e.area])),
            crossed: entries.length > 1,
      };
}

/** Nueva sesión del terapeuta con esos pacientes (cruzada si son 2 o más). */
export function newSession(id: string, base: Pick<Session, "day" | "schedule" | "therapist">, entries: PatientArea[]): Session {
      return withPatients({ id, ...base, patient: [], areaPerPatient: {}, crossed: false, atHome: false }, entries);
}

/** Cambia el terapeuta de la sesión. */
export const withTherapist = (session: Session, therapist: Therapist): Session => ({ ...session, therapist });

/**
 * Marca o desmarca la sesión como "en casa". Al marcarla con varios pacientes hay que indicar con cuál
 * se queda (`keepPatientId`): los demás salen de la sesión y deja de ser cruzada.
 */
export function withAtHome(session: Session, atHome: boolean, keepPatientId?: string): Session {
      if (!atHome) return { ...session, atHome: false };
      if (session.patient.length <= MAX_PATIENTS_AT_HOME) return { ...session, atHome: true };

      const keep = session.patient.find((p) => p.id === keepPatientId);
      if (!keep) throw new Error("Hay que elegir con qué paciente se queda la sesión en casa");
      return { ...withPatients(session, [{ patient: keep, area: session.areaPerPatient[keep.id] }]), atHome: true };
}
