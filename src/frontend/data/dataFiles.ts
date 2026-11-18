import { useCallback, useEffect, useState } from "react";

/**
 * Datos de la app. Por defecto vienen del backend Express (`pnpm api:dev`, Supabase, esquema `agenda`).
 * Con `VITE_DATA_SOURCE=files` se usan los JSON de src/data a través del plugin del servidor de desarrollo (sin base).
 *
 * Caché: pacientes, terapeutas, sesiones y coordinación casi nunca cambian por fuera de la app, así que cada archivo se
 * baja UNA vez por carga de página y se reutiliza al cambiar de vista. Solo se actualiza cuando la app guarda algo
 * (confirmar la edición de una persona, "Guardar cambios", asignar coordinación…): la caché queda con lo guardado.
 * Recargar la página la descarta. Los valores de la caché no se deben mutar (se devuelven sin copiar).
 */
export type DataFile = "sessions" | "coordination" | "opt_coordination" | "opt_sessions" | "patients" | "therapists";

export const DATA_SOURCE: "api" | "files" = import.meta.env.VITE_DATA_SOURCE === "files" ? "files" : "api";

/** Cada archivo lógico y su endpoint en el backend (las variantes `optimal` son los opt_*.json). */
const API_URL: Record<DataFile, string> = {
      patients: "/api/users/patients",
      therapists: "/api/users/therapists",
      coordination: "/api/agenda/coordination?variant=current",
      opt_coordination: "/api/agenda/coordination?variant=optimal",
      sessions: "/api/agenda/sessions?variant=current",
      opt_sessions: "/api/agenda/sessions?variant=optimal",
};

const urlOf = (name: DataFile) => (DATA_SOURCE === "api" ? API_URL[name] : `/api/data/${name}`);

// ---------- caché ----------
const cache = new Map<DataFile, unknown>();
const inflight = new Map<DataFile, Promise<unknown>>(); // lecturas en curso: dos vistas que piden lo mismo comparten la petición

/** Descarta lo cacheado (todo, o un archivo) para que la próxima lectura vaya a la fuente. */
export function clearDataCache(name?: DataFile) {
      if (name) cache.delete(name); else cache.clear();
}

/** Mensaje legible de una respuesta fallida: el backend responde `{ error: { code, message } }`. */
async function failure(res: Response, what: string): Promise<Error> {
      let detail = "";
      try {
            const body = await res.json();
            detail = body?.error?.message ?? (typeof body?.error === "string" ? body.error : "");
      } catch { /* sin cuerpo JSON */ }
      return new Error(`${what} (${res.status}${detail ? `: ${detail}` : ""})`);
}

async function fetchDataFile<T>(name: DataFile): Promise<T> {
      const res = await fetch(urlOf(name));
      if (!res.ok) throw await failure(res, `No se pudo leer ${name}`);
      return res.json();
}

export async function readDataFile<T>(name: DataFile): Promise<T> {
      if (cache.has(name)) return cache.get(name) as T;
      let pending = inflight.get(name) as Promise<T> | undefined;
      if (!pending) {
            pending = fetchDataFile<T>(name)
                  .then((value) => { cache.set(name, value); return value; })
                  .finally(() => inflight.delete(name));
            inflight.set(name, pending);
      }
      return pending;
}

async function putJson(url: string, value: unknown, what: string): Promise<void> {
      const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      if (!res.ok) throw await failure(res, what);
}

/**
 * Reemplaza un archivo completo. Con el backend, patients y therapists no se escriben enteros (se editan de a una
 * persona con `saveUser`), para no pisar a todos por cambiar a uno.
 */
export async function writeDataFile(name: DataFile, value: unknown): Promise<void> {
      if (DATA_SOURCE === "api" && (name === "patients" || name === "therapists"))
            throw new Error(`${name} se guarda de a una persona (saveUser), no completo`);
      await putJson(urlOf(name), value, `No se pudo guardar ${name}`);
      cache.set(name, value);
}

