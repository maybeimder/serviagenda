import { CONFIG } from "../config/businessrules";
import { MAX_DAILY_SLOTS, MAX_PARALLEL_PATIENTS, MIN_BLOCK_SLOTS, MIN_WEEKLY_SLOTS, SLOT_MINS, TRAVEL_SLOTS } from "../config/scheduling";
import { Area } from "../types/base";
import { Patient, Session, Therapist } from "../types/dtos";
import { sum } from "../utils/math";
import { rangeToSlots, timeToSlot } from "../utils/time";

const { WeeklyHours } = CONFIG.TherapistRelated;
const count = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

export function validate(sessions: Session[], patients: Map<string, Patient>,
      therapists: Map<string, Therapist>,
      assignments: Map<string, Set<string>>
): string[] {
      const errors: string[] = [];
      const therapistBusy = new Set<string>();
      const patientBusy = new Set<string>();
      const therapistSlots = new Map<string, number>();
      const patientDaily = new Map<string, number>();
      const sessionsByArea = new Map<string, number>();

      for (const s of sessions) {
            const slot = timeToSlot(s.schedule.start, SLOT_MINS);
            const therapistId = s.therapist.id;
            const when = `${s.day} ${s.schedule.start}`;

            const busyKey = `${therapistId}|${s.day}|${slot}`;
            if (therapistBusy.has(busyKey)) errors.push(`Terapeuta ${therapistId} duplicado en ${when}`);
            therapistBusy.add(busyKey);
            count(therapistSlots, therapistId);

            if (!rangeToSlots(therapists.get(therapistId)!.disponibility[s.day], SLOT_MINS).has(slot))
                  errors.push(`Terapeuta ${therapistId} fuera de disponibilidad en ${when}`);

            if (s.atHome && s.patient.length > 1) errors.push(`Sesión home con ${s.patient.length} pacientes (${s.id})`);
            if (s.patient.length > MAX_PARALLEL_PATIENTS) errors.push(`Más de ${MAX_PARALLEL_PATIENTS} pacientes simultáneos (${s.id})`);
            if (s.crossed !== s.patient.length > 1) errors.push(`Flag crossed inconsistente (${s.id})`);

            for (const p of s.patient) {
                  const patientKey = `${p.id}|${s.day}|${slot}`;
                  if (patientBusy.has(patientKey)) errors.push(`Paciente ${p.id} en dos sesiones a la vez (${when})`);
                  patientBusy.add(patientKey);

                  const range = s.atHome ? p.disponibility.home?.[s.day] : p.disponibility.site[s.day];
                  if (!rangeToSlots(range, SLOT_MINS).has(slot))
                        errors.push(`Paciente ${p.id} fuera de disponibilidad ${s.atHome ? "home" : "sede"} en ${when}`);
                  if (!assignments.get(p.id)?.has(therapistId))
                        errors.push(`Terapeuta ${therapistId} no asignado a ${p.id}`);
                  if (p.city !== s.therapist.city)
                        errors.push(`Paciente ${p.id} (${p.city}) con terapeuta ${therapistId} (${s.therapist.city}) de otra ciudad`);

                  count(patientDaily, `${p.id}|${s.day}`);
                  count(sessionsByArea, `${p.id}|${s.areaPerPatient[p.id]}`);
            }
      }

      // traslado: entre sesiones de un terapeuta en lugares distintos debe haber TRAVEL_SLOTS vacíos
      const byTherapistDay = new Map<string, { slot: number; place: string }[]>();
      for (const s of sessions) {
            const key = `${s.therapist.id}|${s.day}`;
            const list = byTherapistDay.get(key) ?? [];
            list.push({ slot: timeToSlot(s.schedule.start, SLOT_MINS), place: s.atHome ? `home:${s.patient[0].id}` : "site" });
            byTherapistDay.set(key, list);
      }
      for (const [key, list] of byTherapistDay) {
            list.sort((a, b) => a.slot - b.slot);
            for (let i = 1; i < list.length; i++)
                  if (list[i].place !== list[i - 1].place && list[i].slot - list[i - 1].slot <= TRAVEL_SLOTS)
                        errors.push(`Terapeuta ${key}: sin tiempo de traslado entre slots ${list[i - 1].slot} y ${list[i].slot}`);
      }

      // 1. horas por terapeuta
      for (const therapistId of therapists.keys()) {
            const hours = (therapistSlots.get(therapistId) ?? 0) * CONFIG.SessionDuration;
            if (hours > WeeklyHours.max) errors.push(`Terapeuta ${therapistId}: ${hours}h > máx ${WeeklyHours.max}h`);
            if (hours < WeeklyHours.min) errors.push(`Terapeuta ${therapistId}: ${hours}h < mín ${WeeklyHours.min}h`);
      }

      for (const p of patients.values()) {
            // 2. horas por área
            for (const [area, required] of Object.entries(p.sessionsRequirements) as [Area, number][])
                  if ((sessionsByArea.get(`${p.id}|${area}`) ?? 0) > required)
                        errors.push(`Paciente ${p.id}: área ${area} excede lo requerido`);
            for (const [key, n] of sessionsByArea) {
                  const [patientId, area] = key.split("|");
                  if (patientId === p.id && !(area in p.sessionsRequirements))
                        errors.push(`Paciente ${p.id}: área no requerida ${area} (${n})`);
            }
            // 3. al menos 1h por terapeuta: se valida sobre el mes (ver validateMonth)
      }

      for (const [key, n] of patientDaily)
            if (n > MAX_DAILY_SLOTS) errors.push(`Paciente ${key}: ${n * CONFIG.SessionDuration}h en un día > máx`);

      return errors;
}

