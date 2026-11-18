-- Esquema `agenda`: lo que hoy vive como JSON en src/data/.
--   therapists.json        -> agenda.therapists
--   patients.json          -> agenda.patients
--   coordination.json      -> agenda.coordination      (variant = 'current')
--   opt_coordination.json  -> agenda.coordination      (variant = 'optimal')
--   sessions.json          -> agenda.sessions + agenda.session_patients (variant = 'current')
--   opt_sessions.json      -> agenda.sessions + agenda.session_patients (variant = 'optimal')
--
-- Solo CREA lo que no existe (IF NOT EXISTS): no modifica ni borra nada que ya haya en la base.

CREATE SCHEMA IF NOT EXISTS agenda;

CREATE TABLE IF NOT EXISTS agenda.therapists (
      id            text        PRIMARY KEY,
      name          text        NOT NULL,
      city          text        NOT NULL CHECK (city IN ('CTG', 'STM', 'NVA')),
      -- { "mon": { "start": "07:00", "end": "18:00" }, ... }
      disponibility jsonb       NOT NULL DEFAULT '{}'::jsonb,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agenda.patients (
      id                    text        PRIMARY KEY,
      name                  text        NOT NULL,
      city                  text        NOT NULL CHECK (city IN ('CTG', 'STM', 'NVA')),
      -- { "site": { "mon": {...} }, "home": { ... } }
      disponibility         jsonb       NOT NULL DEFAULT '{}'::jsonb,
      -- { "fono": 40, "teo": 20, ... } sesiones del mes por área
      sessions_requirements jsonb       NOT NULL DEFAULT '{}'::jsonb,
      created_at            timestamptz NOT NULL DEFAULT now(),
      updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Con qué terapeutas está coordinado cada paciente. 'current' = estado real; 'optimal' = óptimo calculado por el core.
CREATE TABLE IF NOT EXISTS agenda.coordination (
      variant      text NOT NULL CHECK (variant IN ('current', 'optimal')),
      patient_id   text NOT NULL REFERENCES agenda.patients (id)   ON DELETE CASCADE,
      therapist_id text NOT NULL REFERENCES agenda.therapists (id) ON DELETE CASCADE,
      PRIMARY KEY (variant, patient_id, therapist_id)
);

CREATE INDEX IF NOT EXISTS coordination_therapist_idx ON agenda.coordination (variant, therapist_id);

-- Una sesión de un terapeuta en una semana del mes. Varios pacientes = sesión cruzada (ver session_patients).
CREATE TABLE IF NOT EXISTS agenda.sessions (
      variant      text     NOT NULL CHECK (variant IN ('current', 'optimal')),
      id           text     NOT NULL,
      week         smallint NOT NULL CHECK (week >= 1),
      day          text     NOT NULL CHECK (day IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
      start_time   time     NOT NULL,
      end_time     time     NOT NULL,
      therapist_id text     NOT NULL REFERENCES agenda.therapists (id) ON DELETE CASCADE,
      at_home      boolean  NOT NULL DEFAULT false,
      PRIMARY KEY (variant, id),
      CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS sessions_therapist_idx ON agenda.sessions (variant, therapist_id, week);

-- Pacientes de cada sesión y el área en que se atiende a cada uno.
CREATE TABLE IF NOT EXISTS agenda.session_patients (
      variant    text NOT NULL,
      session_id text NOT NULL,
      patient_id text NOT NULL REFERENCES agenda.patients (id) ON DELETE CASCADE,
      area       text NOT NULL CHECK (area IN ('fono', 'fisio', 'teo', 'psico', 'acom', 'inte', 'neuro')),
      PRIMARY KEY (variant, session_id, patient_id),
      FOREIGN KEY (variant, session_id) REFERENCES agenda.sessions (variant, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS session_patients_patient_idx ON agenda.session_patients (variant, patient_id);
