import { query, type Queryable } from "../connection/db";
import type { Patient } from "../../core/types/dtos";

type PatientDbRow = {
      id: string
      name: string
      city: Patient["city"]
      disponibility: Patient["disponibility"]
      sessions_requirements: Patient["sessionsRequirements"]
};

const toPatient = (r: PatientDbRow): Patient => ({
      id: r.id, name: r.name, city: r.city,
      disponibility: r.disponibility, sessionsRequirements: r.sessions_requirements,
});

const COLUMNS = "id, name, city, disponibility, sessions_requirements";

/** Todo el acceso a agenda.patients. */
export const PatientModel = {
      async findAll(db?: Queryable): Promise<Patient[]> {
            const rows = await query<PatientDbRow>(`select ${COLUMNS} from agenda.patients order by id`, [], db);
            return rows.map(toPatient);
      },

      async findById(id: string, db?: Queryable): Promise<Patient | null> {
            const rows = await query<PatientDbRow>(`select ${COLUMNS} from agenda.patients where id = $1`, [id], db);
            return rows[0] ? toPatient(rows[0]) : null;
      },

      /** Actualiza solo los campos que vienen; devuelve la persona actualizada, o null si no existe. */
      async update(id: string, patch: Partial<Omit<Patient, "id">>, db?: Queryable): Promise<Patient | null> {
            const rows = await query<PatientDbRow>(
                  `update agenda.patients set
                        name                  = coalesce($2, name),
                        city                  = coalesce($3, city),
                        disponibility         = coalesce($4::jsonb, disponibility),
                        sessions_requirements = coalesce($5::jsonb, sessions_requirements),
                        updated_at            = now()
                   where id = $1
                   returning ${COLUMNS}`,
                  [
                        id, patch.name ?? null, patch.city ?? null,
                        patch.disponibility ? JSON.stringify(patch.disponibility) : null,
                        patch.sessionsRequirements ? JSON.stringify(patch.sessionsRequirements) : null,
                  ],
                  db,
            );
            return rows[0] ? toPatient(rows[0]) : null;
      },

      /**
       * Cambia SOLO las autorizaciones (sessions_requirements) de varios pacientes, sin tocar nombre, ciudad ni horarios.
       * Los que ya tienen ese valor no se escriben. Devuelve los ids que cambiaron.
       */
      async updateRequirements(items: { id: string, sessionsRequirements: Patient["sessionsRequirements"] }[], db?: Queryable): Promise<string[]> {
            const changed: string[] = [];
            for (let i = 0; i < items.length; i += 500) {
                  const chunk = items.slice(i, i + 500);
                  const rows = await query<{ id: string }>(
                        `update agenda.patients p set sessions_requirements = v.r, updated_at = now()
                         from unnest($1::text[], $2::jsonb[]) as v(id, r)
                         where p.id = v.id and p.sessions_requirements is distinct from v.r
                         returning p.id`,
                        [chunk.map((x) => x.id), chunk.map((x) => JSON.stringify(x.sessionsRequirements))],
                        db,
                  );
                  changed.push(...rows.map((r) => r.id));
            }
            return changed;
      },

      /** Inserta o actualiza muchos pacientes de una vez (carga inicial desde patients.json). */
      async upsertMany(patients: Patient[], db?: Queryable): Promise<number> {
            let total = 0;
            for (let i = 0; i < patients.length; i += 500) {
                  const chunk = patients.slice(i, i + 500);
                  const rows = await query(
                        `insert into agenda.patients (id, name, city, disponibility, sessions_requirements)
                         select * from unnest($1::text[], $2::text[], $3::text[], $4::jsonb[], $5::jsonb[])
                         on conflict (id) do update set
                               name = excluded.name, city = excluded.city,
                               disponibility = excluded.disponibility,
                               sessions_requirements = excluded.sessions_requirements,
                               updated_at = now()
                         returning id`,
                        [
                              chunk.map((p) => p.id), chunk.map((p) => p.name), chunk.map((p) => p.city),
                              chunk.map((p) => JSON.stringify(p.disponibility)), chunk.map((p) => JSON.stringify(p.sessionsRequirements)),
                        ],
                        db,
                  );
                  total += rows.length;
            }
            return total;
      },
};
