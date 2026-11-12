import { CONFIG } from "../config/businessrules";
import { Area } from "../types/base";
import { Patient, Therapist } from "../types/dtos";
import { MonthlyResult } from "../types/scheduling";
import { Scheduler } from "./scheduler";
import { findDataIssues, validateMonth } from "./validation";

type Requirements = Partial<Record<Area, number>>;

/**
 * Horario mensual: los requerimientos de los pacientes son del mes, así que se planifica
 * semana a semana. Cada semana recibe lo que falta dividido entre las semanas restantes
 * (lo que no cupo una semana se arrastra a las siguientes) y se prefiere repetir las
 * sesiones de la semana anterior.
 */
export function scheduleMonth(
      patients: Patient[],
      therapists: Therapist[],
      assignments: Map<string, Set<string>>,
      weeks = CONFIG.WeeksPerMonth
): MonthlyResult {
      const remaining = new Map<string, Requirements>(patients.map(p => [p.id, { ...p.sessionsRequirements }]));
      const results: MonthlyResult["weeks"] = [];
      const served = new Map<string, number>();

      for (let week = 0; week < weeks; week++) {
            const weeksLeft = weeks - week;
            const weekly = patients.map(p => ({
                  ...p,
                  sessionsRequirements: Object.fromEntries(
                        (Object.entries(remaining.get(p.id)!) as [Area, number][])
                              .map(([area, n]): [Area, number] => [area, Math.ceil(n / weeksLeft)])
                              .filter(([, n]) => n > 0)
                  ) as Requirements,
            }));

            const previous = results[week - 1]?.sessions ?? [];
            const result = new Scheduler(weekly, therapists, assignments, previous, served).run();
            results.push(result);

            for (const s of result.sessions)
                  for (const p of s.patient) {
                        const key = `${p.id}|${s.therapist.id}`;
                        served.set(key, (served.get(key) ?? 0) + 1);
                        const area = s.areaPerPatient[p.id];
                        const left = remaining.get(p.id)!;
                        if (left[area]) left[area]! -= 1;
                  }
      }

      const unmet: MonthlyResult["unmet"] = [];
      for (const [patientId, left] of remaining)
            for (const [area, missing] of Object.entries(left) as [Area, number][])
                  if (missing > 0) unmet.push({ patientId, area, missing });

      return {
            weeks: results,
            unmet,
            violations: validateMonth(results.map(r => r.sessions), assignments),
            dataIssues: findDataIssues(new Map(patients.map(p => [p.id, p])), new Map(therapists.map(t => [t.id, t])), assignments, weeks),
      };
}
