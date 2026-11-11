import { LucideIcon } from "lucide-react";

type AppButtonVariant = "primary" | "secondary" | "ghost" | "icon-only";

export type AppButtonProps = {
      variant?: AppButtonVariant;
      icon?: LucideIcon;
      text?: string;
      tooltip?: string;
      active?: boolean;
      className?: string
      iconSize?: number

      onClick?: () => void ;
};

const variantMap: Record<AppButtonVariant, string> = {
      primary     : "bg-ink-900 text-neutral-50 rounded-3xl font-normal hover:bg-ink-800 px-5 font-sans tracking-wide",
      secondary   : "bg-[#FFF] text-ink-700 rounded-3xl font-normal hover:bg-ink-200 px-5 font-sans tracking-wide",
      "icon-only" : "rounded-3xl bg-[#FFF] text-ink-700 hover:bg-ink-950 hover:text-ink-50 shadow-xl",
      ghost       : "bg-transparent text-amber-600 hover:bg-amber-100",
};

export default function AppButton(props: AppButtonProps) {
      return (
            <div className="relative inline-block group">
                  <button
                        type="button"
                        onClick={props.onClick}
                        aria-label={props.variant === "icon-only" ?  props.tooltip : undefined}
                        className={`font-medium transition-colors p-3 flex shadow-sm items-center cursor-pointer justify-center gap-3 leading-none ${props.active ? "bg-ink-950! text-ink-50!" : ""} ${variantMap[props.variant ?? "secondary"]} ${props.className ?? ""}`}
                  >
                        {props.icon && <props.icon size={props.iconSize ?? 32} strokeWidth={1.5} className="shrink-0" />}
                        {props.variant !== "icon-only" && props.text && <span>{props.text}</span>}
                  </button>

                  {props.tooltip && (
                        <div
                              role="tooltip"
                              className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 w-max max-w-xs
                                         bg-ink-900 text-white text-sm font-normal font-sans rounded-md shadow-lg
                                         opacity-0 invisible -translate-x-1 pointer-events-none
                                         transition-all duration-200 ease-out
                                         group-hover:opacity-100 group-hover:visible group-hover:translate-x-0
                                         group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-x-0 z-10"

                            >
                                  { props.tooltip }
                                  <div  className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-ink-900" />
                            </div>
                  )}
            </div>
      );
}
