import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, CalendarPlus, Clock, Home, Pencil, Shuffle, Trash, UserPlus } from "lucide-react";
import { Area, Day, TimeRange } from "@core/types/base";
import { Patient, Session } from "@core/types/dtos";
import { MAX_PATIENTS_AT_HOME } from "@core/sessions/edit";
import { DAYS, SLOT_MINS } from "@core/config/scheduling";
import { minsToTime, toMins } from "@core/utils/time";
import { AREA_ICON_BY_CODE } from "@/components/ui/AreaBadge";
import { toTitleCase } from "@/utils/toTitleCase";
import SessionContextMenu, { AssignablePatient, Assignment, MAX_PATIENTS_PER_BLOCK, MenuAction, PanelSpec } from "./SessionContextMenu";
import SessionTooltip from "./SessionTooltip";

/** Días visibles: de lunes a sábado (el domingo no se muestra). */
const WEEK_DAYS: Day[] = DAYS.filter((d) => d !== "sun");
const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Píxeles que hay que mover el mouse para que un clic sobre una sesión pase a ser un arrastre. */
const DRAG_THRESHOLD = 4;
/** Duración de la animación de levantar / soltar una sesión. */
const SETTLE_MS = 160;

/** Bloque de celdas seleccionado: días y rango horario. */
export type BlockSelection = { days: Day[], schedule: TimeRange };

/** Paciente de una sesión con el área en que se le atiende (ids, para que el padre resuelva los datos). */
export type PatientAreaId = { patientId: string, area: Area };

export type PatientFocus = {
      patient: AssignablePatient
      coordinatedTherapists: AssignablePatient[]
      otherPatients: AssignablePatient[]
};

type BigCalendarProps = {
      sessions?: Session[]
      /** Desde quién se mira la agenda: define qué nombre se muestra en cada sesión. */
      perspective?: "patient" | "therapist"
      /**
       * Pacientes que se pueden asignar. Si se pasa, el clic derecho sobre una selección abre el menú
       * "Asignar Nuevas Sesiones" (máx. 3 pacientes por bloque) y el de una sesión permite editar sus pacientes.
       */
      assignablePatients?: AssignablePatient[]
      /**
       * Solo en la vista de un paciente: el paciente, sus terapeutas coordinados (con las áreas del paciente en
       * `authorizations`, para elegir el área de la sesión) y los demás pacientes que se pueden sumar a una sesión.
       */
      patientFocus?: PatientFocus
      /**
       * Se llama con todos los bloques seleccionados (Ctrl + arrastre agrega más) y lo elegido con su área:
       * pacientes en la vista de un terapeuta, o el terapeuta (uno) en la vista de un paciente.
       */
      onAssignSessions?: (blocks: BlockSelection[], assignments: Assignment[]) => void
      /**
       * Selección suave: al arrastrar, el rectángulo (ancho y alto) sigue al puntero sin saltos y al soltar
       * se ajusta a las celdas más cercanas. Con `false` snapea celda a celda mientras se arrastra.
       */
      smoothSelection?: boolean
      /** Si se pasa, las sesiones se pueden mover arrastrándolas (con snap a las celdas de 30 min). */
      onMoveSession?: (id: string, day: Day, schedule: TimeRange) => void
      /** Menú de una sesión (clic derecho): editar pacientes y áreas, marcar en casa, eliminar. */
      onEditSessionPatients?: (id: string, entries: PatientAreaId[]) => void
      /** Vista de un paciente: cambia el terapeuta de la sesión y el área en que se atiende a ese paciente. */
      onEditSessionTherapist?: (id: string, therapistId: string, area: Area) => void
      /** `keepPatientId`: con qué paciente queda la sesión cuando tenía varios. */
      onSetSessionAtHome?: (id: string, atHome: boolean, keepPatientId?: string) => void
      onDeleteSession?: (id: string) => void
      /** Primera hora visible (formato 24h) */
      startHour?: number
      /** Hora en que termina la grilla (formato 24h) */
      endHour?: number
      className?: string
}

const formatHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;

