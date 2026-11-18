import { ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronRight, LucideIcon, Search } from "lucide-react";
import PersonAvatar from "../people/PersonAvatar";
import { AREA_ICON_BY_CODE, AREA_LABEL } from "../ui/AreaBadge";
import { useDismiss } from "@/hooks/useDismiss";
import { EDGE, keepInside } from "@/utils/placement";
import { Area } from "@core/types/base";

export const MAX_PATIENTS_PER_BLOCK = 3;
const MAX_RESULTS = 50;

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Persona elegible en una lista (paciente o terapeuta). `authorizations` define las áreas que se pueden elegir. */
export type AssignablePatient = {
      id: string
      fullName: string
      authorizations?: Partial<Record<Area, number>>
      /** Sesiones ya agendadas por área: el menú de áreas muestra "usadas/autorizadas" */
      used?: Partial<Record<Area, number>>
};

/** Persona elegida con el área en que se le asigna. */
export type Assignment = { patient: AssignablePatient, area: Area };

/** Opción simple del menú: acción directa, o lista de opciones a elegir en un submenú. */
export type MenuAction = {
      label: string
      icon?: LucideIcon
      danger?: boolean
      onClick?: () => void
      /** Si se pasa, la opción abre un submenú con estas alternativas en vez de ejecutarse directamente */
      choices?: { id: string, label: string }[]
      choicesTitle?: string
      onChoose?: (id: string) => void
}

/** Opción que abre una lista de personas para elegir (con menú de áreas al elegir una). */
export type PanelSpec = {
      label: string
      icon?: LucideIcon
      /** Personas elegibles */
      patients: AssignablePatient[]
      /** Elegidas al abrir (al editar algo que ya existe) */
      initial?: { id: string, area: Area }[]
      maxPatients?: number
      /** Aviso bajo el contador cuando el máximo es menor al habitual */
      maxHint?: string
      submitLabel: string
      /** Cómo llamar a lo que se elige en el contador ("pacientes", "terapeuta") */
      noun?: string
      searchPlaceholder?: string
      /** A quién pertenece el área que se elige, si no es la persona elegida ("Área para Ana") */
      areaOwner?: string
      /** Permite guardar sin nadie elegido (p. ej. quitar a todos los pacientes adicionales) */
      allowEmpty?: boolean
      onSubmit: (assignments: Assignment[]) => void
}

type SessionContextMenuProps = {
      /** Posición del clic derecho (coordenadas de pantalla) */
      x: number
      y: number
      /** Resumen de lo seleccionado, p. ej. "Lun · 8:00 – 9:30" */
      label: string
      panels: PanelSpec[]
      /** Opciones extra bajo las listas (marcar en casa, eliminar...) */
      actions?: MenuAction[]
      onClose: () => void
}

type Chosen = { id: string, area: Area | null };
type Point = { left: number, top: number };
type AreaMenuState = { id: string, rowLeft: number, rowRight: number, rowTop: number };

const ITEM = "flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-default";

/**
 * Opción de menú que abre un submenú al pasar el cursor. El submenú es fijo y está siempre montado (invisible),
 * así se puede medir y colocar donde cabe: a la derecha o a la izquierda, subiendo si se saldría por abajo.
 * Con `pinned` queda abierto aunque el mouse salga de él.
 */
