import type { Patient, Therapist } from "../../core/types/dtos";
import { query, type Queryable } from "../connection/db";

// Lectura (solo SELECT) de las tablas del ERP en la misma base: persons.*, operations.*.
// Las personas 449 y 12 se excluyen (tienen más de una ciudad / no son parte de la agenda).

// Horarios: el ERP no los guarda, así que se generan una sola vez (al cargar) con RANDOM() y desde entonces
// viven en agenda.* y se editan desde la app.
const PATIENT_SQL = `
WITH mapped_requirements AS (
    SELECT a.patient_id,
           jsonb_object_agg(
               CASE a.area_code
                   WHEN 'C_MOTORA' THEN 'fisio'
                   WHEN 'C_VERBAL' THEN 'fono'
                   WHEN 'C_ADAPTATIVA' THEN 'psico'
                   WHEN 'P_SENSORIAL' THEN 'inte'
                   WHEN 'R_COGNITIVA' THEN 'neuro'
                   WHEN 'C_PERCEP_MOTRIZ' THEN 'teo'
                   WHEN 'ACOM_ESCOLAR' THEN 'acom'
                   ELSE LOWER(a.area_code)
               END,
               a.total_sessions
           ) AS requirements
    FROM (
        SELECT patient_id, area_code, SUM(hours_intensity) / 2 AS total_sessions
        FROM operations.authorizations
        GROUP BY patient_id, area_code
    ) a
    GROUP BY a.patient_id
)
SELECT concat('p', t.person_id) AS id,
       p.full_name AS name,
       tc.main_city_code AS city,
       jsonb_strip_nulls(jsonb_build_object(
           'site', CASE WHEN RANDOM() < 0.5 THEN
                   jsonb_build_object(
                       'mon', jsonb_build_object('start', '07:00', 'end', '18:00'),
                       'wed', jsonb_build_object('start', '07:00', 'end', '18:00'),
                       'fri', jsonb_build_object('start', '07:00', 'end', '18:00'))
               ELSE
                   jsonb_build_object(
                       'mon', jsonb_build_object('start', '07:00', 'end', '18:00'),
                       'tue', jsonb_build_object('start', '07:00', 'end', '18:00'),
                       'wed', jsonb_build_object('start', '07:00', 'end', '18:00'),
                       'thu', jsonb_build_object('start', '07:00', 'end', '18:00'),
                       'fri', jsonb_build_object('start', '07:00', 'end', '18:00'))
               END,
           'home', CASE WHEN RANDOM() < 0.2 THEN
                   CASE WHEN RANDOM() < 0.5 THEN
                       jsonb_build_object(
                           'tue', jsonb_build_object('start', '08:00', 'end', '12:00'),
                           'thu', jsonb_build_object('start', '08:00', 'end', '12:00'))
                   ELSE
                       jsonb_build_object(
                           'mon', jsonb_build_object('start', '14:00', 'end', '17:00'),
                           'wed', jsonb_build_object('start', '14:00', 'end', '17:00'),
                           'fri', jsonb_build_object('start', '14:00', 'end', '17:00'))
                   END
               ELSE NULL END
       )) AS disponibility,
       COALESCE(mr.requirements, '{}'::jsonb) AS "sessionsRequirements"
FROM persons.patients AS t
JOIN persons_full_name_serviaba_formatted AS p ON t.person_id = p.person_id
JOIN persons.persons AS tc ON tc.person_id = t.person_id
LEFT JOIN mapped_requirements AS mr ON mr.patient_id = t.person_id
WHERE p.person_id NOT IN (449, 12)
ORDER BY tc.main_city_code, p.full_name`;

const THERAPIST_SQL = `
SELECT concat('t', t.person_id) AS id,
       p.full_name AS name,
       tc.city_code AS city,
       CASE WHEN RANDOM() < 0.5 THEN
           jsonb_build_object(
               'mon', jsonb_build_object('start', '08:00', 'end', '17:00'),
               'wed', jsonb_build_object('start', '08:00', 'end', '17:00'),
               'fri', jsonb_build_object('start', '08:00', 'end', '15:00'))
       ELSE
           jsonb_build_object(
               'mon', jsonb_build_object('start', '08:00', 'end', '17:00'),
               'tue', jsonb_build_object('start', '08:00', 'end', '17:00'),
               'wed', jsonb_build_object('start', '08:00', 'end', '17:00'),
               'thu', jsonb_build_object('start', '08:00', 'end', '17:00'),
               'fri', jsonb_build_object('start', '08:00', 'end', '15:00'))
       END AS disponibility
FROM persons.therapists AS t
JOIN persons_full_name_serviaba_formatted AS p ON t.person_id = p.person_id
JOIN persons.therapist_cities AS tc ON tc.therapist_id = t.person_id
WHERE p.person_id NOT IN (449, 12)
ORDER BY tc.city_code, p.full_name`;

export const ErpModel = {
      async patients(db?: Queryable): Promise<Patient[]> {
            return query<Patient>(PATIENT_SQL, [], db);
      },

      async therapists(db?: Queryable): Promise<Therapist[]> {
            return query<Therapist>(THERAPIST_SQL, [], db);
      },
};
