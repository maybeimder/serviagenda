import { useLayoutEffect, useRef, useState } from "react";
import { Stethoscope } from "lucide-react";
import { Session } from "@core/types/dtos";
import { AREA_ICON_BY_CODE, AREA_LABEL } from "@/components/ui/AreaBadge";
import { toTitleCase } from "@/utils/toTitleCase";
import { placeAbove } from "@/utils/placement";

/** Tooltip de una sesión cruzada: cada paciente con el ícono de su área, en el color del área. */
export default function SessionTooltip({ session, anchor }: { session: Session, anchor: DOMRect }) {
      const ref = useRef<HTMLDivElement>(null);
      const [pos, setPos] = useState<{ left: number, top: number } | null>(null);

      // Se mide antes de pintar para colocarlo donde cabe (arriba de la sesión, o debajo)
      useLayoutEffect(() => {
            // offsetWidth/Height: no incluyen la escala de la animación de entrada
            setPos(placeAbove(anchor, ref.current!.offsetWidth, ref.current!.offsetHeight));
      }, [anchor]);

      return (
            <div
                  ref={ref}
                  role="tooltip"
                  style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
                  className="fixed z-50 pointer-events-none rounded-lg bg-ink-900 text-neutral-50 shadow-xl px-3 py-2 text-xs animate-[patient-in_120ms_ease-out]"
            >
                  <p className="text-[10px] uppercase tracking-wider opacity-60">Cruzada · {session.patient.length} pacientes</p>
                  <p className="mt-1 mb-2 flex items-center gap-2 whitespace-nowrap font-medium">
                        <Stethoscope size={13} className="shrink-0 opacity-70" aria-label="Terapeuta" />
                        <span>{toTitleCase(session.therapist.name)}</span>
                  </p>
                  <ul className="flex flex-col gap-1.5">
                        {session.patient.map((p) => {
                              const area = session.areaPerPatient[p.id];
                              const { icon: Icon, color } = AREA_ICON_BY_CODE[area];
                              return (
                                    <li key={p.id} className="flex items-center gap-2 whitespace-nowrap">
                                          <Icon size={13} color={color} className="shrink-0" aria-label={AREA_LABEL[area]} />
                                          <span>{toTitleCase(p.name)}</span>
                                    </li>
                              );
                        })}
                  </ul>
            </div>
      );
}