function HoverSubmenu({ label, icon: Icon, danger, pinned, remeasure, onPanelMouseDown, children }: {
      label: string
      icon?: LucideIcon
      danger?: boolean
      pinned?: boolean
      /** Cambia cuando el contenido cambia de alto, para volver a colocarlo */
      remeasure?: unknown
      onPanelMouseDown?: () => void
      children: ReactNode
}) {
      const itemRef = useRef<HTMLDivElement>(null);
      const panelRef = useRef<HTMLDivElement>(null);
      const [pos, setPos] = useState<(Point & { side: "right" | "left" }) | null>(null);

      useLayoutEffect(() => {
            const item = itemRef.current!.getBoundingClientRect();
            const panel = panelRef.current!.getBoundingClientRect();
            const fitsRight = item.right + panel.width <= window.innerWidth - EDGE;
            const fitsLeft = item.left - panel.width >= EDGE;
            const side = fitsRight || !fitsLeft ? "right" : "left";
            setPos({
                  side,
                  left: side === "right" ? Math.min(item.right, window.innerWidth - panel.width - EDGE) : item.left - panel.width,
                  top: keepInside(item.top, panel.height, window.innerHeight),
            });
      }, [remeasure]);

      return (
            <div ref={itemRef} className="relative group/item">
                  <div role="menuitem" aria-haspopup="menu" className={`${ITEM} group-hover/item:bg-ink-200 ${danger ? "text-red-500" : ""}`}>
                        <span className="flex items-center gap-3">
                              {Icon && <Icon size={16} className="shrink-0" />}
                              {label}
                        </span>
                        <ChevronRight size={14} className="shrink-0" />
                  </div>

                  {/* El padding del lado del ítem evita perder el hover al cruzar el hueco */}
                  <div
                        ref={panelRef}
                        onMouseDown={onPanelMouseDown}
                        style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
                        className={`fixed z-50 ${pos?.side === "left" ? "pr-1" : "pl-1"} ${pinned ? "visible" : "invisible group-hover/item:visible"}`}
                  >
                        {children}
                  </div>
            </div>
      );
}

