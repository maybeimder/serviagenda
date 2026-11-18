import { query, withTransaction, type Queryable } from "../connection/db";
import type { CoordinationRow, Variant } from "../types";

type CoordinationDbRow = { patient_id: string, therapist_id: string };

const CHUNK = 2000;

/** Todo el acceso a agenda.coordination (ambas variantes: 'current' y 'optimal'). */
export const CoordinationModel = {
      async findAll(variant: Variant, db?: Queryable): Promise<CoordinationRow[]> {
            const rows = await query<CoordinationDbRow>(
                  "select patient_id, therapist_id from agenda.coordination where variant = $1 order by patient_id, therapist_id",
                  [variant], db,
            );
            return rows.map((r) => ({ patientId: r.patient_id, therapistId: r.therapist_id }));
      },

      /**
       * Reemplaza TODA la coordinación de una variante (borra e inserta en una sola transacción). Con `tx` se une a la
       * transacción de quien llama (p. ej. guardar coordinación y sesiones juntas).
       */
      async replaceAll(variant: Variant, rows: CoordinationRow[], tx?: Queryable): Promise<number> {
            const run = async (db: Queryable) => {
                  await query("delete from agenda.coordination where variant = $1", [variant], db);
                  return CoordinationModel.insertMany(variant, rows, db);
            };
            return tx ? run(tx) : withTransaction(run);
      },

      /** Reemplaza solo los terapeutas de un paciente (una entrada del mapa). */
      async replaceForPatient(variant: Variant, patientId: string, therapistIds: string[]): Promise<void> {
            await withTransaction(async (tx) => {
                  await query("delete from agenda.coordination where variant = $1 and patient_id = $2", [variant, patientId], tx);
                  await CoordinationModel.insertMany(variant, therapistIds.map((therapistId) => ({ patientId, therapistId })), tx);
            });
      },

      async insertMany(variant: Variant, rows: CoordinationRow[], db?: Queryable): Promise<number> {
            let total = 0;
            for (let i = 0; i < rows.length; i += CHUNK) {
                  const chunk = rows.slice(i, i + CHUNK);
                  if (chunk.length === 0) continue;
                  const inserted = await query(
                        `insert into agenda.coordination (variant, patient_id, therapist_id)
                         select $1::text, * from unnest($2::text[], $3::text[])
                         on conflict do nothing
                         returning patient_id`,
                        [variant, chunk.map((r) => r.patientId), chunk.map((r) => r.therapistId)], db,
                  );
                  total += inserted.length;
            }
            return total;
      },
};
