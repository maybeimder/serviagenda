import { useCallback, useEffect, useState } from "react";

/** Archivos de src/data que se leen y escriben en runtime (ver el plugin dataApi de vite.config.ts). */
export type DataFile = "sessions" | "coordination" | "opt_coordination" | "opt_sessions" | "patients" | "therapists";

export async function readDataFile<T>(name: DataFile): Promise<T> {
      const res = await fetch(`/api/data/${name}`);
      if (!res.ok) throw new Error(`No se pudo leer ${name}.json (${res.status})`);
      return res.json();
}

export async function writeDataFile(name: DataFile, value: unknown): Promise<void> {
      const res = await fetch(`/api/data/${name}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      if (!res.ok) throw new Error(`No se pudo guardar ${name}.json (${res.status})`);
}

/**
 * Carga un archivo al montar. `loaded` es false hasta que llega; `save` lo escribe y actualiza el valor local.
 * Si la lectura falla (p. ej. sin el servidor de desarrollo) queda `error` y el valor inicial.
 */
export function useDataFile<T>(name: DataFile, initial: T) {
      const [data, setData] = useState<T>(initial);
      const [loaded, setLoaded] = useState(false);
      const [error, setError] = useState<string | null>(null);

      useEffect(() => {
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

      return { data, loaded, error, save };
}
