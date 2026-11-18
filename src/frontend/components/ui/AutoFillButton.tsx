import { useRef, useState } from "react";
import { TriangleAlert, LucideIcon } from "lucide-react";
import AppButton from "./AppButton";
import { useDismiss } from "@/hooks/useDismiss";

export type AutoFillScope = "one" | "all";

type AutoFillButtonProps = {
      icon: LucideIcon
      text: string
      textClassName?: string
      /** Etiqueta de "solo uno" (p. ej. el nombre del paciente); null si no hay nadie elegido y esa opción no aplica */
      oneLabel: string | null
      allLabel: string
      /** Aviso de lo que se sobrescribe en cada caso */
      oneWarning: string
      allWarning: string
      busy?: boolean
      onConfirm: (scope: AutoFillScope) => void
}

/**
 * Botón que no ejecuta directo: abre un panel para elegir si rellenar solo a una persona o a todas, avisando
 * lo que se va a sobrescribir, y pide confirmación.
 */
export default function AutoFillButton({ icon, text, textClassName, oneLabel, allLabel, oneWarning, allWarning, busy, onConfirm }: AutoFillButtonProps) {
      const [open, setOpen] = useState(false);
      const [scope, setScope] = useState<AutoFillScope>("one");
      const ref = useRef<HTMLDivElement>(null);
      useDismiss(ref, open, () => setOpen(false));

      const effective: AutoFillScope = oneLabel === null ? "all" : scope;
      const options: { value: AutoFillScope, label: string | null }[] = [
            { value: "one", label: oneLabel },
            { value: "all", label: allLabel },
      ];

      return (
            <div ref={ref} className="relative">
                  <AppButton
                        variant="secondary" icon={icon} iconSize={20} text={text} textClassName={textClassName}
                        loading={busy} active={open} onClick={() => !busy && setOpen((o) => !o)}
                  />

                  {open && (
                        <div role="dialog" aria-label={text} className="absolute right-0 top-full mt-2 z-40 w-80 rounded-xl bg-paper text-ink-700 shadow-xl p-3 flex flex-col gap-3 text-sm animate-[patient-in_150ms_ease-out]">
                              <p className="font-medium text-ink-950">{text}</p>

                              <div role="radiogroup" className="flex flex-col gap-1">
                                    {options.map(({ value, label }) => (
                                          <button
                                                key={value}
                                                type="button"
                                                role="radio"
                                                aria-checked={effective === value}
                                                disabled={label === null}
                                                onClick={() => setScope(value)}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left cursor-pointer hover:bg-ink-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                          >
                                                <span className={`size-4 shrink-0 rounded-full border-2 flex items-center justify-center ${effective === value ? "border-ink-900" : "border-ink-400"}`}>
                                                      {effective === value && <span className="size-2 rounded-full bg-ink-900" />}
                                                </span>
                                                <span className="truncate">{label ?? "Solo uno (elige primero a alguien)"}</span>
                                          </button>
                                    ))}
                              </div>

                              <p className="flex gap-2 rounded-lg bg-amber-400/15 text-amber-700 dark:text-amber-300 px-3 py-2 text-xs">
                                    <TriangleAlert size={14} className="shrink-0 mt-px" />
                                    {effective === "one" ? oneWarning : allWarning}
                              </p>

                              <div className="flex justify-end gap-2">
                                    <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs cursor-pointer hover:bg-ink-200">
                                          Cancelar
                                    </button>
                                    <button
                                          type="button"
                                          onClick={() => { setOpen(false); onConfirm(effective); }}
                                          className="rounded-lg bg-ink-900 text-neutral-50 px-3 py-1.5 text-xs cursor-pointer"
                                    >
                                          Sobrescribir
                                    </button>
                              </div>
                        </div>
                  )}
            </div>
      );
}
