import { CONFIG } from "../config/businessrules";
import {
      DAYS, MAX_DAILY_SLOTS, MAX_PARALLEL_PATIENTS, MAX_WEEKLY_SLOTS, MIN_BLOCK_SLOTS, MIN_WEEKLY_SLOTS, SLOT_MINS, TRAVEL_SLOTS, WEIGHTS,
} from "../config/scheduling";
import { Area, Day } from "../types/base";
import { Patient, Session, Therapist } from "../types/dtos";
import { AreaBySlot, Cell, Mode, Placement, ScheduleResult } from "../types/scheduling";
import { pushTo, sum } from "../utils/math";
import { rangeToSlots, slotToTime, timeToSlot } from "../utils/time";
import { assignAreas, slotKey } from "./areaAssignment";
import { validate } from "./validation";

/**
 * Planificador semanal (semana tipo) de sesiones de 30 min.
 *
 * Algoritmo: constructivo voraz con puntuación (greedy + scoring), en 3 fases por paciente:
 *   1. Cuotas por día (water-filling) -> reparto HORIZONTAL: se nivela cuántas sesiones
 *      recibe el paciente cada día antes de llenar un día completo.
 *   2. Un bloque de 1h (2 slots contiguos) por cada terapeuta del paciente (constraint 3).
 *   3. El resto de sesiones, una a una, eligiendo el slot con menor costo. El costo premia:
 *        - adyacencia con otra sesión del paciente (y más aún con el mismo terapeuta/modo)
 *        - adyacencia con otra sesión del terapeuta (agenda compacta)
 *        - sesión cruzada (comparte slot con otro paciente en sede)
 *        - terapeuta con menos carga (balance)
 *   Las áreas se asignan al final sobre las sesiones ya colocadas, en bloques contiguos por día.
 *
 * Dos pasadas: primero la base (fase 2) para todos, del más restringido al menos restringido;
 * luego el relleno (fase 3) por prioridad, de más a menos sesiones requeridas.
 */

const MODES: Mode[] = ["site", "home"];

type DaySlots = Map<Day, Set<number>>;

export class Scheduler {
      private patients: Map<string, Patient>;
      private therapists: Map<string, Therapist>;
      private assignments: Map<string, Set<string>>;

      /** slots en que cada paciente puede ser atendido, por modo y día */
      private patientsAvailable = new Map<string, Record<Mode, DaySlots>>();
      /** slots en que cada terapeuta trabaja, por día */
      private therapistsAvailable = new Map<string, DaySlots>();

      private patientsGrid = new Map<string, Map<Day, Map<number, { therapistId: string; mode: Mode }>>>();
      private therapistsGrid = new Map<string, Map<Day, Map<number, Cell>>>();
      /** slots ocupados por terapeuta en la semana (las cruzadas cuentan 1) */
      private therapistsLoad = new Map<string, number>();
      private placements: Placement[] = [];

      /** slots por "paciente|terapeuta": semanas anteriores + colocados en esta semana */
      private served: Map<string, number>;
      /** sesiones de la semana anterior (paciente|terapeuta|día|slot), se prefiere repetirlas */
      private lastWeek = new Set<string>();

