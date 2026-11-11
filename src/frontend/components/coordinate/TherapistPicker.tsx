import { useMemo, useRef, useState } from "react";
import { Lock, LockOpen, UserPlus, X } from "lucide-react";
import AppButton from "../ui/AppButton";
import PersonAvatar from "../people/PersonAvatar";
import PersonDropdown from "./PersonDropdown";
import { City } from "@/types/shared";
import { Therapists } from "@data/data";
import { toTitleCase } from "@/utils/toTitleCase";
import { useDismiss } from "@/hooks/useDismiss";

const therapists = Therapists.map((t) => ({
      id: t.id,
      fullName: toTitleCase(t.name),
      city: t.city,
}));
export type PickedTherapist = (typeof therapists)[number];
export const pickedTherapistsById = new Map(therapists.map((t) => [t.id, t]));

type TherapistPickerProps = {
      city: City
      value: PickedTherapist | null
      /** Terapeutas ya asignados en otros slots, para no repetirlos */
      excludeIds: string[]
      /** Un terapeuta fijado no se puede cambiar hasta que se desfije */
      locked: boolean
      onToggleLock: () => void
      onRemove: () => void
      onChange: (therapist: PickedTherapist) => void
}

/** Slot de terapeuta: botón "Seleccionar Terapeuta" que abre un buscador por ciudad; al elegir queda como chip con avatar y nombre. */
export default function TherapistPicker({ city, value, excludeIds, locked, onToggleLock, onRemove, onChange }: TherapistPickerProps) {
      const [open, setOpen] = useState(false);
      const ref = useRef<HTMLDivElement>(null);
      useDismiss(ref, open, () => setOpen(false));

      const available = useMemo(
            () => therapists.filter((t) => t.city === city && !excludeIds.includes(t.id)),
            [city, excludeIds]
      );

      return (
            <div ref={ref} className="relative group/chip">
                  {value ? (
                        <>
                              <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() => setOpen((o) => !o)}
                                    className={`w-64 h-14 flex items-center gap-3 px-3 text-left bg-paper rounded-xl shadow-md border transition-colors animate-[patient-in_200ms_ease-out]
                                          ${locked ? "border-ink-400 cursor-default" : "border-transparent cursor-pointer"}`}
                              >
                                    <PersonAvatar fullName={value.fullName} className="w-8 h-8 text-xs" />
                                    <span className="font-display font-medium text-ink-950 truncate pr-6">{value.fullName}</span>
                              </button>

                              {/* Quitar: botón hermano del chip (no anidado). Un terapeuta fijado no se puede quitar. */}
                              {!locked && (
                                    <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover/chip:opacity-100 focus-within:opacity-100">
                                          <AppButton
                                                variant="tertiary" icon={X} iconSize={14} tooltip="Quitar terapeuta"
                                                className="p-1!" onClick={() => { setOpen(false); onRemove(); }}
                                          />
                                    </div>
                              )}

                              {/* Pill pegado a la esquina inferior derecha del chip: fija / desfija al terapeuta */}
                              <button
                                    type="button"
                                    aria-label={locked ? "Desfijar terapeuta" : "Fijar terapeuta"}
                                    aria-pressed={locked}
                                    onClick={() => { setOpen(false); onToggleLock(); }}
                                    className={`absolute -bottom-2 -right-2 rounded-full p-1.5 shadow-md cursor-pointer transition-colors
                                          ${locked ? "bg-ink-950 text-ink-50" : "bg-paper text-ink-700 hover:bg-ink-200"}`}
                              >
                                    {locked ? <Lock size={14} strokeWidth={1.75} /> : <LockOpen size={14} strokeWidth={1.75} />}
                              </button>
                        </>
                  ) : (
                        <AppButton
                              text="Seleccionar Terapeuta" icon={UserPlus} iconSize={20} className="rounded-xl"
                              active={open} onClick={() => setOpen((o) => !o)}
                        />
                  )}

                  {open && (
                        <PersonDropdown
                              people={available}
                              placeholder={`Buscar terapeuta en ${city}`}
                              className="w-64"
                              onSelect={(t) => { onChange(t); setOpen(false); }}
                        />
                  )}
            </div>
      );
}
