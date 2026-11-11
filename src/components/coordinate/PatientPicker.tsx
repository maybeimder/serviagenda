import { useEffect, useMemo, useRef, useState } from "react";
import { Search, User } from "lucide-react";
import AppButton from "../ui/AppButton";
import AreaBadge from "../ui/AreaBadge";
import PersonAvatar from "../people/PersonAvatar";
import { Area, City } from "@/types/shared";
import { Patients } from "@/data/data";
import { toTitleCase } from "@/utils/toTitleCase";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MAX_RESULTS = 50;

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
      const [query, setQuery] = useState("");
      const ref = useRef<HTMLDivElement>(null);

      useEffect(() => {
            if (!open) return;
            const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
            const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
            document.addEventListener("mousedown", close);
            document.addEventListener("keydown", esc);
            return () => {
                  document.removeEventListener("mousedown", close);
                  document.removeEventListener("keydown", esc);
            };
      }, [open]);

      const results = useMemo(() => {
            const q = normalize(query.trim());
            return patients
                  .filter((p) => p.city === city && (!q || normalize(p.fullName).includes(q)))
                  .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"))
                  .slice(0, MAX_RESULTS);
      }, [city, query]);

      const toggle = () => { setOpen((o) => !o); setQuery(""); };

      return (
            <div ref={ref} className="relative">
                  {value ? (
                        <button
                              type="button"
                              onClick={toggle}
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
                        <AppButton variant="icon-only" icon={User} tooltip="Seleccionar paciente" active={open} onClick={toggle} />
                  )}

                  {open && (
                        <div className="absolute left-0 top-full mt-2 z-30 w-72 bg-paper rounded-xl shadow-xl p-2 flex flex-col gap-2">
                              <div className="bg-neutral-50 rounded-lg flex items-center gap-2 px-3 h-9">
                                    <Search size={16} className="text-ink-500 shrink-0" />
                                    <input
                                          autoFocus
                                          value={query}
                                          onChange={(e) => setQuery(e.target.value)}
                                          placeholder={`Buscar paciente en ${city}`}
                                          className="outline-none w-full text-sm bg-transparent"
                                    />
                              </div>
                              <ul className="max-h-64 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#a3a3a3_transparent]">
                                    {results.length === 0 && <li className="px-3 py-2 text-sm text-ink-500">Sin resultados</li>}
                                    {results.map((p) => (
                                          <li key={p.id}>
                                                <button
                                                      type="button"
                                                      onClick={() => { onChange(p); setOpen(false); }}
                                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm cursor-pointer hover:bg-ink-200"
                                                >
                                                      <PersonAvatar fullName={p.fullName} className="w-6 h-6 text-[10px]" />
                                                      <span className="truncate">{p.fullName}</span>
                                                </button>
                                          </li>
                                    ))}
                              </ul>
                        </div>
                  )}
            </div>
      );
}
