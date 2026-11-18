import type { CSSProperties, ReactNode } from "react";

/*
 * Skeletons: cada uno copia la estructura, las clases y los tamaños de lo que reemplaza (AppLayout, Sidebar, la barra de
 * herramientas y el contenido de cada vista), así al llegar los datos nada se mueve. Usan los mismos tokens de color que
 * la app, por lo que siguen el tema (claro / oscuro) elegido.
 */

/** Bloque gris con un brillo que lo cruza: ocupa el lugar de lo que todavía se está cargando. */
export default function Skeleton({ className = "", style }: { className?: string, style?: CSSProperties }) {
      return (
            // `relative` solo si quien lo usa no lo posiciona (un skeleton absolute ya es contenedor del brillo, y `relative` lo sacaría de su lugar)
            <span aria-hidden style={style} className={`${/(^|\s)(absolute|relative|fixed|sticky)(\s|$)/.test(className) ? "" : "relative"} block overflow-hidden ${/(^|\s)rounded/.test(className) ? "" : "rounded-md"} bg-ink-200/70 ${className}`}>
                  <span className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_ease-in-out_infinite] bg-linear-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
            </span>
      );
}

/** Región que se está cargando: lectores de pantalla oyen "Cargando" y no cada bloque. */
export function SkeletonRegion({ label = "Cargando", className = "", children }: { label?: string, className?: string, children: ReactNode }) {
      return <div role="status" aria-busy="true" aria-label={label} className={className}>{children}</div>;
}

const Divider = () => <div className="w-px h-6 bg-ink-300 mx-1 @max-[920px]:hidden" />;
/** Botón de texto (AppButton secondary: p-3 + texto de 16px = 40px de alto). */
const TextButton = ({ className = "" }: { className?: string }) => <Skeleton className={`h-10 rounded-3xl ${className}`} />;

// ---------------------------------------------------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------------------------------------------------

/** Card de una persona: avatar de 48px, nombre, badges de áreas y la franja de horarios (alto de una card con dos líneas de badges). */
export function PersonCardSkeleton() {
      return (
            <div className="w-full min-w-70 min-h-42 flex flex-col px-4 pt-6 pb-2 gap-2 rounded-xl shadow-md">
                  <div className="flex items-start gap-3">
                        <Skeleton className="size-12 rounded-full shrink-0" />
                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                              <Skeleton className="h-7 w-3/4" />
                              <div className="flex flex-wrap gap-1.5">
                                    {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-5 w-12 rounded-lg" />)}
                              </div>
                        </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-7 pr-[4.75rem] items-center">
                        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-6 w-24 rounded-lg" />)}
                  </div>
            </div>
      );
}

/** Grilla de cards (hasta 3 columnas de mínimo 280px, como PeopleLister) mientras las personas cargan. */
export function PeopleGridSkeleton({ count = 6 }: { count?: number }) {
      return (
            <SkeletonRegion label="Cargando personas">
                  <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(max(280px,calc((100%-1rem)/3)),1fr))]">
                        {Array.from({ length: count }, (_, i) => <PersonCardSkeleton key={i} />)}
                  </div>
            </SkeletonRegion>
      );
}

/** Vista Personas: barra de herramientas (pestañas, buscador, ordenar, filtrar, bajas animaciones) y las dos listas. */
export function PeopleViewSkeleton() {
      return (
            <div className="w-full h-full py-8 flex flex-col gap-6">
                  <div className="@container flex flex-wrap gap-2 items-center">
                        <TextButton className="w-28" /><TextButton className="w-32" />
                        <Divider />
                        <div className="order-last w-full @[920px]:order-none @[920px]:w-auto @[920px]:flex-1 min-w-0"><Skeleton className="h-10 w-full rounded-3xl" /></div>
                        <Divider />
                        <TextButton className="w-40 @max-2xl:w-11" /><TextButton className="w-36 @max-2xl:w-11" />
                        <Skeleton className="size-11 rounded-3xl" />
                  </div>
                  <div className="w-full flex-1 min-h-0 min-w-0 flex gap-2">
                        <div className="bg-neutral-50 px-4 rounded-xl shadow-xl min-w-0 overflow-hidden py-4 flex-[1_1_0%]">
                              <div className="w-full h-full p-1 overflow-hidden"><PeopleGridSkeleton count={9} /></div>
                        </div>
                        <div className="bg-neutral-50 px-4 rounded-xl shadow-xl min-w-0 overflow-hidden py-4 flex-[0_0_3rem]" />
                  </div>
            </div>
      );
}

