import { Patients, Therapists } from "@data/data";
import type { Area, City } from "@core/types/base";
import { toTitleCase } from "./toTitleCase";

/** Persona lista para mostrar en un PersonSelect (nombre en formato Nombre Propio). */
export type PersonOption = {
      id: string
      fullName: string
      city: City
      /** Solo pacientes: sesiones autorizadas por área */
      authorizations?: Partial<Record<Area, number>>
};

const toOption = (p: { id: string, name: string, city: City }): PersonOption =>
      ({ id: p.id, fullName: toTitleCase(p.name), city: p.city });

/** Tras guardar a una persona: actualiza su opción (en el lugar) con el registro guardado. */
export function refreshOption(kind: "patient" | "therapist", id: string, saved: { name: string, city: City, sessionsRequirements?: Partial<Record<Area, number>> }) {
      const option = (kind === "patient" ? patientOptions : therapistOptions).find((o) => o.id === id);
      if (!option) return;
      option.fullName = toTitleCase(saved.name);
      option.city = saved.city;
      if (kind === "patient") option.authorizations = saved.sessionsRequirements;
}

export const patientOptions: PersonOption[] = Patients.map((p) => ({ ...toOption(p), authorizations: p.sessionsRequirements }));
export const therapistOptions: PersonOption[] = Therapists.map(toOption);
