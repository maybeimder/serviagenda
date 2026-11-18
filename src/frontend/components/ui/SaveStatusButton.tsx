import { Check, LucideIcon } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved";

type Props = {
      state: SaveState
      icon: LucideIcon
      idleText: string
      savingText: string
      savedText: string
      onClick: () => void
}

/**
 * Botón de confirmación con tres momentos: listo para guardar, guardando (barra de brillo que lo cruza y tres puntos
 * que ondulan) y guardado (se vuelve verde y el check aparece con un rebote). Mantiene el mismo ancho en los tres
 * para que no salte.
 */
export default function SaveStatusButton({ state, icon: Icon, idleText, savingText, savedText, onClick }: Props) {
      const saving = state === "saving", saved = state === "saved";

      return (
            <button
                  type="button"
                  onClick={state === "idle" ? onClick : undefined}
                  aria-live="polite"
                  aria-busy={saving}
                  className={`relative overflow-hidden min-w-56 h-12 px-5 rounded-3xl flex items-center justify-center gap-3 font-sans tracking-wide shadow-xl transition-[background-color,box-shadow,transform] duration-500
                        ${saved ? "bg-emerald-500 text-white shadow-emerald-500/40 scale-[1.03]" : "bg-ink-900 text-neutral-50 hover:bg-ink-800"}
                        ${state === "idle" ? "cursor-pointer" : "cursor-default"}`}
            >
                  {/* brillo que cruza el botón mientras guarda */}
                  {saving && <span aria-hidden className="absolute inset-0 -translate-x-full animate-[shimmer_1.2s_ease-in-out_infinite] bg-linear-to-r from-transparent via-white/25 to-transparent" />}
                  {/* barra de progreso indeterminada en el borde inferior */}
                  {saving && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15 overflow-hidden"><span className="block h-full w-1/3 bg-white/80 animate-[sweep_1s_ease-in-out_infinite]" /></span>}

                  {saved ? <Check key="saved" size={22} strokeWidth={2.25} className="shrink-0 animate-[pop_350ms_ease-out]" />
                        : saving ? (
                              <span aria-hidden className="flex items-center gap-1 shrink-0">
                                    {[0, 1, 2].map((i) => (
                                          <span key={i} style={{ animationDelay: `${i * 140}ms` }} className="size-1.5 rounded-full bg-current animate-[dot-wave_1s_ease-in-out_infinite]" />
                                    ))}
                              </span>
                        ) : <Icon size={22} strokeWidth={1.5} className="shrink-0" />}

                  <span className="relative whitespace-nowrap">{saved ? savedText : saving ? savingText : idleText}</span>
            </button>
      );
}
