/**
 * Inspección de SOLO LECTURA de la base: esquemas, tablas de `agenda` y cuántas filas tienen.
 *   pnpm db:inspect
 * Corre dentro de una transacción READ ONLY: aunque algo intentara escribir, Postgres lo rechazaría.
 */
import { SCHEMA } from "../config";
import { withReadOnly } from "../connection/db";
import { runCli } from "./cli";
import { SchemaModel } from "../models/schema.model";
import { EXPECTED_TABLES } from "../services/health.service";

await runCli(() =>
      withReadOnly(async (tx) => {
            console.log("Esquemas en la base:", (await SchemaModel.userSchemas(tx)).join(", "));

            if (!(await SchemaModel.schemaExists(SCHEMA, tx))) {
                  console.log(`\nEl esquema \`${SCHEMA}\` NO existe todavía. Para crearlo: pnpm db:migrate (revisa) y pnpm db:migrate -- --apply`);
                  return;
            }

            const tables = await SchemaModel.tables(SCHEMA, tx);
            console.log(`\nTablas en \`${SCHEMA}\`: ${tables.length}`);
            for (const { table, columns } of tables) {
                  const rows = await SchemaModel.count(table, tx);
                  console.log(`  - ${table} (${rows} filas): ${columns.map((c) => `${c.name} ${c.type}${c.nullable ? "" : " NOT NULL"}`).join(", ")}`);
            }

            const missing = EXPECTED_TABLES.filter((t) => !tables.some((x) => x.table === t));
            console.log(missing.length ? `\nFaltan tablas esperadas: ${missing.join(", ")}` : "\nEstán todas las tablas esperadas.");
      }));
