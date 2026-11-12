/**
 * Mapa de coordinación tal como se guarda en coordination.json / opt_coordination.json:
 *   patientId -> therapistId   (o una lista de therapistIds si el paciente tiene varios)
 */
export type CoordinationMap = Record<string, string | string[]>;

/** Ids de terapeutas de una entrada del mapa. */
export const therapistIdsOf = (value: string | string[] | undefined): string[] =>
      value === undefined ? [] : Array.isArray(value) ? value : [value];

/**
 * De lo que calcula el Coordinator (Map de Sets) a lo que se guarda en JSON. Todos los pacientes quedan en el
 * mapa: uno sin terapeuta posible se guarda con la lista vacía.
 */
export function toCoordinationMap(map: Map<string, Set<string>>): CoordinationMap {
      return Object.fromEntries([...map].map(([patientId, ids]) => {
            const list = [...ids];
            return [patientId, list.length === 1 ? list[0] : list];
      }));
}

/** De lo guardado en JSON a lo que consume el planificador (Map de Sets). */
export const fromCoordinationMap = (map: CoordinationMap): Map<string, Set<string>> =>
      new Map(Object.entries(map).map(([patientId, value]) => [patientId, new Set(therapistIdsOf(value))]));
