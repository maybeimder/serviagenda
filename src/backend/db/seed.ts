/**
 * Carga lo que hoy vive como JSON en src/data/ al esquema `agenda`.
 *   pnpm db:seed                  -> NO escribe nada: valida los JSON y muestra qué se cargaría
 *   pnpm db:seed -- --apply       -> carga (solo si las tablas destino están vacías)
 *   pnpm db:seed -- --apply --force   -> carga aunque ya tengan filas (las reemplaza)
 *   --only=patients,therapists,coordination,sessions   -> limita a esos grupos
 *
 * Orden: personas primero (las demás tablas las referencian), luego coordinación y sesiones.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Patient, Therapist } from "../../core/types/dtos";
import { withTransaction } from "../connection/db";
import { runCli } from "./cli";
import { CoordinationModel } from "../models/coordination.model";
import { PatientModel } from "../models/patient.model";
import { SchemaModel } from "../models/schema.model";
import { SessionModel } from "../models/session.model";
import { TherapistModel } from "../models/therapist.model";
import type { CoordinationMap, CoordinationRow, PatientsMap, SessionRow, StoredSessions, TherapistsMap, Variant } from "../types";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const force = args.includes("--force");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const wants = (group: string) => !only || only.includes(group);

const dataDir = path.join(import.meta.dirname, "..", "..", "data");
const read = <T>(file: string): T => {
      const text = readFileSync(path.join(dataDir, `${file}.json`), "utf8").trim();
      return (text ? JSON.parse(text) : {}) as T;
};

// ---------- 1) leer y validar los JSON (sin tocar la base) ----------
const patientsMap = read<PatientsMap>("patients");
const therapistsMap = read<TherapistsMap>("therapists");
const patients: Patient[] = Object.entries(patientsMap).map(([id, p]) => ({ id, ...p }));
const therapists: Therapist[] = Object.entries(therapistsMap).map(([id, t]) => ({ id, ...t }));

const coordinationRows = (map: CoordinationMap): CoordinationRow[] =>
      Object.entries(map).flatMap(([patientId, v]) => (Array.isArray(v) ? v : [v]).map((therapistId) => ({ patientId, therapistId })));

const sessionRows = (stored: StoredSessions): SessionRow[] =>
      Object.entries(stored).map(([id, s]) => ({ id, week: s.week, day: s.day, start: s.schedule.start, end: s.schedule.end, therapistId: s.therapistId, atHome: s.atHome, patients: s.patients }));

const variants: { variant: Variant, coordination: CoordinationRow[], sessions: SessionRow[] }[] = [
      { variant: "current", coordination: coordinationRows(read("coordination")), sessions: sessionRows(read("sessions")) },
      { variant: "optimal", coordination: coordinationRows(read("opt_coordination")), sessions: sessionRows(read("opt_sessions")) },
];

const patientIds = new Set(patients.map((p) => p.id)), therapistIds = new Set(therapists.map((t) => t.id));
const problems: string[] = [];
for (const v of variants) {
      for (const r of v.coordination) {
            if (!patientIds.has(r.patientId)) problems.push(`coordination(${v.variant}): paciente ${r.patientId} no existe`);
            if (!therapistIds.has(r.therapistId)) problems.push(`coordination(${v.variant}): terapeuta ${r.therapistId} no existe`);
      }
      for (const s of v.sessions) {
            if (!therapistIds.has(s.therapistId)) problems.push(`sessions(${v.variant}) ${s.id}: terapeuta ${s.therapistId} no existe`);
            for (const pid of Object.keys(s.patients)) if (!patientIds.has(pid)) problems.push(`sessions(${v.variant}) ${s.id}: paciente ${pid} no existe`);
      }
}

console.log("Se cargaría al esquema agenda:");
if (wants("therapists")) console.log(`  - therapists: ${therapists.length}`);
if (wants("patients")) console.log(`  - patients: ${patients.length}`);
for (const v of variants) {
      if (wants("coordination")) console.log(`  - coordination [${v.variant}]: ${v.coordination.length} vínculos`);
      if (wants("sessions")) console.log(`  - sessions [${v.variant}]: ${v.sessions.length} sesiones`);
}
if (problems.length) {
      console.error(`\nLos JSON tienen ${problems.length} referencias rotas; corrígelas antes de cargar:`);
      problems.slice(0, 10).forEach((p) => console.error(`  ! ${p}`));
      process.exit(1);
}
if (!apply) {
      console.log("\nModo solo lectura: no se escribió nada. Para cargar: pnpm db:seed -- --apply");
      process.exit(0);
}

// ---------- 2) cargar ----------
await runCli(async () => {
      // Seguro por defecto: si las tablas destino ya tienen datos, no se pisan sin --force
      const targets = [
            ...(wants("therapists") ? ["therapists"] : []), ...(wants("patients") ? ["patients"] : []),
            ...(wants("coordination") ? ["coordination"] : []), ...(wants("sessions") ? ["sessions"] : []),
      ];
      const filled: string[] = [];
      for (const table of targets) {
            const n = await SchemaModel.count(table);
            if (n > 0) filled.push(`${table} (${n} filas)`);
      }
      if (filled.length && !force) {
            console.error(`\nYa hay datos en: ${filled.join(", ")}. No se tocó nada. Si quieres reemplazarlos: --force`);
            process.exitCode = 1;
            return;
      }

      if (wants("therapists") || wants("patients")) {
            await withTransaction(async (tx) => {
                  if (wants("therapists")) console.log(`therapists: ${await TherapistModel.upsertMany(therapists, tx)} cargados`);
                  if (wants("patients")) console.log(`patients: ${await PatientModel.upsertMany(patients, tx)} cargados`);
            });
      }
      for (const v of variants) {
            if (wants("coordination")) console.log(`coordination [${v.variant}]: ${await CoordinationModel.replaceAll(v.variant, v.coordination)} vínculos`);
            if (wants("sessions")) console.log(`sessions [${v.variant}]: ${await SessionModel.replaceAll(v.variant, v.sessions)} sesiones`);
      }
      console.log("\nListo.");
});