/** Opción del menú con su lista de personas: buscador, radios, menú de áreas al elegir una y botón de confirmar. */
function PeopleSubmenu({ spec, onClose }: { spec: PanelSpec, onClose: () => void }) {
      const {
            label, icon, patients, initial = [], maxPatients = MAX_PATIENTS_PER_BLOCK, maxHint, submitLabel,
            noun = "pacientes", searchPlaceholder = "Buscar paciente", areaOwner, allowEmpty, onSubmit,
      } = spec;
      const areaRef = useRef<HTMLDivElement>(null);

      const [query, setQuery] = useState("");
      const [chosen, setChosen] = useState<Chosen[]>(initial);
      const [areaMenu, setAreaMenu] = useState<AreaMenuState | null>(null);
      // Tras interactuar con la lista, el submenú queda abierto aunque el mouse salga de él (hasta cerrar todo el menú)
      const [pinned, setPinned] = useState(false);
      const [areaPos, setAreaPos] = useState<Point | null>(null);

      const results = useMemo(() => {
            const q = normalize(query.trim());
            return patients
                  .filter((p) => !q || normalize(p.fullName).includes(q))
                  .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"))
                  .slice(0, MAX_RESULTS);
      }, [patients, query]);

      const full = chosen.length >= maxPatients;
      const areaOf = (id: string) => chosen.find((c) => c.id === id)?.area ?? null;

      // Menú de áreas: junto a la fila elegida, del lado donde cabe, sin salirse por abajo
      useLayoutEffect(() => {
            if (!areaMenu) return setAreaPos(null);
            const r = areaRef.current!.getBoundingClientRect();
            const right = areaMenu.rowRight + 4 + r.width <= window.innerWidth - EDGE;
            setAreaPos({
                  left: keepInside(right ? areaMenu.rowRight + 4 : areaMenu.rowLeft - r.width - 4, r.width, window.innerWidth),
                  top: keepInside(areaMenu.rowTop, r.height, window.innerHeight),
            });
      }, [areaMenu]);

      /** Elegir una persona (o volver a tocarla) abre su menú de áreas. Si solo cabe una, reemplaza a la anterior. */
      const pick = (id: string, e: React.MouseEvent) => {
            const r = e.currentTarget.getBoundingClientRect();
            if (!chosen.some((c) => c.id === id)) {
                  if (full && maxPatients > 1) return;
                  setChosen((prev) => maxPatients === 1 ? [{ id, area: null }] : [...prev, { id, area: null }]);
            }
            setAreaMenu({ id, rowLeft: r.left, rowRight: r.right, rowTop: r.top });
      };

      const setArea = (id: string, area: Area) => {
            setChosen((prev) => prev.map((c) => c.id === id ? { ...c, area } : c));
            setAreaMenu(null);
      };

      const remove = (id: string) => {
            setChosen((prev) => prev.filter((c) => c.id !== id));
            setAreaMenu(null);
      };

      const menuPerson = areaMenu && patients.find((p) => p.id === areaMenu.id);
      const menuAreas = (Object.entries(menuPerson?.authorizations ?? {}) as [Area, number][]).filter(([, n]) => n > 0);
      const ready = (allowEmpty || chosen.length > 0) && chosen.every((c) => c.area);

      return (
            <HoverSubmenu label={label} icon={icon} pinned={pinned} remeasure={results.length} onPanelMouseDown={() => setPinned(true)}>
                  <div className="w-72 rounded-xl bg-paper shadow-xl p-2 flex flex-col gap-2">
                        <div className="bg-neutral-50 rounded-lg flex items-center gap-2 px-3 h-9">
                              <Search size={16} className="text-ink-500 shrink-0" />
                              <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={searchPlaceholder}
                                    className="outline-none w-full text-sm bg-transparent"
                              />
                        </div>

                        <ul role="listbox" aria-multiselectable={maxPatients > 1} className="max-h-56 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#a3a3a3_transparent]">
                              {results.length === 0 && <li className="px-3 py-2 text-ink-500">Sin resultados</li>}
                              {results.map((p) => {
                                    const checked = chosen.some((c) => c.id === p.id);
                                    const area = areaOf(p.id);
                                    return (
                                          <li key={p.id} role="option" aria-selected={checked}>
                                                <button
                                                      type="button"
                                                      disabled={!checked && full && maxPatients > 1}
                                                      onClick={(e) => pick(p.id, e)}
                                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left cursor-pointer hover:bg-ink-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                      {/* radio: círculo con punto cuando está elegido */}
                                                      <span className={`size-4 shrink-0 rounded-full border-2 flex items-center justify-center ${checked ? "border-ink-900" : "border-ink-400"}`}>
                                                            {checked && <span className="size-2 rounded-full bg-ink-900" />}
                                                      </span>
                                                      <PersonAvatar fullName={p.fullName} className="w-6 h-6 text-[10px]" />
                                                      <span className="truncate">{p.fullName}</span>
                                                      {checked && (
                                                            <span className={`ml-auto shrink-0 text-xs ${area ? "text-ink-700" : "text-ink-500 italic"}`}>
                                                                  {area ? AREA_LABEL[area] : "elegir área"}
                                                            </span>
                                                      )}
                                                </button>
                                          </li>
                                    );
                              })}
                        </ul>

                        <div className="flex items-center justify-between gap-2 px-1">
                              <div className="flex flex-col">
                                    <span className="text-xs text-ink-500">{chosen.length}/{maxPatients} {noun}</span>
                                    {maxHint && <span className="text-[10px] text-ink-500">{maxHint}</span>}
                              </div>
                              <button
                                    type="button"
                                    disabled={!ready}
                                    onClick={() => {
                                          onSubmit(chosen.map((c) => ({ patient: patients.find((p) => p.id === c.id)!, area: c.area! })));
                                          onClose();
                                    }}
                                    className="rounded-lg bg-ink-900 text-neutral-50 px-3 py-1.5 text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                    {submitLabel}
                              </button>
                        </div>

                        {/* Áreas autorizadas. Fijo junto a su fila (la lista tiene scroll y la recortaría). */}
                        {areaMenu && menuPerson && (
                              <div
                                    ref={areaRef}
                                    role="menu"
                                    aria-label={`Área de ${menuPerson.fullName}`}
                                    style={{ left: areaPos?.left ?? areaMenu.rowRight, top: areaPos?.top ?? areaMenu.rowTop, visibility: areaPos ? "visible" : "hidden" }}
                                    className="fixed z-50 w-60 rounded-xl bg-paper shadow-xl p-1"
                              >
                                    <p className="px-3 py-1.5 text-xs text-ink-500">Área para {areaOwner ?? menuPerson.fullName.split(" ")[0]}</p>
                                    {menuAreas.length === 0 && <p className="px-3 py-2 text-ink-500">Sin autorizaciones</p>}
                                    {menuAreas.map(([area, n]) => {
                                          const { icon: Icon, color } = AREA_ICON_BY_CODE[area];
                                          const selected = areaOf(menuPerson.id) === area;
                                          const used = menuPerson.used?.[area] ?? 0;
                                          return (
                                                <button
                                                      key={area}
                                                      type="button"
                                                      role="menuitemradio"
                                                      aria-checked={selected}
                                                      onClick={() => setArea(menuPerson.id, area)}
                                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left cursor-pointer hover:bg-ink-200"
                                                >
                                                      <span className={`size-4 shrink-0 rounded-full border-2 flex items-center justify-center ${selected ? "border-ink-900" : "border-ink-400"}`}>
                                                            {selected && <span className="size-2 rounded-full bg-ink-900" />}
                                                      </span>
                                                      <Icon size={14} color={color} className="shrink-0" />
                                                      <span className="truncate">{AREA_LABEL[area]}</span>
                                                      {/* usadas/autorizadas: en rojo si ya se pasó de lo autorizado, en verde si está completo */}
                                                      <span
                                                            title={menuPerson.used ? `${menuPerson.used[area] ?? 0} agendadas de ${n} autorizadas` : `${n} autorizadas`}
                                                            className={`ml-auto text-xs tabular-nums ${used > n ? "text-red-500 font-medium" : used === n ? "text-emerald-500 font-medium" : "text-ink-500"}`}
                                                      >
                                                            {menuPerson.used ? `${used}/${n}` : n}
                                                      </span>
                                                </button>
                                          );
                                    })}
                                    <button
                                          type="button"
                                          onClick={() => remove(menuPerson.id)}
                                          className="w-full mt-1 border-t border-ink-200 px-3 py-1.5 text-left text-xs text-ink-500 cursor-pointer hover:text-ink-900"
                                    >
                                          Quitar
                                    </button>
                              </div>
                        )}
                  </div>
            </HoverSubmenu>
      );
}

