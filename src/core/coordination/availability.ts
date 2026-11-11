import { DAYS, MIN_BLOCK_SLOTS, SLOT_MINS } from "../config/scheduling";
import { Schedule } from "../types/base";
import { Patient, Therapist } from "../types/dtos";
import { rangeToSlots } from "../utils/time";

/** Slots por día de una semana; el índice coincide con el de DAYS. */
export type WeekSlots = Set<number>[];

/** Franja concreta de la semana, con el formato "índiceDelDía|slot". */
export type SlotKey = string;

const toWeekSlots = (schedule: Schedule): WeekSlots =>
      DAYS.map(day => rangeToSlots(schedule[day], SLOT_MINS));

/** Horarios en que se puede atender al paciente, ya sea en sede o en su hogar. */
export function patientWeekSlots(patient: Patient): WeekSlots {
      const site = toWeekSlots(patient.disponibility.site);
      const home = toWeekSlots(patient.disponibility.home ?? {});
      return site.map((slots, day) => new Set([...slots, ...home[day]]));
}

/** ¿Hay al menos `length` slots consecutivos dentro del conjunto? */
function hasContiguousBlock(slots: Set<number>, length = MIN_BLOCK_SLOTS): boolean {
      return [...slots].some(start =>
            Array.from({ length }, (_, k) => start + k).every(slot => slots.has(slot)));
}

/**
 * Franjas del paciente que el terapeuta puede cubrir.
 * Devuelve null si no comparten ni un bloque de 1h seguida (no sirve para este paciente).
 */
export function coverageOf(patientSlots: WeekSlots, therapist: Therapist): Set<SlotKey> | null {
      const therapistSlots = toWeekSlots(therapist.disponibility);
      const shared = therapistSlots.map((slots, day) => new Set([...slots].filter(slot => patientSlots[day].has(slot))));

      if (!shared.some(slots => hasContiguousBlock(slots))) return null;

      return new Set(shared.flatMap((slots, day) => [...slots].map(slot => `${day}|${slot}`)));
}