// ---------------------------------------------------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------------------------------------------------

const HOURS = 12; // 6 am a 6 pm, como el calendario

/** Calendario semanal: mismo encabezado, eje de horas y grilla (líneas por hora y de media hora) que BigCalendar, con tarjetas fantasma. */
export function CalendarSkeleton() {
      // [día, hora de inicio (desde las 6 am), horas de alto]
      const ghosts: [number, number, number][] = [[0, 1, 2], [0, 5, 1.5], [1, 3, 3], [2, 0, 2], [2, 6, 2.5], [3, 2, 1], [3, 7, 3], [4, 1, 2], [4, 5, 2], [5, 3, 1.5]];
      return (
            <SkeletonRegion label="Cargando agenda" className="h-full min-h-[28rem] flex flex-col rounded-xl border border-ink-200 bg-neutral-100">
                  <div className="grid grid-cols-[3.5rem_repeat(6,minmax(0,1fr))] rounded-t-xl bg-neutral-50 border-b border-ink-300 dark:border-ink-300/40">
                        <div className="flex items-end justify-end pr-2 pb-2.5"><Skeleton className="size-3.5 rounded-full" /></div>
                        {Array.from({ length: 6 }, (_, i) => (
                              <div key={i} className="border-l border-ink-200 dark:border-ink-200/40 px-2 py-3.5 flex justify-center"><Skeleton className="h-5 w-20" /></div>
                        ))}
                  </div>

                  <div className="flex-1 min-h-0 pb-3 flex">
                        <div className="w-14 shrink-0 flex flex-col">
                              {Array.from({ length: HOURS }, (_, h) => (
                                    <div key={h} className="flex-1 min-h-0 pr-2 flex justify-end -translate-y-2 first:translate-y-0.5"><Skeleton className="h-3 w-8" /></div>
                              ))}
                              <div className="h-0" />
                        </div>

                        <div className="relative flex-1 min-w-0 grid grid-cols-6">
                              {Array.from({ length: 6 }, (_, d) => (
                                    <div key={d} className="relative flex flex-col border-l border-ink-300 dark:border-ink-300/40">
                                          {Array.from({ length: HOURS }, (_, h) => (
                                                <div
                                                      key={h}
                                                      className="relative flex-1 min-h-0 border-b border-ink-300 dark:border-ink-300/40 after:absolute after:inset-x-0 after:top-1/2 after:border-t after:border-dashed after:border-ink-200 dark:after:border-ink-200/30 after:content-['']"
                                                />
                                          ))}
                                          {ghosts.filter(([day]) => day === d).map(([, start, span], i) => (
                                                <Skeleton
                                                      key={i} className="absolute inset-x-0.5 shadow-sm"
                                                      style={{ top: `calc(${(start / HOURS) * 100}% + 1px)`, height: `calc(${(span / HOURS) * 100}% - 2px)` }}
                                                />
                                          ))}
                                    </div>
                              ))}
                        </div>
                  </div>
            </SkeletonRegion>
      );
}

/** Vista Agenda: pestañas, selector de persona, semanas y rellenar automáticamente, y el calendario. */
export function ScheduleViewSkeleton() {
      return (
            <div className="w-full h-full flex flex-col py-8.5 gap-6">
                  <div className="@container flex flex-wrap gap-2 items-center">
                        <TextButton className="w-32" /><TextButton className="w-28" />
                        <Divider />
                        <Skeleton className="h-12 min-w-50 flex-1 rounded-3xl" />
                        <Divider />
                        {[1, 2, 3, 4].map((n) => <TextButton key={n} className="w-28 @max-[1000px]:w-14" />)}
                        <Divider />
                        <TextButton className="ml-auto w-60 @max-[1000px]:w-14" />
                  </div>
                  <div className="w-full flex-1 min-h-0 min-w-0"><CalendarSkeleton /></div>
            </div>
      );
}