      /**
       * `served`: slots ya dados en semanas anteriores por "paciente|terapeuta"; el bloque base
       * se da primero a quien menos ha atendido al paciente, para cubrir a todos en el mes.
       */
      constructor(patients: Patient[], therapists: Therapist[], assignments: Map<string, Set<string>>,
            previous: Session[] = [], served = new Map<string, number>()) {
            this.served = new Map(served);
            this.patients = new Map(patients.map(p => [p.id, p]));
            this.therapists = new Map(therapists.map(t => [t.id, t]));
            this.assignments = assignments;

            for (const s of previous) {
                  const slot = timeToSlot(s.schedule.start, SLOT_MINS);
                  for (const p of s.patient) this.lastWeek.add(`${p.id}|${s.therapist.id}|${s.day}|${slot}`);
            }

            const emptyWeek = <T>() => new Map<Day, Map<number, T>>(DAYS.map(d => [d, new Map()]));

            for (const p of patients) {
                  const slotsOf = (schedule: Patient["disponibility"]["site"] | undefined): DaySlots =>
                        new Map(DAYS.map(d => [d, rangeToSlots(schedule?.[d], SLOT_MINS)]));
                  this.patientsAvailable.set(p.id, { site: slotsOf(p.disponibility.site), home: slotsOf(p.disponibility.home) });
                  this.patientsGrid.set(p.id, emptyWeek());
            }
            for (const t of therapists) {
                  this.therapistsAvailable.set(t.id, new Map(DAYS.map(d => [d, rangeToSlots(t.disponibility[d], SLOT_MINS)])));
                  this.therapistsGrid.set(t.id, emptyWeek());
                  this.therapistsLoad.set(t.id, 0);
            }
      }

      // ---------- API ----------
      run(): ScheduleResult {
            // 1. base para todos (del más restringido al menos restringido)
            const byTightness = [...this.patients.keys()].sort((a, b) => this.tightness(b) - this.tightness(a));
            const quotas = new Map(byTightness.map(id => [id, this.dayQuotas(id, this.required(id))]));
            const placed = new Map(byTightness.map(id => [id, this.placeBaseline(id, quotas.get(id)!)]));

            // 2. la capacidad restante se concentra en quienes más sesiones requieren;
            //    primero todo lo que no es acom, y al final acom con lo que sobre
            const byDemand = [...byTightness].sort((a, b) => this.required(b) - this.required(a));
            for (const patientId of byDemand)
                  placed.set(patientId, this.fillRemaining(patientId, quotas.get(patientId)!, placed.get(patientId)!, this.required(patientId, true)));
            for (const patientId of byDemand)
                  this.fillRemaining(patientId, quotas.get(patientId)!, placed.get(patientId)!, this.required(patientId));

            const areas = new Map<string, AreaBySlot>();
            for (const p of this.patients.values())
                  areas.set(p.id, assignAreas(p.sessionsRequirements, this.placements.filter(c => c.patientId === p.id)));

            const sessions = this.buildSessions(areas);
            return {
                  sessions,
                  unmet: this.findUnmet(areas),
                  therapistHours: Object.fromEntries([...this.therapistsLoad].map(([t, n]) => [t, n * CONFIG.SessionDuration])),
                  violations: validate(sessions, this.patients, this.therapists, this.assignments),
                  dataIssues: [], // los chequeos de datos se hacen sobre el mes (scheduleMonth)
            };
      }

      // ---------- accesos al estado ----------
      private patientDay(patientId: string, day: Day) { return this.patientsGrid.get(patientId)!.get(day)!; }
      private therapistDay(therapistId: string, day: Day) { return this.therapistsGrid.get(therapistId)!.get(day)!; }
      private load(therapistId: string) { return this.therapistsLoad.get(therapistId)!; }
      /** slots del par paciente-terapeuta: semanas anteriores + semana en curso */
      private pairSlots(patientId: string, therapistId: string) { return this.served.get(`${patientId}|${therapistId}`) ?? 0; }
      /** Sesiones requeridas; con `withoutAcom` se excluye el acompañamiento escolar (se rellena al final). */
      private required(patientId: string, withoutAcom = false) {
            const { acom, ...rest } = this.patients.get(patientId)!.sessionsRequirements;
            return sum(Object.values(withoutAcom ? rest : { ...rest, acom: acom ?? 0 }));
      }

      private place(c: Placement) {
            const slots = this.therapistDay(c.therapistId, c.day);
            const cell = slots.get(c.slot);
            if (cell) cell.patientIds.push(c.patientId);
            else {
                  slots.set(c.slot, { mode: c.mode, patientIds: [c.patientId] });
                  this.therapistsLoad.set(c.therapistId, this.load(c.therapistId) + 1);
            }
            this.patientDay(c.patientId, c.day).set(c.slot, { therapistId: c.therapistId, mode: c.mode });
            this.placements.push(c);
            this.served.set(`${c.patientId}|${c.therapistId}`, this.pairSlots(c.patientId, c.therapistId) + 1);
      }

