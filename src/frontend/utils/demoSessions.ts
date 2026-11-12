import { Patients, Therapists } from "@data/data";
import { Coordination } from "@data/coordination";
import type { Area, Day } from "@core/types/base";
import type { Patient, Session } from "@core/types/dtos";

// TEMPORAL: sesiones de ejemplo para ver el calendario hasta que el scheduler del engine entregue las reales.
// Se arman con el terapeuta que más pacientes tiene coordinados y tres de ellos, así los datos son coherentes
// con el mapa de coordinación en las dos vistas (terapeuta y paciente).
const idsOf = (v: string | string[]) => Array.isArray(v) ? v : [v];
const patientsByTherapist = new Map<string, Patient[]>();
for (const p of Patients)
      for (const tid of idsOf(Coordination[p.id] ?? []))
            patientsByTherapist.set(tid, [...(patientsByTherapist.get(tid) ?? []), p]);

const [therapistId, coordinated] = [...patientsByTherapist].sort((x, y) => y[1].length - x[1].length)[0];
const therapist = Therapists.find((t) => t.id === therapistId)!;
const [a, b, c] = coordinated;

/** n-ésima área autorizada del paciente (las sesiones de ejemplo usan áreas que sí tiene) */
const area = (p: Patient, n = 0) => Object.keys(p.sessionsRequirements)[n % Object.keys(p.sessionsRequirements).length] as Area;

const solo = (id: string, day: Day, start: string, end: string, patient: Patient, a: Area, atHome = false): Session => ({
      id, day, schedule: { start, end }, therapist, patient: [patient],
      areaPerPatient: { [patient.id]: a }, crossed: false, atHome,
});

const crossed = (id: string, day: Day, start: string, end: string, group: [Patient, Area][]): Session => ({
      id, day, schedule: { start, end }, therapist, patient: group.map(([p]) => p),
      areaPerPatient: Object.fromEntries(group.map(([p, ar]) => [p.id, ar])), crossed: true, atHome: false,
});

export const demoSessions: Session[] = [
      solo("d1", "mon", "08:00", "09:00", a, area(a, 0)),
      solo("d2", "mon", "09:00", "10:00", b, area(b, 0)),
      crossed("d3", "mon", "10:00", "10:30", [[a, area(a, 1)], [b, area(b, 1)]]),
      solo("d4", "tue", "08:00", "09:30", a, area(a, 0)),
      solo("d5", "tue", "11:00", "12:00", c, area(c, 0), true),
      solo("d6", "wed", "08:30", "09:30", b, area(b, 2)),
      crossed("d7", "wed", "10:00", "11:00", [[a, area(a, 2)], [c, area(c, 1)], [b, area(b, 3)]]),
      solo("d8", "thu", "09:00", "10:00", c, area(c, 2)),
      solo("d9", "thu", "14:00", "15:00", a, area(a, 0), true),
      solo("d10", "fri", "08:00", "09:00", b, area(b, 0)),
      solo("d11", "fri", "15:30", "16:30", c, area(c, 3)),
      solo("d12", "sat", "09:00", "10:30", a, area(a, 0)),
];