/**
 * Menú contextual de celdas o de una sesión: listas de personas para elegir (cada una con su menú de áreas)
 * y acciones extra. Cada nivel se coloca donde cabe para no cortarse con la ventana.
 */
export default function SessionContextMenu({ x, y, label, panels, actions = [], onClose }: SessionContextMenuProps) {
      const ref = useRef<HTMLDivElement>(null);
      useDismiss(ref, true, onClose);
      const [menuPos, setMenuPos] = useState<Point | null>(null);

      // Menú principal: dentro de la ventana; si no cabe hacia abajo, se abre hacia arriba
      useLayoutEffect(() => {
            const r = ref.current!.getBoundingClientRect();
            const top = y + r.height > window.innerHeight - EDGE ? y - r.height : y;
            setMenuPos({ left: keepInside(x, r.width, window.innerWidth), top: keepInside(top, r.height, window.innerHeight) });
      }, [x, y]);

      return (
            <div
                  ref={ref}
                  role="menu"
                  onContextMenu={(e) => e.preventDefault()}
                  // Invisible hasta medirse y colocarse (el layout effect corre antes de pintar)
                  style={{ left: menuPos?.left ?? x, top: menuPos?.top ?? y, visibility: menuPos ? "visible" : "hidden" }}
                  className="fixed z-50 w-56 rounded-xl bg-paper text-ink-700 shadow-xl p-1 text-sm"
            >
                  <p className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-500">
                        <CalendarDays size={12} className="shrink-0" />
                        {label}
                  </p>

                  {panels.map((spec) => <PeopleSubmenu key={spec.label} spec={spec} onClose={onClose} />)}

                  {actions.map((a) => a.choices ? (
                        // Opción que pregunta algo antes de ejecutarse (p. ej. con qué paciente queda la sesión en casa)
                        <HoverSubmenu key={a.label} label={a.label} icon={a.icon} danger={a.danger}>
                              <div className="w-60 rounded-xl bg-paper shadow-xl p-1">
                                    <p className="px-3 py-1.5 text-xs text-ink-500">{a.choicesTitle}</p>
                                    {a.choices.map((c) => (
                                          <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => { a.onChoose?.(c.id); onClose(); }}
                                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left cursor-pointer hover:bg-ink-200"
                                          >
                                                <PersonAvatar fullName={c.label} className="w-6 h-6 text-[10px]" />
                                                <span className="truncate">{c.label}</span>
                                          </button>
                                    ))}
                              </div>
                        </HoverSubmenu>
                  ) : (
                        <button
                              key={a.label}
                              type="button"
                              onClick={() => { a.onClick?.(); onClose(); }}
                              className={`${ITEM} w-full text-left cursor-pointer hover:bg-ink-200 ${a.danger ? "text-red-500" : ""}`}
                        >
                              <span className="flex items-center gap-3">
                                    {a.icon && <a.icon size={16} className="shrink-0" />}
                                    {a.label}
                              </span>
                        </button>
                  ))}
            </div>
      );
}