      private unplace(c: Placement) {
            const slots = this.therapistDay(c.therapistId, c.day);
            const cell = slots.get(c.slot)!;
            cell.patientIds = cell.patientIds.filter(id => id !== c.patientId);
            if (!cell.patientIds.length) {
                  slots.delete(c.slot);
                  this.therapistsLoad.set(c.therapistId, this.load(c.therapistId) - 1);
            }
            this.patientDay(c.patientId, c.day).delete(c.slot);
            this.placements.splice(this.placements.lastIndexOf(c), 1);
            this.served.set(`${c.patientId}|${c.therapistId}`, this.pairSlots(c.patientId, c.therapistId) - 1);
      }

      // ---------- constraints duras ----------
      private canPlace({ patientId, therapistId, day, slot, mode }: Placement): boolean {
            if (!this.patientsAvailable.get(patientId)![mode].get(day)!.has(slot)) return false;
            if (!this.therapistsAvailable.get(therapistId)!.get(day)!.has(slot)) return false;

            const patientSlots = this.patientDay(patientId, day);
            if (patientSlots.has(slot) || patientSlots.size >= MAX_DAILY_SLOTS) return false;

            const cell = this.therapistDay(therapistId, day).get(slot);
            if (!cell) return this.load(therapistId) < MAX_WEEKLY_SLOTS && !this.needsTravel(therapistId, day, slot, mode, patientId); // constraint 1 + traslado
            // constraint 4: solo se cruza en sede, nunca con home
            return cell.mode === "site" && mode === "site" && cell.patientIds.length < MAX_PARALLEL_PATIENTS;
      }

      /**
       * Traslado: una sesión en un lugar distinto al de otra del terapeuta a menos de TRAVEL_SLOTS
       * de distancia no deja el hueco necesario. Lugar = sede, o la casa de un paciente concreto.
       */
      private needsTravel(therapistId: string, day: Day, slot: number, mode: Mode, patientId: string): boolean {
            const slots = this.therapistDay(therapistId, day);
            const place = (m: Mode, pid: string) => (m === "home" ? `home:${pid}` : "site");
            const here = place(mode, patientId);
            for (let d = 1; d <= TRAVEL_SLOTS; d++)
                  for (const other of [slots.get(slot - d), slots.get(slot + d)])
                        if (other && place(other.mode, other.patientIds[0]) !== here) return true;
            return false;
      }

      // ---------- costo (soft) ----------
      private cost({ patientId, therapistId, day, slot, mode }: Placement): number {
            const patientSlots = this.patientDay(patientId, day);
            const therapistSlots = this.therapistDay(therapistId, day);
            let score = 0;

            if (patientSlots.size > 0) {
                  const neighbours = [patientSlots.get(slot - 1), patientSlots.get(slot + 1)];
                  if (neighbours.some(Boolean)) {
                        score += WEIGHTS.patientAdjacent;
                        if (neighbours.some(n => n?.therapistId === therapistId && n.mode === mode))
                              score += WEIGHTS.patientSameTherapistAdjacent;
                  } else {
                        const nearest = Math.min(...[...patientSlots.keys()].map(k => Math.abs(k - slot)));
                        score += WEIGHTS.patientGapPerSlot * (nearest - 1);
                  }
            }

            if (therapistSlots.has(slot - 1) || therapistSlots.has(slot + 1)) score += WEIGHTS.therapistAdjacent;
            else if (therapistSlots.size > 0) score += WEIGHTS.therapistGap;
            else score += WEIGHTS.therapistNewDay;

            if (therapistSlots.has(slot)) score += WEIGHTS.crossed;
            else if (this.load(therapistId) < MIN_WEEKLY_SLOTS) score += WEIGHTS.belowMin;
            if (mode === "home") score += WEIGHTS.home;
            if (this.pairSlots(patientId, therapistId) < MIN_BLOCK_SLOTS) score += WEIGHTS.underServed;
            if (this.lastWeek.has(`${patientId}|${therapistId}|${day}|${slot}`)) score += WEIGHTS.repeatLastWeek;

            score += WEIGHTS.load * (this.load(therapistId) / MAX_WEEKLY_SLOTS);
            score += WEIGHTS.dayLoad * patientSlots.size;
            score += WEIGHTS.lateTieBreak * slot;
            return score;
      }

