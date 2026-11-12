import { useRef, useState } from "react";
import { User } from "lucide-react";
import PersonDropdown, { DropdownPerson, PersonMiniRow } from "./PersonDropdown";
import { useDismiss } from "@/hooks/useDismiss";

type PersonSelectProps<T extends DropdownPerson> = {
      people: T[]
      value: T | null
      onChange: (person: T) => void
      /** Texto mientras no hay nadie elegido */
      placeholder: string
      /** Habilita el mini botón para filtrar por ciudad dentro del dropdown */
      cityFilter?: boolean
      /** Clases extra para el botón (la fila de la persona elegida o el placeholder) */
      triggerClassName?: string
}

/** Fila de persona que funciona como botón: al hacer clic abre el dropdown de personas. */
export default function PersonSelect<T extends DropdownPerson>({ people, value, onChange, placeholder, cityFilter, triggerClassName = "" }: PersonSelectProps<T>) {
      const [open, setOpen] = useState(false);
      const ref = useRef<HTMLDivElement>(null);
      useDismiss(ref, open, () => setOpen(false));

      return (
            <div ref={ref} className="relative w-full">
                  {value ? (
                        <PersonMiniRow p={value} onClick={() => setOpen((o) => !o)} className={triggerClassName} />
                  ) : (
                        <button
                              type="button"
                              onClick={() => setOpen((o) => !o)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm text-ink-500 cursor-pointer hover:bg-ink-200 ${triggerClassName}`}
                        >
                              <span className="w-6 h-6 shrink-0 rounded-full bg-ink-200 flex items-center justify-center">
                                    <User size={14} />
                              </span>
                              <span className="truncate">{placeholder}</span>
                        </button>
                  )}

                  {open && (
                        <PersonDropdown
                              people={people}
                              placeholder="Buscar..."
                              cityFilter={cityFilter}
                              className="w-full min-w-64"
                              onSelect={(p) => { onChange(p); setOpen(false); }}
                        />
                  )}
            </div>
      );
}
