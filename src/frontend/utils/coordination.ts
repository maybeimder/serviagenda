import { Therapists } from "@data/data";
import { therapistIdsOf, CoordinationMap } from "@core/coordination/map";
import type { Therapist } from "@core/types/dtos";

const therapistById = new Map(Therapists.map((t) => [t.id, t]));

/** Terapeutas con los que está coordinado el paciente, según un mapa de coordinación. */
export function coordinatedTherapists(map: CoordinationMap, patientId: string): Therapist[] {
      return therapistIdsOf(map[patientId]).flatMap((id) => therapistById.get(id) ?? []);
}
