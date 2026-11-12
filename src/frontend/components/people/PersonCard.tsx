import { Area, City } from "@/types/shared"
import PersonAvatar from "./PersonAvatar"
import AppButton from "../ui/AppButton"
import { Check, ChevronRight, MapPin, Pencil, User, X } from "lucide-react"
import { memo, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useAnimateReflow } from "@/hooks/useAnimateReflow"
import { useDismiss } from "@/hooks/useDismiss"
import { placeBeside } from "@/utils/placement"
import AreaBadge, { AREA_ICON_BY_CODE, AREA_LABEL } from "../ui/AreaBadge";

export type PersonCardProps = {
      id: string
      fullName: string
      city: City
      authorizations?: Partial<Record<Area, number>>
}

/** Lo que se puede editar de una persona; los terapeutas no tienen autorizaciones. */
export type PersonEdit = { fullName: string, city: City, authorizations?: Partial<Record<Area, number>> }

const CITIES: City[] = ["CTG", "STM", "NVA"];
const ALL_AREAS = Object.keys(AREA_ICON_BY_CODE) as Area[];
const NO_NAMES: string[] = [];

type PersonCardComponentProps = {
      person: PersonCardProps
      /** Pacientes tienen áreas autorizadas; terapeutas no */
      kind: "patient" | "therapist"
      /** Nombres de los terapeutas del paciente, o de los pacientes del terapeuta */
      related?: string[]
      /** Guarda la edición (en patients.json / therapists.json). Si no se pasa, la card no es editable. */
      onSave?: (id: string, edit: PersonEdit) => Promise<void>
}

