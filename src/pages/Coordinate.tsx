import AppButton from "@/components/ui/AppButton"
import PatientPicker, { PickedPatient } from "@/components/coordinate/PatientPicker";
import { City } from "@/types/shared";
import { Plus, UserPlus } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

const MAX_THERAPISTS = 4;
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

      const changeCity = (city: City) => {
            setActiveCity(city);
            setPatient(null); // el paciente pertenece a la ciudad seleccionada
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
                  <div className="@container flex flex-wrap gap-2 items-center">
                        <AppButton variant={activeCity === "CTG"   ? "primary" : "secondary"} text="CTG"  onClick={() => changeCity("CTG")}/>
                        <AppButton variant={activeCity === "STM" ? "primary" : "secondary"} text="STM" onClick={() => changeCity("STM")}/>
                        <AppButton variant={activeCity === "NVA" ? "primary" : "secondary"} text="NVA" onClick={() => changeCity("NVA")}/>
                  </div>

                  <div ref={boxRef} className="relative flex justify-center items-start gap-[10vw] pr-[6dvw] pt-[5dvh]">
                        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none text-ink-300" aria-hidden>
                              {paths.map((d, i) => (
                                    <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray="2 7" />
                              ))}
                              {origin && paths.length > 0 && <circle cx={origin.x} cy={origin.y} r={4} fill="currentColor" />}
                        </svg>

                        {/* Columnas de ancho fijo: elegir un paciente no desplaza a los terapeutas */}
                        <div className="relative z-10 w-96 shrink-0 flex flex-col gap-4">
                              <h2 className="h-5 text-xs font-medium uppercase tracking-widest text-ink-500">Paciente</h2>
                              {/* w-fit: el wrapper abraza al botón/mini card, así el origen queda pegado a su borde derecho */}
                              <div ref={patientRef} className="w-fit">
                                    <PatientPicker city={activeCity} value={patient} onChange={setPatient} />
                              </div>
                        </div>

                        <div className="relative z-10 w-64 shrink-0 flex flex-col gap-4">
                              <h2 className="h-5 text-xs font-medium uppercase tracking-widest text-ink-500">
                                    Terapeutas <span className="text-ink-400">{slotCount}/{MAX_THERAPISTS}</span>
                              </h2>
                              {Array.from({ length: slotCount }, (_, i) => (
                                    <div
                                          key={i}
                                          ref={(el) => { slotRefs.current[i] = el; }}
                                          style={{ minHeight: ROW_HEIGHT }}
                                          className="flex items-center animate-[patient-in_200ms_ease-out]"
                                    >
                                          <AppButton text="Seleccionar Terapeuta" icon={UserPlus} iconSize={20} className="rounded-xl" />
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
