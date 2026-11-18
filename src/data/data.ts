import { readDataFile } from "@/data/dataFiles";
import type { Patient, Therapist } from "../core/types/dtos";

/** Registro tal como se guarda (el id es la llave del mapa): el que devuelve el backend o patients.json. */
type Stored<T> = Omit<T, "id">;

// Directorio de personas. Se carga una vez al arrancar (`loadDirectory`, ver app/Boot.tsx) y los módulos que lo usan
// se importan después de eso, así que pueden leer `Patients` / `Therapists` de forma síncrona.
export let Patients: Patient[] = [];
export let Therapists: Therapist[] = [];

let loading: Promise<void> | null = null;

/** Tras guardar a una persona: actualiza su entrada en el directorio (en el lugar, así quien ya tiene la referencia la ve al día). */
export function updateDirectoryEntry(kind: "patient" | "therapist", id: string, record: Partial<Stored<Patient>> | Partial<Stored<Therapist>>) {
      const entry = (kind === "patient" ? Patients : Therapists).find((x) => x.id === id);
      if (entry) Object.assign(entry, record);
}

export function loadDirectory(): Promise<void> {
      loading ??= Promise.all([
            readDataFile<Record<string, Stored<Patient>>>("patients"),
            readDataFile<Record<string, Stored<Therapist>>>("therapists"),
      ]).then(([patients, therapists]) => {
            Patients = Object.entries(patients).map(([id, p]) => ({ id, ...p }));
            Therapists = Object.entries(therapists).map(([id, t]) => ({ id, ...t }));
      }).catch((e) => { loading = null; throw e; });
      return loading;
}