/** Campo numérico de un área al editar: con valor se ve normal; vacío (área sin autorización) a 60% de opacidad. */
function AreaField({ area, value, onChange }: { area: Area, value: string, onChange: (v: string) => void }) {
      const { icon: Icon, color } = AREA_ICON_BY_CODE[area];
      return (
            <label
                  title={AREA_LABEL[area]}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium transition-opacity focus-within:opacity-100 ${value === "" ? "opacity-60" : ""}`}
            >
                  <Icon size={12} color={color} />
                  <input
                        type="number" min={0} inputMode="numeric" placeholder="—"
                        value={value} onChange={(e) => onChange(e.target.value)}
                        aria-label={`Sesiones de ${AREA_LABEL[area]}`}
                        className="w-10 bg-transparent outline-none tabular-nums border-b border-transparent hover:border-ink-300 focus:border-ink-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
            </label>
      );
}

/**
 * Lista de nombres de los terapeutas/pacientes asociados, al lado del botón y dentro de la ventana. Va en un portal:
 * las filas de la lista virtualizada tienen `transform`, y un `position: fixed` dentro de ellas se calcula respecto a la fila.
 */
function RelatedPopover({ title, names, anchor, popRef }: { title: string, names: string[], anchor: DOMRect, popRef: React.RefObject<HTMLDivElement | null> }) {
      const ref = popRef;
      const [pos, setPos] = useState<{ left: number, top: number } | null>(null);

      useLayoutEffect(() => {
            // offsetWidth/Height: no incluyen la escala de la animación de entrada, que falsearía la medida
            setPos(placeBeside(anchor, ref.current!.offsetWidth, ref.current!.offsetHeight));
      }, [anchor]);

      return createPortal(
            <div
                  ref={ref}
                  role="tooltip"
                  style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
                  className="fixed z-50 w-60 font-sans rounded-lg bg-ink-900 text-neutral-50 shadow-xl px-3 py-2 text-xs animate-[patient-in_120ms_ease-out]"
            >
                  <p className="mb-1.5 text-[10px] uppercase tracking-wider opacity-60">{title} · {names.length}</p>
                  {names.length === 0 ? <p className="opacity-70">Ninguno asignado</p> : (
                        // sin flex: en una columna con scroll los <li> se encogían a alto 0 y solo se veía la barra
                        <ul className="max-h-56 overflow-y-auto space-y-1 [scrollbar-width:thin]">
                              {names.map((n) => <li key={n} className="truncate">{n}</li>)}
                        </ul>
                  )}
            </div>,
            document.body
      );
}

function PersonCard({ person, kind, related = NO_NAMES, onSave }: PersonCardComponentProps) {
      const badgesRef = useRef<HTMLDivElement>(null);
      useAnimateReflow(badgesRef);

      // ---- edición: los textos pasan a ser inputs "invisibles"; las áreas faltantes aparecen vacías a 60% ----
      const [editing, setEditing] = useState(false);
      const [name, setName] = useState(person.fullName);
      const [city, setCity] = useState<City>(person.city);
      const [areas, setAreas] = useState<Partial<Record<Area, string>>>({});
      const [saving, setSaving] = useState(false);
      const [error, setError] = useState<string | null>(null);

      const startEditing = () => {
            setName(person.fullName);
            setCity(person.city);
            setAreas(Object.fromEntries(Object.entries(person.authorizations ?? {}).map(([a, n]) => [a, String(n)])));
            setError(null);
            setEditing(true);
      };

      const confirm = async () => {
            const fullName = name.trim();
            if (!fullName) return setError("El nombre no puede estar vacío");
            const authorizations: Partial<Record<Area, number>> = {};
            for (const area of ALL_AREAS) {
                  const raw = (areas[area] ?? "").trim();
                  if (raw === "") continue; // vacío = sin autorización en esa área
                  const n = Number(raw);
                  if (!Number.isInteger(n) || n < 0) return setError(`Valor inválido en ${AREA_LABEL[area]}`);
                  if (n > 0) authorizations[area] = n;
            }
            setSaving(true);
            try {
                  await onSave?.(person.id, { fullName, city, ...(kind === "patient" ? { authorizations } : {}) });
                  setEditing(false);
            } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
            } finally {
                  setSaving(false);
            }
      };

      // ---- botón de asociados: cantidad de terapeutas (paciente) o pacientes (terapeuta) y lista con el caret ----
      const [open, setOpen] = useState(false);
      const [anchor, setAnchor] = useState<DOMRect | null>(null);
      const pillRef = useRef<HTMLDivElement>(null);
      const popRef = useRef<HTMLDivElement>(null);
      useDismiss([pillRef, popRef], open, () => setOpen(false));
      const toggleRelated = () => {
            if (!open) setAnchor(pillRef.current!.getBoundingClientRect());
            setOpen((o) => !o);
      };
      const relatedTitle = kind === "patient" ? "Terapeutas asignados" : "Pacientes asignados";

      const inputBase = "bg-transparent outline-none border-b border-transparent hover:border-ink-300 focus:border-ink-600 transition-colors";
      const authorized = Object.keys(person.authorizations ?? {}) as Area[];

      return (
            <div className="@container relative w-full min-w-70 flex items-start px-4 pt-6 pb-9 gap-3 rounded-xl inset-shadow-sm inset-shadow-white/5 shadow-md ">
                  <PersonAvatar fullName={editing ? name || person.fullName : person.fullName} />

                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                        <div className={`flex items-center gap-2 min-w-0 ${editing ? "pr-16" : "pr-8"}`}>
                              {editing ? (
                                    <input
                                          autoFocus value={name} onChange={(e) => setName(e.target.value)}
                                          onKeyDown={(e) => { if (e.key === "Enter") confirm(); if (e.key === "Escape") setEditing(false); }}
                                          aria-label="Nombre"
                                          className={`${inputBase} min-w-0 flex-1 text-xl font-display font-medium tracking-tight text-ink-950`}
                                    />
                              ) : (
                                    <span className="text-xl font-display font-medium tracking-tight text-ink-950 truncate">
                                          {person.fullName} ·
                                    </span>
                              )}
                              <span className="shrink-0 flex items-center gap-0.5 text-[11px] uppercase tracking-wider text-ink-600">
                                    <MapPin size={11} strokeWidth={1.5} />
                                    {editing ? (
                                          <select
                                                value={city} onChange={(e) => setCity(e.target.value as City)} aria-label="Ciudad"
                                                className={`${inputBase} appearance-none uppercase tracking-wider cursor-pointer`}
                                          >
                                                {CITIES.map((c) => <option key={c} value={c} className="text-ink-900 bg-paper">{c}</option>)}
                                          </select>
                                    ) : person.city}
                              </span>
                        </div>

                        <div ref={badgesRef} className="relative flex flex-wrap items-center gap-1.5">
                              {editing && kind === "patient"
                                    // todas las áreas: las autorizadas con su valor y las que faltan vacías (a 60%)
                                    ? [...authorized, ...ALL_AREAS.filter((a) => !authorized.includes(a))].map((area) => (
                                          <AreaField key={area} area={area} value={areas[area] ?? ""} onChange={(v) => setAreas((prev) => ({ ...prev, [area]: v }))} />
                                    ))
                                    : authorized.map((area) => {
                                          const value = person.authorizations?.[area];
                                          return value !== undefined && <AreaBadge key={area} area={area} value={value} />;
                                    })}
                        </div>

                        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
                  </div>

                  {onSave && (
                        <div className="absolute top-2 right-2 z-10 flex gap-1">
                              {editing ? (
                                    <>
                                          <AppButton variant="icon-only" icon={Check} iconSize={14} tooltip={saving ? "Guardando…" : "Guardar"} tooltipSide="left" className="p-1.5! rounded-lg!" onClick={confirm} />
                                          <AppButton variant="icon-only" icon={X} iconSize={14} tooltip="Cancelar" tooltipSide="left" className="p-1.5! rounded-lg!" onClick={() => setEditing(false)} />
                                    </>
                              ) : (
                                    <AppButton variant="icon-only" icon={Pencil} iconSize={14} tooltip="Editar" className="p-1.5! rounded-lg!" onClick={startEditing} />
                              )}
                        </div>
                  )}

                  {/* Pill de asociados: icono + cantidad (lo coordinado) y caret que despliega los nombres */}
                  <div ref={pillRef} className="absolute bottom-2 right-2 z-10 flex items-center rounded-full overflow-hidden bg-paper shadow-sm text-xs">
                        <div
                              onClick={toggleRelated}
                              title={relatedTitle}
                              className="flex items-center gap-1 pl-2.5 pr-0.5 py-1 text-ink-700 cursor-pointer @max-xs:px-2"
                        >
                              <User size={16} strokeWidth={1.5} />
                              <span className="@max-xs:hidden tabular-nums">{related.length}</span>
                        </div>
                        <div className="@max-xs:hidden">
                              <AppButton
                                    variant="secondary"
                                    icon={ChevronRight}
                                    iconSize={16}
                                    className={`px-1! py-1! rounded-none! shadow-none! [&_svg]:transition-transform ${open ? "[&_svg]:-rotate-90" : ""}`}
                                    onClick={toggleRelated}
                              />
                        </div>
                        {open && anchor && <RelatedPopover title={relatedTitle} names={related} anchor={anchor} popRef={popRef} />}
                  </div>
            </div>
      );
}

export default memo(PersonCard);