/**
 * La agenda confirmada: coordinación y sesiones de una variante, guardadas JUNTAS. Con el backend es una sola
 * transacción (o se guarda todo o no cambia nada) y exige que cada paciente de una sesión tenga a su terapeuta en la
 * coordinación. Con archivos se escriben los dos JSON, uno tras otro.
 */
export async function writeAgendaState(variant: "current" | "optimal", state: { coordination: unknown, sessions: unknown }): Promise<void> {
      const [coordinationFile, sessionsFile]: DataFile[] = variant === "current" ? ["coordination", "sessions"] : ["opt_coordination", "opt_sessions"];
      if (DATA_SOURCE === "api") await putJson(`/api/agenda/state?variant=${variant}`, state, "No se pudo guardar la agenda");
      else {
            await putJson(urlOf(coordinationFile), state.coordination, `No se pudo guardar ${coordinationFile}`);
            await putJson(urlOf(sessionsFile), state.sessions, `No se pudo guardar ${sessionsFile}`);
      }
      cache.set(coordinationFile, state.coordination);
      cache.set(sessionsFile, state.sessions);
}

export type UserKind = "patient" | "therapist";
/** Campos editables de una persona (los mismos que acepta PUT /api/users/{patients|therapists}/:id). */
export type UserPatch = {
      name?: string
      city?: string
      disponibility?: unknown
      sessionsRequirements?: unknown
};

/**
 * Edita una persona y devuelve su registro actualizado. Con el backend es `PUT /api/users/.../:id` (solo cambia lo
 * enviado); con archivos se lee el mapa completo, se mezcla y se vuelve a escribir. La caché queda con el registro guardado.
 */
export async function saveUser<R>(kind: UserKind, id: string, patch: UserPatch): Promise<R> {
      const file: DataFile = kind === "patient" ? "patients" : "therapists";
      let saved: R;
      if (DATA_SOURCE === "api") {
            const res = await fetch(`${API_URL[file]}/${encodeURIComponent(id)}`, {
                  method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
            });
            if (!res.ok) throw await failure(res, `No se pudo guardar a ${id}`);
            saved = await res.json();
      } else {
            const all = await readDataFile<Record<string, unknown>>(file);
            if (!all[id]) throw new Error(`No existe ${id}`);
            saved = { ...(all[id] as object), ...patch } as R;
            await putJson(urlOf(file), { ...all, [id]: saved }, `No se pudo guardar ${file}`);
      }
      const cached = cache.get(file) as Record<string, unknown> | undefined;
      if (cached) cache.set(file, { ...cached, [id]: saved });
      return saved;
}

/**
 * Carga un archivo al montar (de la caché si ya se bajó: `loaded` es true desde el primer render). `save` lo escribe y
 * actualiza el valor local. Si la lectura falla (p. ej. el backend no está corriendo) queda `error` y el valor inicial.
 */
export function useDataFile<T>(name: DataFile, initial: T) {
      const [data, setData] = useState<T>(() => cache.has(name) ? cache.get(name) as T : initial);
      const [loaded, setLoaded] = useState(() => cache.has(name));
      const [error, setError] = useState<string | null>(null);

      useEffect(() => {
            if (cache.has(name)) { setData(cache.get(name) as T); setLoaded(true); return; }
            let alive = true;
            readDataFile<T>(name)
                  .then((value) => alive && setData(value))
                  .catch((e) => alive && setError(String(e)))
                  .finally(() => alive && setLoaded(true));
            return () => { alive = false; };
      }, [name]);

      const save = useCallback(async (next: T) => {
            await writeDataFile(name, next);
            setData(next);
      }, [name]);

      /** Solo actualiza el valor local (cuando ya se guardó por otra vía, p. ej. `saveUser`). */
      const setLocal = useCallback((next: T) => setData(next), []);

      return { data, loaded, error, save, setLocal };
}