/** Constraint 3 sobre el mes: cada terapeuta asignado le da al menos 1h al paciente. */
export function validateMonth(sessionsByWeek: Session[][], assignments: Map<string, Set<string>>): string[] {
      const slots = new Map<string, number>();
      for (const sessions of sessionsByWeek)
            for (const s of sessions) for (const p of s.patient) count(slots, `${p.id}|${s.therapist.id}`);

      const errors: string[] = [];
      for (const [patientId, therapistIds] of assignments)
            for (const therapistId of therapistIds)
                  if ((slots.get(`${patientId}|${therapistId}`) ?? 0) < MIN_BLOCK_SLOTS)
                        errors.push(`Paciente ${patientId}: terapeuta ${therapistId} con < 1h en el mes`);
      return errors;
}

/** Chequeos previos: demanda imposible sin importar el algoritmo. */
export function findDataIssues(
      patients: Map<string, Patient>,
      therapists: Map<string, Therapist>,
      assignments: Map<string, Set<string>>,
      weeks = 1
): string[] {
      const issues: string[] = [];
      let demand = 0;

      for (const p of patients.values()) {
            const total = sum(Object.values(p.sessionsRequirements));
            const needed = (assignments.get(p.id)?.size ?? 0) * MIN_BLOCK_SLOTS;
            demand += total;
            if (![...therapists.values()].some(t => t.city === p.city))
                  issues.push(`Paciente ${p.id}: no hay terapeutas en ${p.city}`);
            if (total < needed)
                  issues.push(`Paciente ${p.id}: ${total} sesiones no alcanzan para ${assignments.get(p.id)!.size} terapeutas x 1h (${needed} necesarias)`);
      }

      const minTotal = therapists.size * MIN_WEEKLY_SLOTS * weeks;
      if (demand < minTotal)
            issues.push(`Demanda total ${demand * CONFIG.SessionDuration}h < mínimo conjunto de terapeutas ${minTotal * CONFIG.SessionDuration}h (${therapists.size} x ${WeeklyHours.min}h x ${weeks} sem), antes de contar cruzadas`);

      return issues;
}
