import { useMemo, useRef, useState } from "react";
import { User } from "lucide-react";
import AppButton from "../ui/AppButton";
import AreaBadge from "../ui/AreaBadge";
import PersonAvatar from "../people/PersonAvatar";
import PersonDropdown from "./PersonDropdown";
import { Area, City } from "@/types/shared";
import { Patients } from "@data/data";
import { toTitleCase } from "@/utils/toTitleCase";
import { useDismiss } from "@/hooks/useDismiss";

const patients = Patients.map((p) => ({
      id: p.id,
      fullName: toTitleCase(p.name),
      city: p.city,
      authorizations: p.sessionsRequirements,
}));
export type PickedPatient = (typeof patients)[number];

type PatientPickerProps = {
      city: City
      value: PickedPatient | null
      onChange: (patient: PickedPatient) => void
}

/** Botón de paciente: al hacer clic abre un buscador (filtrado por ciudad); al elegir uno se expande a una mini card. */
export default function PatientPicker({ city, value, onChange }: PatientPickerProps) {
      const [open, setOpen] = useState(false);
      const ref = useRef<HTMLDivElement>(null);
      useDismiss(ref, open, () => setOpen(false));

      const inCity = useMemo(() => patients.filter((p) => p.city === city), [city]);

      return (
            <div ref={ref} className="relative">
                  {value ? (
                        <button
                              type="button"
                              onClick={() => setOpen((o) => !o)}
                              className="w-96 text-left cursor-pointer bg-paper rounded-xl shadow-md p-3 flex flex-col gap-3 animate-[patient-in_200ms_ease-out]"
                        >
                              <div className="flex items-center gap-2 min-w-0">
                                    <PersonAvatar fullName={value.fullName} className="w-8 h-8 text-xs" />
                                    <span className="font-display font-medium text-ink-950 truncate">{value.fullName}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                    {(Object.keys(value.authorizations ?? {}) as Area[]).map((area) => {
                                          const n = value.authorizations?.[area];
                                          return n !== undefined && <AreaBadge key={area} area={area} value={n} showLabel />;
                                    })}
                              </div>
                        </button>
                  ) : (
                        <AppButton variant="icon-only" icon={User} tooltip="Seleccionar paciente" active={open} onClick={() => setOpen((o) => !o)} />
                  )}

                  {open && (
                        <PersonDropdown
                              people={inCity}
                              placeholder={`Buscar paciente en ${city}`}
                              onSelect={(p) => { onChange(p); setOpen(false); }}
                        />
                  )}
            </div>
      );
}
