import { query, type Queryable } from "../connection/db";
import type { Therapist } from "../../core/types/dtos";

type TherapistDbRow = {
      id: string
      name: string
      city: Therapist["city"]
      disponibility: Therapist["disponibility"]
};

const toTherapist = (r: TherapistDbRow): Therapist => ({ id: r.id, name: r.name, city: r.city, disponibility: r.disponibility });

const COLUMNS = "id, name, city, disponibility";

/** Todo el acceso a agenda.therapists. */
export const TherapistModel = {
      async findAll(db?: Queryable): Promise<Therapist[]> {
            const rows = await query<TherapistDbRow>(`select ${COLUMNS} from agenda.therapists order by id`, [], db);
            return rows.map(toTherapist);
      },

      async findById(id: string, db?: Queryable): Promise<Therapist | null> {
            const rows = await query<TherapistDbRow>(`select ${COLUMNS} from agenda.therapists where id = $1`, [id], db);
            return rows[0] ? toTherapist(rows[0]) : null;
      },

      /** Actualiza solo los campos que vienen; devuelve el terapeuta actualizado, o null si no existe. */
      async update(id: string, patch: Partial<Omit<Therapist, "id">>, db?: Queryable): Promise<Therapist | null> {
            const rows = await query<TherapistDbRow>(
                  `update agenda.therapists set
                        name          = coalesce($2, name),
                        city          = coalesce($3, city),
                        disponibility = coalesce($4::jsonb, disponibility),
                        updated_at    = now()
                   where id = $1
                   returning ${COLUMNS}`,
                  [id, patch.name ?? null, patch.city ?? null, patch.disponibility ? JSON.stringify(patch.disponibility) : null],
                  db,
            );
            return rows[0] ? toTherapist(rows[0]) : null;
      },

      /** Inserta o actualiza muchos terapeutas de una vez (carga inicial desde therapists.json). */
      async upsertMany(therapists: Therapist[], db?: Queryable): Promise<number> {
            let total = 0;
            for (let i = 0; i < therapists.length; i += 500) {
                  const chunk = therapists.slice(i, i + 500);
                  const rows = await query(
                        `insert into agenda.therapists (id, name, city, disponibility)
                         select * from unnest($1::text[], $2::text[], $3::text[], $4::jsonb[])
                         on conflict (id) do update set
                               name = excluded.name, city = excluded.city,
                               disponibility = excluded.disponibility, updated_at = now()
                         returning id`,
                        [chunk.map((t) => t.id), chunk.map((t) => t.name), chunk.map((t) => t.city), chunk.map((t) => JSON.stringify(t.disponibility))],
                        db,
                  );
                  total += rows.length;
            }
            return total;
      },
};
