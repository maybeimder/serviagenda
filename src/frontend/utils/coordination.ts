import { Therapists } from "@data/data";
import { therapistIdsOf, CoordinationMap } from "@core/coordination/map";
import type { Therapist } from "@core/types/dtos";

const therapistById = new Map(Therapists.map((t) => [t.id, t]));

/**
 * Coordinación consistente con las sesiones: si un paciente tiene una sesión con un terapeuta, ese terapeuta está en su
 * coordinación. Agrega los pares que falten (no quita nada); devuelve el mismo mapa si no faltaba ninguno.
 */
export function withSessionPairs(map: CoordinationMap, sessions: { therapist: { id: string }, patient: { id: string }[] }[]): CoordinationMap {
      let next: CoordinationMap | null = null;
      for (const s of sessions) for (const p of s.patient) {
            const current = therapistIdsOf((next ?? map)[p.id]);
            if (current.includes(s.therapist.id)) continue;
            next ??= { ...map };
            const ids = [...current, s.therapist.id];
            next[p.id] = ids.length === 1 ? ids[0] : ids;
      }
      return next ?? map;
}

/** Terapeutas con los que está coordinado el paciente, según un mapa de coordinación. */
export function coordinatedTherapists(map: CoordinationMap, patientId: string): Therapist[] {
      return therapistIdsOf(map[patientId]).flatMap((id) => therapistById.get(id) ?? []);
}