      // ---------- cuotas horizontales ----------
      /** Slots por día en que el paciente puede ser atendido por al menos uno de sus terapeutas. */
      private dayCapacity(patientId: string): Map<Day, number> {
            const therapistIds = [...(this.assignments.get(patientId) ?? [])];
            const capacity = new Map<Day, number>();
            for (const day of DAYS) {
                  const usable = new Set<number>();
                  for (const mode of MODES)
                        for (const slot of this.patientsAvailable.get(patientId)![mode].get(day)!)
                              if (therapistIds.some(t => this.therapistsAvailable.get(t)?.get(day)?.has(slot))) usable.add(slot);
                  capacity.set(day, Math.min(usable.size, MAX_DAILY_SLOTS));
            }
            return capacity;
      }

      /** Nivela `total` sesiones entre los días con capacidad (water-filling). */
      private dayQuotas(patientId: string, total: number): Map<Day, number> {
            const capacity = this.dayCapacity(patientId);
            const quotas = new Map<Day, number>(DAYS.map(d => [d, 0]));
            for (let i = 0; i < total; i++) {
                  const open = DAYS.filter(d => quotas.get(d)! < capacity.get(d)!);
                  if (!open.length) break;
                  open.sort((a, b) => quotas.get(a)! - quotas.get(b)! || capacity.get(b)! - capacity.get(a)!);
                  quotas.set(open[0], quotas.get(open[0])! + 1);
            }
            return quotas;
      }

      /** Sesiones requeridas / capacidad: mayor = más restringido. */
      private tightness(patientId: string): number {
            return this.required(patientId) / (sum(this.dayCapacity(patientId).values()) || 1);
      }

      // ---------- planificación por paciente ----------
      /** Fase base: 1h con cada terapeuta del paciente, para que nadie quede sin atención. Devuelve slots colocados. */
      private placeBaseline(patientId: string, quotas: Map<Day, number>): number {
            const therapistIds = [...(this.assignments.get(patientId) ?? [])]
                  .sort((a, b) => (this.served.get(`${patientId}|${a}`) ?? 0) - (this.served.get(`${patientId}|${b}`) ?? 0));
            const total = this.required(patientId);

            let placed = 0;
            for (const therapistId of therapistIds) {
                  if (total - placed < MIN_BLOCK_SLOTS) break;
                  placed += this.placeHourBlock(patientId, therapistId, quotas);
            }
            return placed;
      }

      /** Fase de relleno: sesiones del paciente hasta `target`, una a una, mientras haya capacidad. Devuelve el total colocado. */
      private fillRemaining(patientId: string, quotas: Map<Day, number>, placed: number, target: number): number {
            const therapistIds = [...(this.assignments.get(patientId) ?? [])];
            while (placed < target && this.placeBestSingle(patientId, therapistIds, quotas)) placed++;
            return placed;
      }

      /** Fase 2: mejor bloque de 1h contiguo entre el paciente y un terapeuta. Devuelve slots colocados. */
      private placeHourBlock(patientId: string, therapistId: string, quotas: Map<Day, number>): number {
            for (const strict of [true, false]) {
                  let best: { block: Placement[]; score: number } | null = null;

                  for (const day of DAYS) {
                        if (strict && this.patientDay(patientId, day).size + MIN_BLOCK_SLOTS > quotas.get(day)!) continue;
                        for (const mode of MODES)
                              for (const start of this.patientsAvailable.get(patientId)![mode].get(day)!) {
                                    const candidate = this.tryBlock({ patientId, therapistId, day, slot: start, mode });
                                    if (candidate && (!best || candidate.score < best.score)) best = candidate;
                              }
                  }
                  if (best) {
                        best.block.forEach(c => this.place(c));
                        return best.block.length;
                  }
            }
            return 0;
      }

