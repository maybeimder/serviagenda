import { CONFIG } from "../config/businessrules";
import { MAX_WEEKLY_SLOTS, MIN_BLOCK_SLOTS } from "../config/scheduling";
import { Patient, Therapist } from "../types/dtos";
import { sum } from "../utils/math";
import { coverageOf, patientWeekSlots, SlotKey } from "./availability";

/** Cuántas veces la demanda semanal del paciente deben cubrir los horarios de sus terapeutas. */
const COVERAGE_FACTOR = 2;

/** Peso mínimo de "cuántos horarios totales cubre" para desempatar entre candidatos. */
const TOTAL_COVERAGE_TIEBREAK = 0.01;

type Candidate = { id: string, coverage: Set<SlotKey> };

export type SelectionOptions = {
      /** Mínimo de terapeutas a elegir (la elección del usuario); se agregan más si la cobertura no alcanza. */
      minCount: number
      /** Demanda semanal ya asignada por terapeuta, para repartir la carga entre ellos. */
      load?: ReadonlyMap<string, number>
}

const monthlyDemandOf = (patient: Patient) => sum(Object.values(patient.sessionsRequirements));

/** Demanda semanal (en slots) del paciente: la mensual repartida entre las semanas del mes. */
export const weeklyDemandOf = (patient: Patient) => Math.ceil(monthlyDemandOf(patient) / CONFIG.WeeksPerMonth);

/**
 * Cada terapeuta necesita 1h con el paciente en el mes: no más terapeutas de los que su demanda permite.
 */
function maxTherapistsFor(patient: Patient): number {
      const byDemand = Math.floor(monthlyDemandOf(patient) / MIN_BLOCK_SLOTS);
      return Math.max(1, Math.min(CONFIG.PatientRelated.maxTherapists, byDemand));
}

/**
 * Elige terapeutas por cobertura: en cada paso toma el que agrega más horarios nuevos del paciente
 * (sede u hogar), penalizado por la demanda que ya tiene asignada.
 *
 * Toma al menos `minCount` y sigue agregando, hasta el máximo del paciente, mientras los horarios
 * cubiertos no alcancen COVERAGE_FACTOR veces su demanda semanal.
 * Devuelve los ids elegidos; vacío si ningún candidato comparte horario con el paciente.
 */
export function pickByAvailability(patient: Patient, candidates: Therapist[], { minCount, load = new Map() }: SelectionOptions): string[] {
      const patientSlots = patientWeekSlots(patient);
      const pool: Candidate[] = candidates.flatMap(therapist => {
            const coverage = coverageOf(patientSlots, therapist);
            return coverage ? [{ id: therapist.id, coverage }] : [];
      });

      const maxTherapists = maxTherapistsFor(patient);
      const targetCoverage = COVERAGE_FACTOR * weeklyDemandOf(patient);
      const covered = new Set<SlotKey>();
      const picked: string[] = [];

      const newSlotsOf = (c: Candidate) => [...c.coverage].filter(slot => !covered.has(slot)).length;
      const score = (c: Candidate) =>
            (newSlotsOf(c) + TOTAL_COVERAGE_TIEBREAK * c.coverage.size) /
            (1 + (load.get(c.id) ?? 0) / MAX_WEEKLY_SLOTS);

      const needsMore = () => picked.length < minCount || covered.size < targetCoverage;

      while (pool.length && picked.length < maxTherapists && needsMore()) {
            pool.sort((a, b) => score(b) - score(a));
            const best = pool.shift()!;

            // Cumplido el mínimo, un terapeuta que no aporta horarios nuevos ya no suma
            if (picked.length >= minCount && newSlotsOf(best) === 0) break;

            best.coverage.forEach(slot => covered.add(slot));
            picked.push(best.id);
      }

      return picked;
}