const formatTime = (mins: number) => {
      const h = Math.floor(mins / 60), m = mins % 60;
      return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`;
};

/** Áreas distintas de la sesión (una sola si no es cruzada). */
const areasOf = (s: Session) => [...new Set(Object.values(s.areaPerPatient))];

/** Barra lateral: el color del área, o franjas con el color de cada área si la sesión es cruzada. */
function barBackground(s: Session): string {
      const colors = areasOf(s).map((a) => AREA_ICON_BY_CODE[a].color);
      if (colors.length <= 1) return colors[0] ?? "transparent";
      const step = 100 / colors.length;
      return `linear-gradient(to bottom, ${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(", ")})`;
}

/** Las sesiones cruzadas no llevan nombre: "Cruzada (nº de pacientes)", sin importar desde quién se mira. */
function sessionLabel(s: Session, perspective: "patient" | "therapist") {
      if (s.crossed) return `Cruzada (${s.patient.length})`;
      return toTitleCase(perspective === "patient" ? s.therapist.name : s.patient[0]?.name ?? "");
}

const toAssignable = (p: Patient): AssignablePatient =>
      ({ id: p.id, fullName: toTitleCase(p.name), authorizations: p.sessionsRequirements });

/** Tarjeta sobria de una sesión: fondo neutral y barra de color del área a la izquierda. */
function SessionCard({ session: s, perspective, className = "", style, selected, ...handlers }: {
      session: Session
      perspective: "patient" | "therapist"
      className?: string
      style?: React.CSSProperties
      /** Sesión con su menú abierto */
      selected?: boolean
      onMouseDown?: (e: React.MouseEvent) => void
      onContextMenu?: (e: React.MouseEvent) => void
      onMouseEnter?: (e: React.MouseEvent) => void
      onMouseLeave?: (e: React.MouseEvent) => void
}) {
      const start = toMins(s.schedule.start), end = toMins(s.schedule.end);
      const Icon = s.crossed ? Shuffle : AREA_ICON_BY_CODE[areasOf(s)[0]].icon;
      return (
            <div
                  // Las cruzadas tienen su propio tooltip con los pacientes
                  title={s.crossed ? undefined : `${formatTime(start)} - ${formatTime(end)} · ${sessionLabel(s, perspective)}`}
                  style={style}
                  {...handlers}
                  className={`overflow-hidden rounded-md bg-neutral-50 ${selected ? "ring-2 ring-violet-400" : ""} ${className}`}
            >
                  <span className="absolute inset-y-0 left-0 w-2" style={{ background: barBackground(s) }} />
                  {end - start <= SLOT_MINS ? (
                        // Sesión de 30 min: solo el ícono del área y el nombre, en una línea
                        <div className="h-full pl-3.5 pr-1.5 flex items-center gap-1 text-[11px] leading-none min-w-0">
                              <Icon size={11} className="shrink-0 text-ink-700" color={s.crossed ? "currentColor" : barBackground(s)} />
                              <span className="truncate font-medium text-ink-900">{sessionLabel(s, perspective)}</span>
                        </div>
                  ) : (
                        <div className="h-full pl-4.5 pr-1.5 flex flex-col items-start justify-center gap-1 text-[11px] leading-none text-ink-700 min-w-0">
                              <div className="flex gap-1 ml-1 w-full">
                                    <Icon size={11} className="shrink-0 text-ink-700" color={s.crossed ? "currentColor" : barBackground(s)} />
                                    <span className="shrink-0 tabular-nums text-ink-500">{`${formatTime(start)}`}</span>
                                    {s.atHome && <>·<Home size={10} className="shrink-0 text-ink-800" /></>}
                              </div>
                              <span className="truncate font-medium text-ink-900">{sessionLabel(s, perspective)}</span>
                        </div>
                  )}
            </div>
      );
}

/** Celda = día (índice en WEEK_DAYS) + slot de 30 min (índice desde startHour). */
type Cell = { day: number, slot: number };

/**
 * Rectángulo seleccionado en unidades de celda: `x` en días, `y` en slots. En modo suave los bordes son
 * fraccionarios mientras se arrastra y se ajustan a la celda más cercana al soltar.
 */
type Selection = { x0: number, x1: number, y0: number, y1: number };

/** Posición continua del puntero sobre la grilla (`x` en días, `y` en slots). */
type Pointer = { x: number, y: number };

/** Selección entre la celda inicial y el puntero. La celda inicial siempre queda incluida. */
function selectionBetween(anchor: Cell, p: Pointer, smooth: boolean): Selection {
      if (smooth) return {
            x0: Math.min(anchor.day, p.x), x1: Math.max(anchor.day + 1, p.x),
            y0: Math.min(anchor.slot, p.y), y1: Math.max(anchor.slot + 1, p.y),
      };
      const day = Math.floor(p.x), slot = Math.floor(p.y);
      return {
            x0: Math.min(anchor.day, day), x1: Math.max(anchor.day, day) + 1,
            y0: Math.min(anchor.slot, slot), y1: Math.max(anchor.slot, slot) + 1,
      };
}

/** Ajusta cada borde a la celda más cercana (mínimo una celda por lado). */
function snapSelection(s: Selection, dayCount: number, slotCount: number): Selection {
      const snap = (a: number, b: number, max: number): [number, number] => {
            const lo = Math.max(0, Math.min(max - 1, Math.round(a)));
            return [lo, Math.max(lo + 1, Math.min(max, Math.round(b)))];
      };
      const [x0, x1] = snap(s.x0, s.x1, dayCount);
      const [y0, y1] = snap(s.y0, s.y1, slotCount);
      return { x0, x1, y0, y1 };
}

const containsCell = (s: Selection, c: Cell) => c.day >= s.x0 && c.day < s.x1 && c.slot >= s.y0 && c.slot < s.y1;

/** Sesión que se está arrastrando. `target` ya está ajustado (snap) a una celda. */
type Drag = {
      id: string
      colW: number, rowH: number     // tamaño de una celda en px, medido al empezar
      from: Cell, target: Cell
      slots: number                  // duración en slots
      valid: boolean                 // false si el destino se solapa con otra sesión
      lifted: boolean                // levantada: escala y sombra mayores
      settling: boolean              // soltada: animando hacia su lugar final
};

/**
 * Vista semanal (lun a sáb) que ocupa todo el alto disponible, sin scroll. Cada fila es una hora con
 * borde marcado y la media hora se distingue con una línea punteada. Las sesiones son tarjetas sobrias
 * (neutral) con una barra de color a la izquierda según el área. Las celdas de 30 min se seleccionan
 * con clic + arrastre, como en una hoja de cálculo, y las sesiones se mueven arrastrándolas. Una sesión
 * tiene prioridad sobre la celda que cubre: su clic derecho abre su propio menú.
 */
export default function BigCalendar({
      sessions = [], perspective = "therapist", assignablePatients, patientFocus, onAssignSessions, onMoveSession,
      onEditSessionPatients, onEditSessionTherapist, onSetSessionAtHome, onDeleteSession, smoothSelection = true,
      startHour = 6, endHour = 18, className = "",
}: BigCalendarProps) {
      const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
      const baseMins = startHour * 60;
      const totalMins = (endHour - startHour) * 60;
      const slotCount = totalMins / SLOT_MINS;
      const dayCount = WEEK_DAYS.length;

      const rootRef = useRef<HTMLDivElement>(null);
      const daysRef = useRef<HTMLDivElement>(null);

      // Un clic fuera del calendario quita la selección (los menús viven dentro del calendario, así que no cuentan como fuera)
      useEffect(() => {
            const clear = (e: MouseEvent) => {
                  if (!rootRef.current?.contains(e.target as Node)) setSelections((all) => all.length ? [] : all);
            };
            document.addEventListener("mousedown", clear);
            return () => document.removeEventListener("mousedown", clear);
      }, []);
      /** Celda donde empezó el arrastre de selección (null si no se está seleccionando) */
      const selecting = useRef<Cell | null>(null);
      const [isSelecting, setIsSelecting] = useState(false);
      // Varias selecciones (Ctrl + arrastre agrega una); la que se está arrastrando es siempre la última
      const [selections, setSelections] = useState<Selection[]>([]);
      const [menu, setMenu] = useState<{ x: number, y: number } | null>(null);
      // Menú de una sesión (clic derecho sobre ella) y tooltip de las cruzadas
      const [sessionMenu, setSessionMenu] = useState<{ x: number, y: number, id: string } | null>(null);
      const [hovered, setHovered] = useState<{ id: string, rect: DOMRect } | null>(null);

      // Arrastre de sesiones: `press` es el clic aún sin mover; `drag` existe una vez pasado el umbral
      const sessionsRef = useRef(sessions);
      sessionsRef.current = sessions;
      const press = useRef<{ id: string, x: number, y: number } | null>(null);
      const [drag, setDrag] = useState<Drag | null>(null);
      const dragRef = useRef<Drag | null>(null);
      dragRef.current = drag;

      /** Posición continua del puntero en la grilla; fuera de ella se ajusta al borde (para poder arrastrar más allá). */
      const pointerAt = useCallback((clientX: number, clientY: number): Pointer => {
            const rect = daysRef.current!.getBoundingClientRect();
            const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
            return {
                  x: clamp(((clientX - rect.left) / rect.width) * dayCount, dayCount),
                  y: clamp(((clientY - rect.top) / rect.height) * slotCount, slotCount),
            };
      }, [slotCount, dayCount]);

      /** Celda bajo el puntero. */
      const cellAt = useCallback((clientX: number, clientY: number): Cell => {
            const p = pointerAt(clientX, clientY);
            return { day: Math.min(dayCount - 1, Math.floor(p.x)), slot: Math.min(slotCount - 1, Math.floor(p.y)) };
      }, [pointerAt, slotCount, dayCount]);

      /** Posición de una sesión en la grilla y su duración en slots. */
      const placementOf = useCallback((s: Session) => ({
            cell: { day: WEEK_DAYS.indexOf(s.day), slot: Math.round((toMins(s.schedule.start) - baseMins) / SLOT_MINS) },
            slots: Math.max(1, Math.round((toMins(s.schedule.end) - toMins(s.schedule.start)) / SLOT_MINS)),
      }), [baseMins]);

      /** ¿Otra sesión ocupa algo de ese espacio? */
      const overlaps = useCallback((id: string, cell: Cell, slots: number) =>
            sessionsRef.current.some((o) => {
                  if (o.id === id || WEEK_DAYS.indexOf(o.day) !== cell.day) return false;
                  const p = placementOf(o);
                  return cell.slot < p.cell.slot + p.slots && cell.slot + slots > p.cell.slot;
            }), [placementOf]);

      useEffect(() => {
            const move = (e: MouseEvent) => {
                  // 1) selección de celdas
                  if (selecting.current) {
                        const next = selectionBetween(selecting.current, pointerAt(e.clientX, e.clientY), smoothSelection);
                        setSelections((all) => {
                              const last = all[all.length - 1];
                              if (last && last.x0 === next.x0 && last.x1 === next.x1 && last.y0 === next.y0 && last.y1 === next.y1) return all;
                              return [...all.slice(0, -1), next];
                        });
                  }

                  // 2) arrastre de una sesión
                  const pressed = press.current;
                  if (!pressed) return;
                  const current = dragRef.current;

                  if (!current) {
                        if (Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) < DRAG_THRESHOLD) return;
                        const s = sessionsRef.current.find((x) => x.id === pressed.id);
                        const rect = daysRef.current?.getBoundingClientRect();
                        if (!s || !rect) return;
                        const { cell, slots } = placementOf(s);
                        setDrag({
                              id: s.id, colW: rect.width / dayCount, rowH: rect.height / slotCount,
                              from: cell, target: cell, slots, valid: true, lifted: false, settling: false,
                        });
                        // Un frame después se "levanta": la transición de escala y sombra queda animada
                        requestAnimationFrame(() => setDrag((d) => d && { ...d, lifted: true }));
                        return;
                  }

                  // Snap: el destino es la celda más cercana al desplazamiento del puntero
                  const day = Math.max(0, Math.min(dayCount - 1, current.from.day + Math.round((e.clientX - pressed.x) / current.colW)));
                  const slot = Math.max(0, Math.min(slotCount - current.slots, current.from.slot + Math.round((e.clientY - pressed.y) / current.rowH)));
                  if (day === current.target.day && slot === current.target.slot) return; // sin cambio de celda: sin render
                  const target = { day, slot };
                  setDrag({ ...current, target, valid: !overlaps(current.id, target, current.slots) });
            };

            const up = () => {
                  if (selecting.current) {
                        // Al soltar, el alto y el ancho se ajustan a la celda más cercana (con transición, ver abajo)
                        setSelections((all) => all.length ? [...all.slice(0, -1), snapSelection(all[all.length - 1], dayCount, slotCount)] : all);
                        selecting.current = null;
                        setIsSelecting(false);
                  }
                  press.current = null;

                  const current = dragRef.current;
                  if (!current || current.settling) return;

                  const moved = current.valid && (current.target.day !== current.from.day || current.target.slot !== current.from.slot);
                  if (moved) {
                        const start = baseMins + current.target.slot * SLOT_MINS;
                        onMoveSession?.(current.id, WEEK_DAYS[current.target.day], { start: minsToTime(start), end: minsToTime(start + current.slots * SLOT_MINS) });
                  }
                  // Se suelta: vuelve a tamaño normal en su destino (o regresa al origen si no era válido)
                  setDrag({ ...current, target: moved ? current.target : current.from, valid: true, lifted: false, settling: true });
                  setTimeout(() => setDrag(null), SETTLE_MS);
            };

            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
            return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      }, [pointerAt, placementOf, overlaps, slotCount, dayCount, baseMins, onMoveSession, smoothSelection]);

      const onMouseDown = (e: React.MouseEvent) => {
            if (e.button !== 0) return;
            setMenu(null);
            setSessionMenu(null);
            const cell = cellAt(e.clientX, e.clientY);
            const first: Selection = { x0: cell.day, x1: cell.day + 1, y0: cell.slot, y1: cell.slot + 1 };
            // Ctrl (o Cmd) + arrastre agrega otra selección; sin Ctrl se reemplazan todas
            setSelections((all) => e.ctrlKey || e.metaKey ? [...all, first] : [first]);
            selecting.current = cell;
            setIsSelecting(true);
      };

      // Una sesión tiene prioridad sobre la celda: un clic sobre ella nunca inicia una selección
      const onSessionMouseDown = (e: React.MouseEvent, id: string) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            setMenu(null);
            setSessionMenu(null);
            setHovered(null);
            if (onMoveSession) press.current = { id, x: e.clientX, y: e.clientY };
      };

      const onSessionContextMenu = (e: React.MouseEvent, id: string) => {
            e.preventDefault();
            e.stopPropagation(); // no abre el menú de celdas
            if (!onEditSessionPatients && !onSetSessionAtHome && !onDeleteSession) return;
            setSelections([]);
            setMenu(null);
            setHovered(null);
            setSessionMenu({ x: e.clientX, y: e.clientY, id });
      };

      const onContextMenu = (e: React.MouseEvent) => {
            e.preventDefault();
            if (!cellPanel) return;
            // Clic derecho fuera de las selecciones: se selecciona esa celda, como en una hoja de cálculo
            const cell = cellAt(e.clientX, e.clientY);
            if (!selections.some((s) => containsCell(s, cell)))
                  setSelections([{ x0: cell.day, x1: cell.day + 1, y0: cell.slot, y1: cell.slot + 1 }]);
            setSessionMenu(null);
            setMenu({ x: e.clientX, y: e.clientY });
      };

      const blocks: BlockSelection[] = selections.map((raw) => {
            const s = snapSelection(raw, dayCount, slotCount);
            return {
                  days: WEEK_DAYS.slice(s.x0, s.x1),
                  schedule: { start: minsToTime(baseMins + s.y0 * SLOT_MINS), end: minsToTime(baseMins + s.y1 * SLOT_MINS) },
            };
      });
      const blockLabel = (b: BlockSelection) => {
            const first = WEEK_DAYS.indexOf(b.days[0]), last = WEEK_DAYS.indexOf(b.days[b.days.length - 1]);
            return `${DAY_SHORT[first]}${last > first ? `–${DAY_SHORT[last]}` : ""} · ${formatTime(toMins(b.schedule.start))} – ${formatTime(toMins(b.schedule.end))}`;
      };
      const menuLabel = blocks.length === 1 ? blockLabel(blocks[0]) : `${blocks.length} bloques seleccionados`;

      /** Lista de "Asignar Nuevas Sesiones" del menú de celdas: pacientes (vista de un terapeuta) o UN terapeuta coordinado (vista de un paciente). */
      const firstName = (name: string) => name.split(" ")[0];
      const cellPanel: PanelSpec | null =
            perspective === "patient"
                  ? patientFocus && patientFocus.coordinatedTherapists.length > 0 ? {
                        label: "Asignar Nuevas Sesiones", icon: CalendarPlus, submitLabel: "Asignar",
                        patients: patientFocus.coordinatedTherapists, maxPatients: 1, noun: "terapeuta",
                        searchPlaceholder: "Buscar terapeuta", areaOwner: firstName(patientFocus.patient.fullName),
                        maxHint: "Un terapeuta por sesión",
                        onSubmit: (assignments) => onAssignSessions?.(blocks, assignments),
                  } : null
                  : assignablePatients ? {
                        label: "Asignar Nuevas Sesiones", icon: CalendarPlus, submitLabel: "Asignar",
                        patients: assignablePatients,
                        onSubmit: (assignments) => onAssignSessions?.(blocks, assignments),
                  } : null;

      /** Listas de personas del menú de una sesión, según desde quién se mira. */
      const sessionPanels = (s: Session): PanelSpec[] => {
            if (perspective === "patient") {
                  if (!patientFocus) return [];
                  const me = patientFocus.patient;
                  const myArea = s.areaPerPatient[me.id];
                  const withMyAreas = (t: AssignablePatient): AssignablePatient => ({ ...t, authorizations: me.authorizations });

                  // Terapeutas elegibles: los coordinados más el actual de la sesión
                  const therapists = new Map<string, AssignablePatient>();
                  [...patientFocus.coordinatedTherapists, withMyAreas({ id: s.therapist.id, fullName: toTitleCase(s.therapist.name) })]
                        .forEach((t) => therapists.set(t.id, t));

                  // Otros pacientes: los elegibles más los que ya comparten la sesión
                  const others = new Map<string, AssignablePatient>();
                  [...patientFocus.otherPatients, ...s.patient.filter((p) => p.id !== me.id).map(toAssignable)].forEach((p) => others.set(p.id, p));

                  const panels: PanelSpec[] = [{
                        label: "Editar terapeuta", icon: Pencil, submitLabel: "Guardar",
                        patients: [...therapists.values()], initial: [{ id: s.therapist.id, area: myArea }],
                        maxPatients: 1, noun: "terapeuta", searchPlaceholder: "Buscar terapeuta", areaOwner: firstName(me.fullName),
                        onSubmit: ([pick]) => pick && onEditSessionTherapist?.(s.id, pick.patient.id, pick.area),
                  }];
                  // En casa solo cabe un paciente, así que no se pueden sumar otros
                  if (!s.atHome) panels.push({
                        label: "Agregar otros pacientes", icon: UserPlus, submitLabel: "Guardar", allowEmpty: true,
                        patients: [...others.values()],
                        initial: s.patient.filter((p) => p.id !== me.id).map((p) => ({ id: p.id, area: s.areaPerPatient[p.id] })),
                        maxPatients: MAX_PATIENTS_PER_BLOCK - 1, maxHint: "Máximo 2 además de este paciente",
                        onSubmit: (entries) => onEditSessionPatients?.(s.id, [
                              { patientId: me.id, area: myArea },
                              ...entries.map((a) => ({ patientId: a.patient.id, area: a.area })),
                        ]),
                  });
                  return panels;
            }

            // Vista de un terapeuta: pacientes de su ciudad más los que ya están en la sesión
            const pool = new Map<string, AssignablePatient>();
            [...(assignablePatients ?? []), ...s.patient.map(toAssignable)].forEach((p) => pool.set(p.id, p));
            return [{
                  label: "Editar pacientes", icon: Pencil, submitLabel: "Guardar",
                  patients: [...pool.values()],
                  initial: s.patient.map((p) => ({ id: p.id, area: s.areaPerPatient[p.id] })),
                  maxPatients: s.atHome ? MAX_PATIENTS_AT_HOME : MAX_PATIENTS_PER_BLOCK,
                  maxHint: s.atHome ? "Sesión en casa: un solo paciente" : undefined,
                  onSubmit: (entries) => onEditSessionPatients?.(s.id, entries.map((a) => ({ patientId: a.patient.id, area: a.area }))),
            }];
      };

      /** Menú de la sesión con clic derecho: editar, en casa, eliminar. */
      const renderSessionMenu = () => {
            const s = sessionMenu && sessions.find((x) => x.id === sessionMenu.id);
            if (!sessionMenu || !s) return null;

            const actions: MenuAction[] = [];
            if (onSetSessionAtHome) {
                  if (s.atHome) actions.push({ label: "Quitar sesión en casa", icon: Building2, onClick: () => onSetSessionAtHome(s.id, false) });
                  else if (s.patient.length > MAX_PATIENTS_AT_HOME) actions.push({
                        // En casa solo cabe un paciente: se pregunta con cuál se queda
                        label: "Marcar como sesión en casa",
                        icon: Home,
                        choicesTitle: "¿Con qué paciente queda la sesión?",
                        choices: s.patient.map((p) => ({ id: p.id, label: toTitleCase(p.name) })),
                        onChoose: (patientId) => onSetSessionAtHome(s.id, true, patientId),
                  });
                  else actions.push({ label: "Marcar como sesión en casa", icon: Home, onClick: () => onSetSessionAtHome(s.id, true) });
            }
            if (onDeleteSession) actions.push({ label: "Eliminar sesión", icon: Trash, danger: true, onClick: () => onDeleteSession(s.id) });

            return (
                  <SessionContextMenu
                        key={s.id}
                        x={sessionMenu.x} y={sessionMenu.y}
                        label={`${DAY_SHORT[WEEK_DAYS.indexOf(s.day)]} · ${formatTime(toMins(s.schedule.start))} – ${formatTime(toMins(s.schedule.end))}${s.atHome ? " · en casa" : ""}`}
                        panels={sessionPanels(s)}
                        actions={actions}
                        onClose={() => setSessionMenu(null)}
                  />
            );
      };

      const dragged = drag && sessions.find((s) => s.id === drag.id);
      const movable = !!onMoveSession;
      const hoveredSession = hovered && !drag && !sessionMenu && !isSelecting ? sessions.find((s) => s.id === hovered.id) : undefined;
      /** Caja de una celda/sesión en px (con el mismo margen que las tarjetas dentro de la columna). */
      const box = (c: Cell, slots: number, d: Drag, scale = 1) => ({
            width: d.colW - 4, height: d.rowH * slots - 2,
            transform: `translate3d(${c.day * d.colW + 2}px, ${c.slot * d.rowH + 1}px, 0) scale(${scale})`,
      });

      return (
            <div ref={rootRef} className={`h-full min-h-[28rem] flex flex-col rounded-xl border border-ink-200 bg-neutral-100 ${className}`}>
                  {/* Encabezado con el nombre de cada día */}
                  <div className="grid grid-cols-[3.5rem_repeat(6,minmax(0,1fr))] rounded-t-xl bg-neutral-50 border-b border-ink-300 dark:border-ink-300/40">
                        <div className="flex items-end justify-end pr-2 pb-2.5 text-ink-400"><Clock size={14} strokeWidth={1.5} /></div>
                        {WEEK_DAYS.map((day, i) => (
                              <div key={day} className="border-l border-ink-200 dark:border-ink-200/40 px-2 py-3.5 text-center">
                                    <span className="text-sm font-semibold tracking-wide text-ink-800">{DAY_NAMES[i]}</span>
                              </div>
                        ))}
                  </div>

                  <div className="flex-1 min-h-0 pb-3 flex">
                        {/* Eje de horas */}
                        <div className="w-14 shrink-0 flex flex-col">
                              {hours.map((h) => (
                                    // la primera hora queda pegada al encabezado, así que no se sube
                                    <div key={h} className="flex-1 min-h-0 pr-2 text-right text-[11px] text-ink-500 -translate-y-2 first:translate-y-0.5">
                                          {formatHour(h)}
                                    </div>
                              ))}
                              <div className="h-0 pr-2 text-right text-[11px] text-ink-500 -translate-y-2">{formatHour(endHour)}</div>
                        </div>

                        <div
                              ref={daysRef}
                              onMouseDown={onMouseDown}
                              onContextMenu={onContextMenu}
                              className={`relative flex-1 min-w-0 grid grid-cols-6 ${drag ? "cursor-grabbing [&_*]:cursor-grabbing" : ""}`}
                        >
                              {/* Selecciones: un solo rectángulo punteado y morado claro por selección, en porcentajes de la grilla.
                                  Van antes de las columnas para quedar bajo las sesiones. Sin transición mientras se arrastran
                                  (siguen al puntero); al soltar se ajustan animadas a las celdas más cercanas. */}
                              {selections.map((s, i) => (
                                    <div
                                          key={i}
                                          aria-hidden
                                          style={{
                                                left: `${(s.x0 / dayCount) * 100}%`,
                                                width: `${((s.x1 - s.x0) / dayCount) * 100}%`,
                                                top: `${(s.y0 / slotCount) * 100}%`,
                                                height: `${((s.y1 - s.y0) / slotCount) * 100}%`,
                                          }}
                                          className={`absolute pointer-events-none bg-violet-400/15 border-2 border-dashed border-violet-400
                                                ${isSelecting ? "" : "transition-[left,width,top,height] ease-in"}`}
                                    />
                              ))}

                              {WEEK_DAYS.map((day) => (
                                    <div key={day} className="relative flex flex-col border-l border-ink-300 dark:border-ink-300/40">
                                          {hours.map((h) => (
                                                <div
                                                      key={h}
                                                      // en modo oscuro las líneas bajan de opacidad para no competir con las sesiones
                                                      className="relative flex-1 min-h-0 border-b border-ink-300 dark:border-ink-300/40 after:absolute after:inset-x-0 after:top-1/2 after:border-t after:border-dashed after:border-ink-200 dark:after:border-ink-200/30 after:content-['']"
                                                />
                                          ))}

                                          {/* Sesiones del día, posicionadas por porcentaje del rango visible */}
                                          {sessions.filter((s) => s.day === day).map((s) => {
                                                const start = toMins(s.schedule.start), end = toMins(s.schedule.end);
                                                if (end <= baseMins || start >= baseMins + totalMins) return null;
                                                const isDragged = drag?.id === s.id;
                                                return (
                                                      <SessionCard
                                                            key={s.id}
                                                            session={s}
                                                            perspective={perspective}
                                                            selected={sessionMenu?.id === s.id}
                                                            onMouseDown={(e) => onSessionMouseDown(e, s.id)}
                                                            onContextMenu={(e) => onSessionContextMenu(e, s.id)}
                                                            onMouseEnter={(e) => s.crossed && setHovered({ id: s.id, rect: e.currentTarget.getBoundingClientRect() })}
                                                            onMouseLeave={() => setHovered(null)}
                                                            style={{
                                                                  top: `calc(${((start - baseMins) / totalMins) * 100}% + 1px)`,
                                                                  height: `calc(${((end - start) / totalMins) * 100}% - 2px)`,
                                                            }}
                                                            // la original queda como huella tenue mientras su copia se arrastra
                                                            className={`absolute inset-x-0.5 shadow-sm transition-opacity duration-150
                                                                  ${movable ? "cursor-grab" : ""} ${isDragged ? (drag.settling ? "opacity-0" : "opacity-30") : ""}`}
                                                      />
                                                );
                                          })}
                                    </div>
                              ))}

                              {/* Arrastre: aviso rojo si el destino está ocupado + la copia que sigue al puntero con snap.
                                  Ambos se mueven con transform (acelerado por GPU) y solo se re-renderizan al cambiar de celda. */}
                              {drag && dragged && (
                                    <>
                                          <div
                                                aria-hidden
                                                style={box(drag.target, drag.slots, drag)}
                                                className={`absolute left-0 top-0 z-20 pointer-events-none rounded-md bg-red-500/25 ring-1 ring-red-500/60 transition-[opacity,transform] duration-150 ease-out
                                                      ${drag.valid ? "opacity-0" : "opacity-100"}`}
                                          />
                                          <SessionCard
                                                session={dragged}
                                                perspective={perspective}
                                                style={{ ...box(drag.target, drag.slots, drag, drag.lifted ? 1.06 : 1), willChange: "transform" }}
                                                className={`absolute left-0 top-0 z-30 pointer-events-none cursor-grabbing transition-[transform,box-shadow] duration-150 ease-out
                                                      ${drag.lifted ? "shadow-2xl" : "shadow-sm"} ${drag.valid ? "" : "ring-2 ring-red-500/70"}`}
                                          />
                                    </>
                              )}
                        </div>
                  </div>

                  {hovered && hoveredSession?.crossed && <SessionTooltip session={hoveredSession} anchor={hovered.rect} />}

                  {menu && blocks.length > 0 && cellPanel && (
                        <SessionContextMenu
                              x={menu.x} y={menu.y} label={menuLabel}
                              panels={[cellPanel]}
                              onClose={() => setMenu(null)}
                        />
                  )}

                  {renderSessionMenu()}
            </div>
      );
}