      /** Evalúa un bloque de MIN_BLOCK_SLOTS slots desde `first`, sin dejar rastro en el estado. */
      private tryBlock(first: Placement): { block: Placement[]; score: number } | null {
            const block: Placement[] = [];
            let score = 0;
            let feasible = true;

            for (let k = 0; k < MIN_BLOCK_SLOTS; k++) {
                  const c = { ...first, slot: first.slot + k };
                  if (!this.canPlace(c)) { feasible = false; break; }
                  score += this.cost(c);
                  this.place(c);
                  block.push(c);
            }
            [...block].reverse().forEach(c => this.unplace(c));
            return feasible ? { block, score } : null;
      }

      /** Fase 3: coloca la mejor sesión individual posible. Devuelve false si no hay ninguna. */
      private placeBestSingle(patientId: string, therapistIds: string[], quotas: Map<Day, number>): boolean {
            for (const strict of [true, false]) {
                  let best: Placement | null = null;
                  let bestScore = Infinity;

                  for (const day of DAYS) {
                        if (strict && this.patientDay(patientId, day).size >= quotas.get(day)!) continue;
                        for (const mode of MODES)
                              for (const slot of this.patientsAvailable.get(patientId)![mode].get(day)!)
                                    for (const therapistId of therapistIds) {
                                          const c = { patientId, therapistId, day, slot, mode };
                                          if (!this.canPlace(c)) continue;
                                          const score = this.cost(c);
                                          if (score < bestScore) { bestScore = score; best = c; }
                                    }
                  }
                  if (best) {
                        this.place(best);
                        return true;
                  }
            }
            return false;
      }

      // ---------- resultado ----------
      /** Agrupa por (terapeuta, día, slot): una Session por slot, varios pacientes = cruzada. */
      private buildSessions(areas: Map<string, AreaBySlot>): Session[] {
            const groups = new Map<string, Placement[]>();
            for (const c of this.placements) pushTo(groups, `${c.therapistId}|${c.day}|${c.slot}`, c);

            return [...groups.values()]
                  .sort((a, b) =>
                        DAYS.indexOf(a[0].day) - DAYS.indexOf(b[0].day) ||
                        a[0].slot - b[0].slot ||
                        a[0].therapistId.localeCompare(b[0].therapistId))
                  .map((group, i) => {
                        const { therapistId, day, slot, mode } = group[0];
                        return {
                              id: `s${String(i + 1).padStart(4, "0")}`,
                              day,
                              schedule: { start: slotToTime(slot, SLOT_MINS), end: slotToTime(slot + 1, SLOT_MINS) },
                              therapist: this.therapists.get(therapistId)!,
                              patient: group.map(c => this.patients.get(c.patientId)!),
                              areaPerPatient: Object.fromEntries(group.map(c => [c.patientId, areas.get(c.patientId)!.get(slotKey(c))!])),
                              crossed: group.length > 1,
                              atHome: mode === "home",
                        };
                  });
      }

      private findUnmet(areas: Map<string, AreaBySlot>): ScheduleResult["unmet"] {
            const unmet: ScheduleResult["unmet"] = [];
            for (const p of this.patients.values()) {
                  const got = new Map<Area, number>();
                  for (const area of areas.get(p.id)!.values()) got.set(area, (got.get(area) ?? 0) + 1);
                  for (const [area, required] of Object.entries(p.sessionsRequirements) as [Area, number][]) {
                        const missing = required - (got.get(area) ?? 0);
                        if (missing > 0) unmet.push({ patientId: p.id, area, missing });
                  }
            }
            return unmet;
      }
}
