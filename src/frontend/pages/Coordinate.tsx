import AppButton from "@/components/ui/AppButton"
import AutoFillButton, { AutoFillScope } from "@/components/ui/AutoFillButton";
import PatientPicker, { PickedPatient } from "@/components/coordinate/PatientPicker";
import { City } from "@/types/shared";
import TherapistPicker, { PickedTherapist, pickedTherapistsById } from "@/components/coordinate/TherapistPicker";
import { Check, Plus, RotateCw, Sparkles, UserCheck } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Coordinator, CONFIG, CoordinationMap, therapistIdsOf, toCoordinationMap } from "@core/index";
import { Patients, Therapists } from "@data/data";
import { readDataFile, useDataFile, writeDataFile } from "@/data/dataFiles";

const MAX_THERAPISTS = CONFIG.PatientRelated.maxTherapists;
const ROW_HEIGHT = 56;   // alto de la fila superior del paciente y de cada slot, para que la primera curva sea recta
const ORIGIN_GAP = 10;  // separación entre el paciente y el punto donde nacen las curvas

const CORNER_RADIUS = 72;

/**
 * Estilo "splitter" (Logisim): una sola línea sale del paciente hasta la mitad del trayecto, ahí hay un tronco
 * vertical y de él nace una rama horizontal por terapeuta. Cada tramo se dibuja una sola vez (sin solapes).
 * `ys` son las alturas de cada slot; la primera coincide con `y1`, así que su rama es recta.
 */
function splitterPaths(x1: number, y1: number, x2: number, ys: number[]): string[] {
      const paths = [`M ${x1} ${y1} H ${x2}`]; // paciente -> primer terapeuta, recta
      if (ys.length < 2) return paths;

      const xm = (x1 + x2) / 2;
      const last = ys[ys.length - 1];
      const r = Math.max(0, Math.min(CORNER_RADIUS, last - y1, x2 - xm));

      // tronco hasta el último terapeuta, con la esquina redondeada
      paths.push(`M ${xm} ${y1} V ${last - r} Q ${xm} ${last} ${xm + r} ${last} H ${x2}`);
      // ramas intermedias (T desde el tronco)
      for (const y of ys.slice(1, -1)) paths.push(`M ${xm} ${y} H ${x2}`);
      return paths;
}

