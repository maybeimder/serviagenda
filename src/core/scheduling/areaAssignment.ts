import { DAYS } from "../config/scheduling";
import { Area } from "../types/base";
import { AreaBySlot, Placement } from "../types/scheduling";
import { sum } from "../utils/math";

export const slotKey = (p: Pick<Placement, "day" | "slot">) => `${p.day}|${p.slot}`;

/**
 * Reparte las áreas requeridas sobre las sesiones ya ubicadas de un paciente:
 * proporcional por día (horizontal) y en bloques contiguos del mismo área dentro del día.
 */
export function assignAreas(
      requirements: Partial<Record<Area, number>>,
      placements: Placement[]
): AreaBySlot {
      // acom es la última en cubrirse: solo recibe las sesiones que sobran tras las demás áreas
      const others = sum(Object.entries(requirements).filter(([a]) => a !== "acom").map(([, n]) => n));
      const capped = { ...requirements, acom: Math.min(requirements.acom ?? 0, Math.max(0, placements.length - others)) };
      const remaining = new Map<Area, number>(
            (Object.entries(capped) as [Area, number][]).filter(([, n]) => n > 0)
      );
      const sorted = [...placements].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.slot - b.slot);
      const result: AreaBySlot = new Map();

      for (const day of DAYS) {
            const ofDay = sorted.filter(p => p.day === day);
            const remainingTotal = sum(remaining.values());
            if (!ofDay.length) continue;
            if (!remainingTotal) break;

            const allotment = allotByDay(remaining, ofDay.length, remainingTotal);

            let i = 0;
            const byRemainingDesc = [...allotment].sort((a, b) => remaining.get(b[0])! - remaining.get(a[0])!);
            for (const [area, count] of byRemainingDesc)
                  for (let k = 0; k < count && i < ofDay.length; k++, i++) {
                        result.set(slotKey(ofDay[i]), area);
                        remaining.set(area, remaining.get(area)! - 1);
                  }
      }
      return result;
}

/** Cuántas sesiones del día va a cada área (método del mayor resto). */
function allotByDay(remaining: Map<Area, number>, daySessions: number, remainingTotal: number): Map<Area, number> {
      const allotment = new Map<Area, number>();
      const fractions: [Area, number][] = [];
      let given = 0;

      for (const [area, left] of remaining) {
            const exact = (left * daySessions) / remainingTotal;
            const whole = Math.floor(exact);
            allotment.set(area, whole);
            fractions.push([area, exact - whole]);
            given += whole;
      }
      fractions.sort((x, y) => y[1] - x[1] || remaining.get(y[0])! - remaining.get(x[0])!);
      for (let i = 0; given < daySessions && i < fractions.length; i++, given++)
            allotment.set(fractions[i][0], allotment.get(fractions[i][0])! + 1);

      return allotment;
}
