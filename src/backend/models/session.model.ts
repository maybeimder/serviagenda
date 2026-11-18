import { query, withTransaction, type Queryable } from "../connection/db";
import type { SessionFilters, SessionRow, Variant } from "../types";

type SessionDbRow = {
      id: string
      week: number
      day: SessionRow["day"]
      start: string
      end: string
      therapist_id: string
      at_home: boolean
      patients: SessionRow["patients"]
};

const CHUNK = 1000;

/** Todo el acceso a agenda.sessions y agenda.session_patients (ambas variantes). */
export const SessionModel = {
      /** Sesiones de una variante, con sus pacientes; los filtros son opcionales. */
      async findAll(variant: Variant, filters: SessionFilters = {}, db?: Queryable): Promise<SessionRow[]> {
            const params: unknown[] = [variant];
            const where = ["s.variant = $1"];
            if (filters.week !== undefined) { params.push(filters.week); where.push(`s.week = $${params.length}`); }
            if (filters.therapistId) { params.push(filters.therapistId); where.push(`s.therapist_id = $${params.length}`); }
            if (filters.patientId) {
                  params.push(filters.patientId);
                  where.push(`exists (select 1 from agenda.session_patients x
                                      where x.variant = s.variant and x.session_id = s.id and x.patient_id = $${params.length})`);
            }

            const rows = await query<SessionDbRow>(
                  `select s.id, s.week, s.day,
                          to_char(s.start_time, 'HH24:MI') as start,
                          to_char(s.end_time,   'HH24:MI') as "end",
                          s.therapist_id, s.at_home,
                          coalesce(jsonb_object_agg(sp.patient_id, sp.area) filter (where sp.patient_id is not null), '{}'::jsonb) as patients
                   from agenda.sessions s
                   left join agenda.session_patients sp on sp.variant = s.variant and sp.session_id = s.id
                   where ${where.join(" and ")}
                   group by s.variant, s.id
                   order by s.week, s.day, s.start_time, s.id`,
                  params, db,
            );
            return rows.map((r) => ({
                  id: r.id, week: r.week, day: r.day, start: r.start, end: r.end,
                  therapistId: r.therapist_id, atHome: r.at_home, patients: r.patients,
            }));
      },

      async count(variant: Variant, db?: Queryable): Promise<number> {
            const rows = await query<{ n: number }>("select count(*)::int as n from agenda.sessions where variant = $1", [variant], db);
            return rows[0].n;
      },

      /**
       * Reemplaza TODAS las sesiones de una variante (borra e inserta en una sola transacción: si algo falla,
       * queda lo que había). Los pacientes de una sesión caen en cascada al borrarla.
       */
      async replaceAll(variant: Variant, sessions: SessionRow[], outer?: Queryable): Promise<number> {
            const run = async (tx: Queryable) => {
                  await query("delete from agenda.sessions where variant = $1", [variant], tx);

                  for (let i = 0; i < sessions.length; i += CHUNK) {
                        const chunk = sessions.slice(i, i + CHUNK);
                        await query(
                              `insert into agenda.sessions (variant, id, week, day, start_time, end_time, therapist_id, at_home)
                               select $1::text, * from unnest($2::text[], $3::smallint[], $4::text[], $5::time[], $6::time[], $7::text[], $8::boolean[])`,
                              [
                                    variant, chunk.map((s) => s.id), chunk.map((s) => s.week), chunk.map((s) => s.day),
                                    chunk.map((s) => s.start), chunk.map((s) => s.end), chunk.map((s) => s.therapistId), chunk.map((s) => s.atHome),
                              ],
                              tx,
                        );

                        // una fila por (sesión, paciente)
                        const links = chunk.flatMap((s) => Object.entries(s.patients).map(([patientId, area]) => ({ sessionId: s.id, patientId, area })));
                        if (links.length === 0) continue;
                        await query(
                              `insert into agenda.session_patients (variant, session_id, patient_id, area)
                               select $1::text, * from unnest($2::text[], $3::text[], $4::text[])`,
                              [variant, links.map((l) => l.sessionId), links.map((l) => l.patientId), links.map((l) => l.area)],
                              tx,
                        );
                  }
                  return sessions.length;
            };
            // Con `outer` se une a la transacción de quien llama (guardar coordinación y sesiones juntas)
            return outer ? run(outer) : withTransaction(run);
      },
};