export default function CoordinateView() {
      const [ activeCity, setActiveCity ] = useState<City>("CTG")
      const [ patient, setPatient ] = useState<PickedPatient | null>(null)
      const [ paths, setPaths ] = useState<string[]>([])
      const [ origin, setOrigin ] = useState<{ x: number, y: number } | null>(null)
      const [ slotCount, setSlotCount ] = useState(1) // terapeutas visibles; se agregan con el botón "+"

      const boxRef = useRef<HTMLDivElement>(null);
      const patientRef = useRef<HTMLDivElement>(null);
      const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

      const [ assigned, setAssigned ] = useState<(PickedTherapist | null)[]>(() => Array(MAX_THERAPISTS).fill(null))
      const [ locked, setLocked ] = useState<boolean[]>(() => Array(MAX_THERAPISTS).fill(false))
      const assignedIds = assigned.flatMap((t) => t ? [t.id] : []);

      // El fondo se oscurece cuando hay al menos un terapeuta fijado; los títulos se aclaran para no perderse
      const dimmed = assigned.some((t, i) => t && locked[i]);
      // "Asignar Terapeutas" solo se ofrece cuando todos los terapeutas puestos están fijados
      const allLocked = assignedIds.length > 0 && assigned.every((t, i) => !t || locked[i]);      const headingClass = `h-5 text-xs font-medium uppercase tracking-widest transition-colors duration-500 ${dimmed ? "text-white/80" : "text-ink-500"}`;

      const emptyAssigned = () => Array<PickedTherapist | null>(MAX_THERAPISTS).fill(null);
      const emptyLocked = () => Array<boolean>(MAX_THERAPISTS).fill(false);

      // Reinicia todo lo puesto en terapeutas: asignaciones, fijados y slots adicionales
      const resetTherapists = () => {
            setAssigned(emptyAssigned());
            setLocked(emptyLocked());
            setSlotCount(1);
      };

      // El primer slot solo se vacía; los adicionales se eliminan (los siguientes suben una posición)
      const removeTherapist = (i: number) => {
            if (i === 0) {
                  setAssigned((prev) => prev.map((t, j) => j === 0 ? null : t));
                  setLocked((prev) => prev.map((l, j) => j === 0 ? false : l));
                  return;
            }
            setAssigned((prev) => [...prev.filter((_, j) => j !== i), null]);
            setLocked((prev) => [...prev.filter((_, j) => j !== i), false]);
            setSlotCount((n) => Math.max(1, n - 1));
      };

      const [ toast, setToast ] = useState<{ text: string } | null>(null)
      useEffect(() => {
            if (!toast) return;
            const t = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(t);
      }, [toast]);

      // coordination.json = coordinaciones vigentes; opt_coordination.json = el óptimo calculado una sola vez para todos
      const coordination = useDataFile<CoordinationMap>("coordination", {});
      const [ busy, setBusy ] = useState(false);

      /** Pone en los slots los terapeutas de una entrada del mapa. */
      const fillSlots = (ids: string[]) => {
            const picks = ids.flatMap((id) => pickedTherapistsById.get(id) ?? []).slice(0, MAX_THERAPISTS);
            setAssigned([...picks, ...emptyAssigned().slice(picks.length)]);
            setLocked(emptyLocked());
            setSlotCount(Math.max(1, picks.length));
            return picks.length;
      };

      // Al elegir un paciente se muestran sus terapeutas ya coordinados (coordination.json)
      const pickPatient = (p: PickedPatient) => {
            setPatient(p);
            fillSlots(therapistIdsOf(coordination.data[p.id]));
      };

      // Asignar Terapeutas: una vez fijados todos, se guardan en coordination.json
      const assignTherapists = async () => {
            if (!patient) return setToast({ text: "Selecciona un paciente para asignarle los terapeutas" });
            const ids = assignedIds;
            const next: CoordinationMap = { ...coordination.data, [patient.id]: ids.length === 1 ? ids[0] : ids };
            try {
                  await coordination.save(next);
                  // Objeto nuevo en cada clic: reinicia el temporizador aunque el texto sea el mismo
                  setToast({ text: `${ids.length === 1 ? "Terapeuta asignado" : `${ids.length} terapeutas asignados`} a ${patient.fullName}` });
            } catch (e) {
                  setToast({ text: `No se pudo guardar: ${e instanceof Error ? e.message : e}` });
            }
      };

      /**
       * Asignar Automáticamente. El óptimo de TODOS los pacientes se calcula una sola vez (Coordinator) y queda en
       * opt_coordination.json; luego se baja a coordination.json (la verdad):
       *  - "Todos": coordination.json pasa a ser el óptimo completo.
       *  - "Uno": solo cambia la entrada del paciente elegido.
       */
      const autoAssign = async (scope: AutoFillScope) => {
            if (busy || (scope === "one" && !patient)) return;
            setBusy(true);
            try {
                  let opt = await readDataFile<CoordinationMap>("opt_coordination");
                  if (Object.keys(opt).length === 0) {
                        setToast({ text: "Calculando la coordinación óptima de todos los pacientes…" });
                        await new Promise((r) => setTimeout(r, 30)); // deja pintar el aviso antes del cálculo
                        opt = toCoordinationMap(new Coordinator(Patients, Therapists).coordinate());
                        await writeDataFile("opt_coordination", opt);
                  }

                  let next: CoordinationMap;
                  if (scope === "all") next = { ...opt };
                  else {
                        next = { ...(await readDataFile<CoordinationMap>("coordination")) };
                        if (patient!.id in opt) next[patient!.id] = opt[patient!.id];
                        else delete next[patient!.id];
                  }
                  await coordination.save(next);

                  // El paciente elegido queda mostrando su coordinación vigente
                  const n = patient ? fillSlots(therapistIdsOf(next[patient.id])) : 0;
                  setToast({ text: scope === "all" ? "Coordinación óptima aplicada a todos los pacientes"
                        : n === 0 ? `No hay terapeutas compatibles con ${patient!.fullName}`
                        : `${n === 1 ? "Terapeuta asignado" : `${n} terapeutas asignados`} a ${patient!.fullName}` });
            } catch (e) {
                  setToast({ text: `No se pudo coordinar: ${e instanceof Error ? e.message : e}` });
            } finally {
                  setBusy(false);
            }
      };

      const changeCity = (city: City) => {
            setActiveCity(city);
            // paciente y terapeutas pertenecen a la ciudad seleccionada
            setPatient(null);
            setAssigned(Array(MAX_THERAPISTS).fill(null));
            setLocked(Array(MAX_THERAPISTS).fill(false));
      };

      // Curvas desde el borde derecho del paciente hasta el borde izquierdo de cada slot de terapeuta
      useLayoutEffect(() => {
            const box = boxRef.current;
            const from = patientRef.current;
            if (!box || !from) return;

            const update = () => {
                  const b = box.getBoundingClientRect();
                  const f = from.getBoundingClientRect();
                  // El origen es la fila superior del paciente (botón o cabecera de la mini card), a 28px del tope
                  const x1 = f.right - b.left + ORIGIN_GAP;
                  const y1 = f.top - b.top + ROW_HEIGHT / 2;
                  setOrigin({ x: x1, y: y1 });

                  const slots = slotRefs.current.slice(0, slotCount).flatMap((slot) => slot ? [slot.getBoundingClientRect()] : []);
                  if (slots.length === 0) return setPaths([]);
                  setPaths(splitterPaths(
                        x1, y1,
                        slots[0].left - b.left,
                        slots.map((s) => s.top + s.height / 2 - b.top)
                  ));
            };

            update();
            const observer = new ResizeObserver(update);
            observer.observe(box);
            observer.observe(from);
            slotRefs.current.forEach((s) => s && observer.observe(s));
            return () => observer.disconnect();
      }, [slotCount]);

      return (
            <div className="w-full h-full flex flex-col py-8.5 gap-6">
                  <div
                        aria-hidden
                        className={`fixed inset-0 z-20 bg-black/40 pointer-events-none transition-opacity duration-500 ${dimmed ? "opacity-100" : "opacity-0"}`}
                  />

                  {toast && (
                        <div
                              role="status"
                              className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full text-sm shadow-xl bg-ink-900 text-neutral-50 animate-[toast-in_250ms_ease-out]"
                        >
                              <Check size={16} />
                              {toast.text}
                        </div>
                  )}

                  <div className="fixed bottom-8 right-8 z-30 flex flex-col items-end gap-3">
                        {allLocked && (
                              <div className="animate-[patient-in_200ms_ease-out]">
                                    <AppButton variant="primary" icon={UserCheck} iconSize={20} text="Asignar Terapeutas" className="shadow-xl" onClick={assignTherapists} />
                              </div>
                        )}
                  </div>
                  <div className="@container flex flex-wrap gap-2 items-center">
                        <AppButton variant={activeCity === "CTG"   ? "primary" : "secondary"} text="CTG"  onClick={() => changeCity("CTG")}/>
                        <AppButton variant={activeCity === "STM" ? "primary" : "secondary"} text="STM" onClick={() => changeCity("STM")}/>
                        <AppButton variant={activeCity === "NVA" ? "primary" : "secondary"} text="NVA" onClick={() => changeCity("NVA")}/>

                        <div className="ml-auto">
                              <AutoFillButton
                                    icon={Sparkles} text={busy ? "Calculando…" : "Asignar Automáticamente"} textClassName="@max-xl:hidden"
                                    oneLabel={patient ? `Solo ${patient.fullName}` : null}
                                    allLabel="Todos los pacientes"
                                    oneWarning={`Reemplazará la coordinación actual de ${patient?.fullName ?? "este paciente"} en coordination.json por la óptima.`}
                                    allWarning="Reemplazará TODAS las coordinaciones de coordination.json por las óptimas, incluidas las que ya fijaste a mano."
                                    busy={busy} onConfirm={autoAssign}
                              />
                        </div>
                  </div>

                  <div ref={boxRef} className="relative flex justify-center items-start gap-[10vw] pr-[6dvw] pt-[5dvh]">
                        <svg className="absolute inset-0 z-30 w-full h-full overflow-visible pointer-events-none text-ink-300" aria-hidden>
                              {paths.map((d, i) => (
                                    <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray="2 7" />
                              ))}
                              {origin && paths.length > 0 && <circle cx={origin.x} cy={origin.y} r={4} fill="currentColor" />}
                        </svg>

                        {/* Columnas de ancho fijo: elegir un paciente no desplaza a los terapeutas */}
                        <div className="relative z-30 w-96 shrink-0 flex flex-col gap-4">
                              <h2 className={headingClass}>Paciente</h2>
                              {/* w-fit: el wrapper abraza al botón/mini card, así el origen queda pegado a su borde derecho */}
                              <div ref={patientRef} className="w-fit">
                                    <PatientPicker city={activeCity} value={patient} onChange={pickPatient} />
                              </div>
                        </div>

                        <div className="relative z-30 w-64 shrink-0 flex flex-col gap-4">
                              <div className="h-5 flex items-center justify-between">
                                    <h2 className={headingClass}>
                                          Terapeutas <span className="opacity-60">{slotCount}/{MAX_THERAPISTS}</span>
                                    </h2>
                                    <AppButton
                                          variant="tertiary" icon={RotateCw} iconSize={14} tooltip="Reiniciar terapeutas"
                                          className={`p-1! transition-colors ${dimmed ? "text-white/80! hover:text-white!" : ""}`} onClick={resetTherapists}
                                    />
                              </div>
                              {Array.from({ length: slotCount }, (_, i) => (
                                    <div
                                          key={i}
                                          ref={(el) => { slotRefs.current[i] = el; }}
                                          style={{ minHeight: ROW_HEIGHT }}
                                          className="flex items-center animate-[patient-in_200ms_ease-out]"
                                    >
                                          <TherapistPicker
                                                city={activeCity}
                                                value={assigned[i]}
                                                excludeIds={assignedIds.filter((id) => id !== assigned[i]?.id)}
                                                locked={locked[i]}
                                                onRemove={() => removeTherapist(i)}
                                                onToggleLock={() => setLocked((prev) => prev.map((x, j) => j === i ? !x : x))}
                                                onChange={(t) => setAssigned((prev) => prev.map((x, j) => j === i ? t : x))}
                                          />
                                    </div>
                              ))}

                              {slotCount < MAX_THERAPISTS && (
                                    <div style={{ minHeight: ROW_HEIGHT }} className="flex items-center">
                                          <AppButton
                                                variant="ghost" icon={Plus} iconSize={24} className="w-full"
                                                onClick={() => setSlotCount((n) => Math.min(MAX_THERAPISTS, n + 1))}
                                          />
                                    </div>
                              )}
                        </div>
                  </div>
            </div>
      )
}
