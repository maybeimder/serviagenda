import { Coordination } from "@data/coordination";
import { Therapists } from "@data/data";
import type { Therapist } from "@core/types/dtos";

const therapistById = new Map(Therapists.map((t) => [t.id, t]));

/** Terapeutas con los que está coordinado el paciente, según el mapa de coordinación. */
export function coordinatedTherapists(patientId: string): Therapist[] {
      const value = Coordination[patientId];
      const ids = value === undefined ? [] : Array.isArray(value) ? value : [value];
      return ids.flatMap((id) => therapistById.get(id) ?? []);
}
