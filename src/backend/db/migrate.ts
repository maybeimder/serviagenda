/**
 * Migraciones del esquema `agenda` (db/migrations/*.sql, en orden alfabético).
 *   pnpm db:migrate              -> NO escribe nada: muestra qué migraciones faltan por aplicar
 *   pnpm db:migrate -- --apply   -> las aplica (cada una en su transacción)
 * Las migraciones solo CREAN lo que no existe (IF NOT EXISTS); nunca borran ni alteran datos.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { query, withTransaction } from "../connection/db";
import { runCli } from "./cli";
import { SchemaModel } from "../models/schema.model";

const apply = process.argv.includes("--apply");
const dir = path.join(import.meta.dirname, "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

await runCli(async () => {
      // ¿Qué migraciones ya se aplicaron? (la tabla de control puede no existir todavía)
      const hasControl = (await SchemaModel.tables("agenda")).some((t) => t.table === "schema_migrations");
      const done = new Set(hasControl ? (await query<{ name: string }>("select name from agenda.schema_migrations")).map((r) => r.name) : []);
      const pending = files.filter((f) => !done.has(f));

      console.log(`Migraciones: ${files.length} · aplicadas: ${done.size} · pendientes: ${pending.length}`);
      pending.forEach((f) => console.log(`  - ${f}`));

      if (pending.length === 0) console.log("Nada que hacer.");
      else if (!apply) console.log("\nModo solo lectura: no se cambió nada. Para aplicar: pnpm db:migrate -- --apply");
      else {
            for (const file of pending) {
                  await withTransaction(async (tx) => {
                        await tx.query(readFileSync(path.join(dir, file), "utf8"));
                        await tx.query("create table if not exists agenda.schema_migrations (name text primary key, applied_at timestamptz not null default now())");
                        await tx.query("insert into agenda.schema_migrations (name) values ($1)", [file]);
                  });
                  console.log(`Aplicada: ${file}`);
            }
      }
});
