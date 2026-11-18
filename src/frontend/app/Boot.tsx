import { useEffect, useState, type ComponentType } from "react";
import { loadDirectory } from "@data/data";
import { DATA_SOURCE } from "@/data/dataFiles";
import { AppSkeleton } from "@/components/ui/Skeleton";
// Aplica el tema elegido (clase .dark en <html>) ANTES de pintar el skeleton; si no, saldría claro aunque el usuario use el oscuro
import "@/hooks/useTheme";

/**
 * Carga pacientes y terapeutas ANTES de montar la app: varios módulos los leen de forma síncrona al importarse, así que
 * App se importa dinámicamente cuando ya están.
 */
export default function Boot() {
      const [App, setApp] = useState<ComponentType | null>(null);
      const [error, setError] = useState<string | null>(null);

      useEffect(() => {
            let alive = true;
            loadDirectory()
                  .then(() => import("./App"))
                  .then((m) => alive && setApp(() => m.default))
                  .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
            return () => { alive = false; };
      }, []);

      if (App) return <App />;

      // Mientras carga: el esqueleto de la app (barra lateral + primera vista) en vez de un texto
      if (!error) return <AppSkeleton />;

      return (
            <div className="min-h-screen flex items-center justify-center p-6 font-sans text-ink-700">
                  {error && (
                        <div role="alert" className="max-w-md flex flex-col gap-2">
                              <p className="text-lg font-medium text-ink-950">No se pudieron cargar los datos</p>
                              <p className="text-sm">{error}</p>
                              <p className="text-xs text-ink-600">
                                    {DATA_SOURCE === "api"
                                          ? <>Revisa que el backend esté corriendo (<code>pnpm api:dev</code>) y la base lista (<code>/api/health/db</code>). Para usar los JSON de src/data sin base: <code>VITE_DATA_SOURCE=files</code>.</>
                                          : <>Con <code>VITE_DATA_SOURCE=files</code> los datos salen del servidor de desarrollo de Vite (<code>pnpm dev</code>).</>}
                              </p>
                        </div>
                  )}
            </div>
      );
}
