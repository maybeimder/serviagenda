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

export const patientOptions: PersonOption[] = Patients.map((p) => ({ ...toOption(p), authorizations: p.sessionsRequirements }));
export const therapistOptions: PersonOption[] = Therapists.map(toOption);
