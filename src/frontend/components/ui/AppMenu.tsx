import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import AppButton, { AppButtonProps } from "./AppButton";

export type AppMenuOption<T extends string> = { value: T, label: string };

type AppMenuProps<T extends string> = Omit<AppButtonProps, "onClick" | "active"> & {
      options: AppMenuOption<T>[]
      value: T
      onSelect: (value: T) => void
      /** Resalta el botón cuando hay una opción distinta a la de reposo seleccionada */
      active?: boolean
      /** Lado del botón al que se alinea el menú */
      align?: "left" | "right"
};

export default function AppMenu<T extends string>({ options, value, onSelect, active, align = "left", ...buttonProps }: AppMenuProps<T>) {
      const [open, setOpen] = useState(false);
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

      return (
            <div ref={ref} className="relative">
                  <AppButton {...buttonProps} active={active || open} onClick={() => setOpen((o) => !o)} />
                  {open && (
                        <ul role="menu" className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-2 z-40 min-w-40 bg-paper text-ink-700 rounded-xl shadow-xl py-1 text-sm`}>
                              {options.map((o) => (
                                    <li key={o.value} role="menuitemradio" aria-checked={o.value === value}>
                                          <button
                                                type="button"
                                                onClick={() => { onSelect(o.value); setOpen(false); }}
                                                className="w-full flex items-center justify-between gap-4 px-4 py-2 text-left whitespace-nowrap cursor-pointer hover:bg-ink-200"
                                          >
                                                {o.label}
                                                {o.value === value && <Check size={14} />}
                                          </button>
                                    </li>
                              ))}
                        </ul>
                  )}
            </div>
      );
}