// ---------------------------------------------------------------------------------------------------------------------
// Coordinar
// ---------------------------------------------------------------------------------------------------------------------

/** Slots de terapeuta (chip de 256x56 y el botón "+") mientras llega la coordinación del paciente. */
export function TherapistSlotsSkeleton() {
      return (
            <SkeletonRegion label="Cargando terapeutas" className="flex flex-col gap-4">
                  <div className="min-h-14 flex items-center"><Skeleton className="h-14 w-64 rounded-xl" /></div>
                  <div className="min-h-14 flex items-center"><Skeleton className="size-12 rounded-full" /></div>
            </SkeletonRegion>
      );
}

/** Vista Coordinar: ciudades y asignar automáticamente, y las columnas de paciente y terapeutas. */
export function CoordinateViewSkeleton() {
      return (
            <div className="w-full h-full flex flex-col py-8.5 gap-6">
                  <div className="@container flex flex-wrap gap-2 items-center">
                        <TextButton className="w-[3.7rem]" /><TextButton className="w-[3.7rem]" /><TextButton className="w-[3.7rem]" />
                        <TextButton className="ml-auto w-66 @max-xl:w-14" />
                  </div>
                  <div className="relative flex justify-center items-start gap-[10vw] pr-[6dvw] pt-[5dvh]">
                        <div className="w-96 shrink-0 flex flex-col gap-4">
                              <Skeleton className="h-5 w-20" />
                              <Skeleton className="size-14 rounded-3xl" />
                        </div>
                        <div className="w-64 shrink-0 flex flex-col gap-4">
                              <div className="h-5 flex items-center justify-between"><Skeleton className="h-5 w-28" /><Skeleton className="size-5 rounded-md" /></div>
                              <div className="min-h-14 flex items-center"><Skeleton className="h-11 w-60 rounded-xl" /></div>
                              <div className="min-h-14 flex items-center"><Skeleton className="size-12 rounded-full" /></div>
                        </div>
                  </div>
            </div>
      );
}

// ---------------------------------------------------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------------------------------------------------

/** La carcasa de la app (AppLayout + Sidebar) en gris, con el contenido que se le pase en el lugar de la vista. */
function AppShellSkeleton({ children }: { children: ReactNode }) {
      return (
            <SkeletonRegion label="Cargando la aplicación" className="flex relative w-full h-screen bg-neutral-100 px-8 py-16 gap-16 font-sans">
                  {/* Sidebar: Personas | Coordinar, Agendar (botones de solo icono de 56px) */}
                  <div className="w-fit h-[70dvh] self-center p-4 flex flex-col gap-5 items-center">
                        <div className="flex flex-col items-center gap-4"><Skeleton className="size-14 rounded-3xl" /></div>
                        <div className="w-[50%] h-px bg-ink-400" />
                        <div className="flex flex-col items-center gap-4"><Skeleton className="size-14 rounded-3xl" /><Skeleton className="size-14 rounded-3xl" /></div>
                  </div>

                  {/* Botón de tema */}
                  <div className="absolute top-4 right-4 z-40"><Skeleton className="size-11 rounded-3xl" /></div>

                  <main className="flex-1 min-w-0 min-h-0 flex flex-col">
                        <div className="flex-1 min-h-0 w-full gap-2 flex flex-col">
                              <span className="flex gap-4 items-center"><Skeleton className="size-7" /><Skeleton className="h-9 w-40" /></span>
                              <div className="flex-1 min-h-0 w-full overflow-hidden">{children}</div>
                        </div>
                  </main>
            </SkeletonRegion>
      );
}

/** Pantalla de arranque (se cargan pacientes y terapeutas): la carcasa y la vista de la ruta actual. */
export function AppSkeleton() {
      const path = typeof location === "undefined" ? "" : location.pathname;
      return (
            <AppShellSkeleton>
                  {path.startsWith("/schedule") ? <ScheduleViewSkeleton /> : path.startsWith("/coordinate") ? <CoordinateViewSkeleton /> : <PeopleViewSkeleton />}
            </AppShellSkeleton>
      );
}
