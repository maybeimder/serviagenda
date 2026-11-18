import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Home, Plus, Trash2 } from "lucide-react"
import type { Day, Schedule, TimeRange } from "@core/types/base"
import { placeAbove } from "@/utils/placement"

/** Disponibilidad de una persona: presencial (`site`) y, solo en pacientes, a domicilio (`home`). */
export type PersonAvailability = { site: Schedule, home?: Schedule }
type Group = "site" | "home"

const DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_SHORT: Record<Day, string> = { mon: "Lun", tue: "Mar", wed: "Mié", thu: "Jue", fri: "Vie", sat: "Sáb", sun: "Dom" };
const DAY_LONG: Record<Day, string> = { mon: "Lunes", tue: "Martes", wed: "Miércoles", thu: "Jueves", fri: "Viernes", sat: "Sábado", sun: "Domingo" };
const GROUP_LABEL: Record<Group, string> = { site: "Presencial", home: "A domicilio" };
const DEFAULT_RANGE: TimeRange = { start: "08:00", end: "18:00" };

/** "07:00" -> "7am", "18:30" -> "6:30pm", "12:00" -> "12pm" */
export function formatHour(time: string): string {
      const [h, m] = time.split(":").map(Number);
      const suffix = h >= 12 ? "pm" : "am";
      const hour = h % 12 === 0 ? 12 : h % 12;
      return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${suffix}`;
}

const sameRange = (a?: TimeRange, b?: TimeRange) => !!a && !!b && a.start === b.start && a.end === b.end;
/** HH:MM con ceros: se comparan como texto. */
const isValid = (r: TimeRange) => /^\d\d:\d\d$/.test(r.start) && /^\d\d:\d\d$/.test(r.end) && r.start < r.end;

type Selection = { group: Group, day: Day, isNew: boolean, anchor: DOMRect };

type Props = {
      availability: PersonAvailability
      /** Guarda la nueva disponibilidad. Si no se pasa, los badges son solo de lectura. */
      onChange?: (next: PersonAvailability) => Promise<void>
      /** Permite agregar días a domicilio (pacientes) */
      allowHome?: boolean
      className?: string
}

/**
 * Badges de vistazo rápido: un chip por día ("Lun 7am – 6pm"). Al tocar uno se abre un mini menú con la hora de inicio y
 * la de fin editables; se guarda al cerrarlo (clic fuera / Enter), Escape descarta. El "+" agrega un día.
 */
export default function AvailabilityBadges({ availability, onChange, allowHome = false, className = "" }: Props) {
      const rootRef = useRef<HTMLDivElement>(null);
      const popRef = useRef<HTMLDivElement>(null);
      const [sel, setSel] = useState<Selection | null>(null);
      const [draft, setDraft] = useState<TimeRange>(DEFAULT_RANGE);
      const [error, setError] = useState<string | null>(null);

      const chips = useMemo(() => (["site", "home"] as Group[]).flatMap((group) =>
            DAYS.flatMap((day) => {
                  const range = availability[group]?.[day];
                  return range ? [{ group, day, range }] : [];
            })
      ), [availability]);

      const open = (next: Selection, range: TimeRange) => { setSel(next); setDraft(range); setError(null); };

      /** Cierra el menú; con `save` aplica el borrador si es válido y cambió. */
      const close = (save: boolean) => {
            const current = sel;
            setSel(null);
            if (!save || !current || !onChange) return;
            const before = availability[current.group]?.[current.day];
            if (!isValid(draft) || sameRange(before, draft)) return;
            apply(current.group, current.day, draft);
      };

      const apply = (group: Group, day: Day, range: TimeRange | null) => {
            if (!onChange) return;
            const schedule: Schedule = { ...availability[group] };
            if (range) schedule[day] = range; else delete schedule[day];
            const next: PersonAvailability = { ...availability, [group]: schedule };
            if (group === "home" && Object.keys(schedule).length === 0) delete next.home;
            setError(null);
            onChange(next).catch((e) => setError(e instanceof Error ? e.message : String(e)));
      };

      const remove = () => {
            if (!sel) return;
            const current = sel;
            setSel(null);
            if (!current.isNew) apply(current.group, current.day, null);
      };

      // Clic fuera del menú (y del chip abierto) lo cierra guardando; Escape lo descarta
      useEffect(() => {
            if (!sel) return;
            const onDown = (e: MouseEvent) => {
                  const target = e.target as Node;
                  const onOwnChip = rootRef.current?.querySelector(`[data-chip="${sel.isNew ? "add" : `${sel.group}-${sel.day}`}"]`)?.contains(target);
                  if (!popRef.current?.contains(target) && !onOwnChip) close(true);
            };
            const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(false); };
            document.addEventListener("mousedown", onDown);
            document.addEventListener("keydown", onKey);
            return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
      });

      const chipClass = "flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium tabular-nums whitespace-nowrap bg-ink-100 text-ink-700 transition-colors";
      const missingSite = DAYS.filter((d) => !availability.site?.[d]);
      const canAdd = !!onChange && (missingSite.length > 0 || allowHome);

      return (
            <div ref={rootRef} className={className}>
                  <div className="flex flex-wrap items-center gap-1.5">
                        {chips.length === 0 && <span className="text-xs text-ink-500">Sin disponibilidad</span>}
                        {chips.map(({ group, day, range }) => {
                              const active = sel?.group === group && sel.day === day && !sel.isNew;
                              return (
                                    <button
                                          key={`${group}-${day}`} type="button" data-chip={`${group}-${day}`} disabled={!onChange}
                                          title={`${DAY_LONG[day]} · ${GROUP_LABEL[group]}`}
                                          onClick={(e) => {
                                                if (active) return close(true);
                                                open({ group, day, isNew: false, anchor: e.currentTarget.getBoundingClientRect() }, range);
                                          }}
                                          className={`${chipClass} ${onChange ? "cursor-pointer hover:bg-ink-200" : "cursor-default"} ${active ? "bg-ink-200! ring-1 ring-ink-400" : ""}`}
                                    >
                                          {group === "home" && <Home size={11} strokeWidth={1.75} aria-label="A domicilio" />}
                                          <span className="text-ink-950">{DAY_SHORT[day]}</span>
                                          <span>{formatHour(range.start)} – {formatHour(range.end)}</span>
                                    </button>
                              );
                        })}
                        {canAdd && (
                              <button
                                    type="button" data-chip="add" aria-label="Agregar día" title="Agregar día"
                                    onClick={(e) => {
                                          if (sel?.isNew) return close(false);
                                          const group: Group = missingSite.length > 0 ? "site" : "home";
                                          const day = (group === "site" ? missingSite : DAYS.filter((d) => !availability.home?.[d]))[0];
                                          if (day) open({ group, day, isNew: true, anchor: e.currentTarget.getBoundingClientRect() }, DEFAULT_RANGE);
                                    }}
                                    className={`${chipClass} px-1.5 cursor-pointer hover:bg-ink-200 ${sel?.isNew ? "bg-ink-200!" : ""}`}
                              >
                                    <Plus size={12} />
                              </button>
                        )}
                  </div>

                  {error && <p role="alert" className="mt-1 text-xs text-red-500">{error}</p>}

                  {sel && (
                        <HoursPopover
                              popRef={popRef} sel={sel} draft={draft} setDraft={setDraft}
                              availability={availability} allowHome={allowHome}
                              onPick={(group, day) => setSel({ ...sel, group, day })}
                              onDone={() => close(true)} onRemove={remove}
                        />
                  )}
            </div>
      );
}

type PopoverProps = {
      popRef: React.RefObject<HTMLDivElement | null>
      sel: Selection
      draft: TimeRange
      setDraft: (r: TimeRange) => void
      availability: PersonAvailability
      allowHome: boolean
      onPick: (group: Group, day: Day) => void
      onDone: () => void
      onRemove: () => void
}

/**
 * Mini menú con las horas de un día. Va en un portal: las filas de la lista virtualizada tienen `transform`, y un
 * `position: fixed` dentro de ellas se calcula respecto a la fila.
 */
function HoursPopover({ popRef, sel, draft, setDraft, availability, allowHome, onPick, onDone, onRemove }: PopoverProps) {
      const [pos, setPos] = useState<{ left: number, top: number } | null>(null);

      useLayoutEffect(() => {
            // offsetWidth/Height: no incluyen la escala de la animación de entrada, que falsearía la medida
            setPos(placeAbove(sel.anchor, popRef.current!.offsetWidth, popRef.current!.offsetHeight));
      }, [sel.anchor, sel.isNew, popRef]);

      const free = (group: Group) => DAYS.filter((d) => !availability[group]?.[d]);
      const invalid = !isValid(draft);
      const changed = sel.isNew || !sameRange(availability[sel.group]?.[sel.day], draft);
      const field = "bg-current/10 rounded-md px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-current/40 tabular-nums";

      return createPortal(
            <div
                  ref={popRef} role="dialog" aria-label="Horario"
                  onKeyDown={(e) => { if (e.key === "Enter" && !invalid) onDone(); }}
                  style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
                  className="fixed z-50 font-sans rounded-lg bg-ink-900 text-neutral-50 shadow-xl px-3 py-2 text-xs flex flex-col gap-2 animate-[patient-in_120ms_ease-out]"
            >
                  {sel.isNew ? (
                        <div className="flex items-center gap-1.5">
                              {allowHome && (
                                    <select
                                          aria-label="Modalidad" value={sel.group}
                                          onChange={(e) => { const g = e.target.value as Group; onPick(g, free(g)[0] ?? sel.day); }}
                                          className={field}
                                    >
                                          {(["site", "home"] as Group[]).filter((g) => free(g).length > 0).map((g) => <option key={g} value={g} className="text-ink-900">{GROUP_LABEL[g]}</option>)}
                                    </select>
                              )}
                              <select aria-label="Día" value={sel.day} onChange={(e) => onPick(sel.group, e.target.value as Day)} className={field}>
                                    {free(sel.group).map((d) => <option key={d} value={d} className="text-ink-900">{DAY_LONG[d]}</option>)}
                              </select>
                        </div>
                  ) : (
                        <p className="text-[10px] uppercase tracking-wider opacity-60">{DAY_LONG[sel.day]} · {GROUP_LABEL[sel.group]}</p>
                  )}

                  <div className="flex items-center gap-1.5">
                        <input type="time" aria-label="Hora de inicio" autoFocus value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className={field} />
                        <span className="opacity-60">–</span>
                        <input type="time" aria-label="Hora de fin" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className={field} />
                  </div>

                  {invalid && <p className="text-[11px] text-red-300">La hora de fin debe ser posterior al inicio</p>}

                  <div className="flex items-center justify-between gap-2">
                        <button type="button" onClick={onRemove} className="flex items-center gap-1 opacity-70 hover:opacity-100 cursor-pointer">
                              <Trash2 size={12} />{sel.isNew ? "Cancelar" : "Quitar día"}
                        </button>
                        <button
                              type="button" onClick={onDone} disabled={invalid}
                              // con cambios (o un día nuevo) el botón se resalta en verde
                              className={`px-2 py-0.5 rounded-md disabled:opacity-40 cursor-pointer ${changed && !invalid ? "bg-emerald-500 text-white hover:bg-emerald-600 font-medium" : "bg-current/15 hover:bg-current/25"}`}
                        >
                              {sel.isNew ? "Agregar" : "Listo"}
                        </button>
                  </div>
            </div>,
            document.body
      );
}
