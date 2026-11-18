/**
 * Carga pacientes y terapeutas desde las tablas del ERP (persons.*, operations.*) a agenda.patients / agenda.therapists.
 *   pnpm db:sync-erp                  -> NO escribe nada: lee del ERP y muestra qué cargaría
 *   pnpm db:sync-erp -- --apply       -> carga (solo si las tablas destino están vacías)
 *   pnpm db:sync-erp -- --apply --force   -> carga aunque ya tengan filas (upsert por id: actualiza nombre, ciudad, horarios y autorizaciones)
 *
 *   pnpm db:sync-erp -- --requirements            -> NO escribe nada: muestra cuántos pacientes tienen otras autorizaciones en el ERP
 *   pnpm db:sync-erp -- --requirements --apply    -> actualiza SOLO las autorizaciones (sessions_requirements) de los pacientes
 *                                                    que cambiaron; nombres, ciudades y horarios (editados en la app) no se tocan
 *
 * Los horarios no existen en el ERP: se generan al cargar y desde entonces se editan en la app.
 */
import { withReadOnly, withTransaction } from "../connection/db";
import { runCli } from "./cli";
import { ErpModel } from "../models/erp.model";
import { PatientModel } from "../models/patient.model";
import { SchemaModel } from "../models/schema.model";
import { TherapistModel } from "../models/therapist.model";

const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");
const requirementsOnly = process.argv.includes("--requirements");

/** Autorizaciones comparables sin importar el orden de las llaves. */
const canonical = (r: Record<string, number>) => JSON.stringify(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)));

await runCli(async () => {
      // Lectura en transacción READ ONLY: del ERP solo se hace SELECT
      const { patients, therapists } = await withReadOnly(async (tx) => ({
            patients: await ErpModel.patients(tx),
            therapists: await ErpModel.therapists(tx),
      }));

      console.log(`Del ERP: ${patients.length} pacientes · ${therapists.length} terapeutas`);

      // ---------- solo autorizaciones ----------
      if (requirementsOnly) {
            const current = new Map((await PatientModel.findAll()).map((p) => [p.id, p]));
            const items = patients.filter((p) => current.has(p.id)).map((p) => ({ id: p.id, sessionsRequirements: p.sessionsRequirements }));
            const missing = patients.length - items.length;

            // Solo se corrigen los que tienen lo que dio la fórmula anterior (SUM * 2, o sea 4 veces lo correcto; el entero
            // se trunca: 99/2 = 49). Si alguien editó las autorizaciones a mano en la app, ya no coinciden y NO se pisan.
            const wasOldFormula = (now: Record<string, number>, erp: Record<string, number>) => {
                  const keys = new Set([...Object.keys(now), ...Object.keys(erp)]);
                  return [...keys].every((k) => Math.floor((now[k] ?? 0) / 4) === (erp[k] ?? 0)) && [...keys].some((k) => (now[k] ?? 0) !== (erp[k] ?? 0));
            };
            const alreadyOk = items.filter((i) => canonical(i.sessionsRequirements) === canonical(current.get(i.id)!.sessionsRequirements));
            const toFix = items.filter((i) => wasOldFormula(current.get(i.id)!.sessionsRequirements, i.sessionsRequirements));
            const edited = items.length - alreadyOk.length - toFix.length;

            console.log(`Pacientes a corregir (tienen el valor de la fórmula vieja): ${toFix.length}`);
            console.log(`Ya correctos: ${alreadyOk.length} · distintos por edición manual (no se tocan): ${edited}${missing ? ` · del ERP sin fila en agenda.patients: ${missing}` : ""}`);
            const sample = toFix[0];
            if (sample) console.log(`  ej. ${sample.id}: ahora ${JSON.stringify(current.get(sample.id)!.sessionsRequirements)} -> ${JSON.stringify(sample.sessionsRequirements)}`);
            const differing = toFix;

            if (!apply) return void console.log("\nModo solo lectura: no se escribió nada. Para actualizar: pnpm db:sync-erp -- --requirements --apply");
            const changed = await withTransaction((tx) => PatientModel.updateRequirements(differing, tx));
            console.log(`\nActualizadas las autorizaciones de ${changed.length} pacientes. Listo.`);
            return;
      }

      // ---------- carga completa ----------
      const sample = patients[0];
      if (sample) console.log(`  ej. ${sample.id} ${sample.name} (${sample.city}) · áreas: ${Object.keys(sample.sessionsRequirements).join(", ") || "—"}`);

      if (!apply) return void console.log("\nModo solo lectura: no se escribió nada. Para cargar: pnpm db:sync-erp -- --apply");

      const filled: string[] = [];
      for (const table of ["patients", "therapists"]) {
            const n = await SchemaModel.count(table);
            if (n > 0) filled.push(`${table} (${n} filas)`);
      }
      if (filled.length && !force) {
            console.error(`\nYa hay datos en: ${filled.join(", ")}. No se tocó nada. Para actualizar solo las autorizaciones: --requirements. Para reemplazar todo: --force`);
            process.exitCode = 1;
            return;
      }

      await withTransaction(async (tx) => {
            console.log(`therapists: ${await TherapistModel.upsertMany(therapists, tx)} cargados`);
            console.log(`patients: ${await PatientModel.upsertMany(patients, tx)} cargados`);
      });
      console.log("\nListo.");
});
