import { LucideIcon } from "lucide-react";

type AppButtonVariant = "primary" | "secondary" | "ghost" | "icon-only";

export type AppButtonProps = {
      variant?: AppButtonVariant;
      icon?: LucideIcon;
      text?: string;
      tooltip?: string;
      tooltipSide?: "right" | "left";
      active?: boolean;
      className?: string
      iconSize?: number
      textClassName?: string

      onClick?: () => void ;
};

const variantMap: Record<AppButtonVariant, string> = {
      primary     : "shadow-sm bg-ink-900 text-neutral-50 rounded-3xl font-normal hover:bg-ink-800 px-5 font-sans tracking-wide",
      secondary   : "shadow-sm bg-paper text-ink-700 rounded-3xl font-normal hover:bg-ink-200 px-5 font-sans tracking-wide",
      "icon-only" : "shadow-sm rounded-3xl bg-paper text-ink-700 hover:bg-ink-950 hover:text-ink-50 shadow-xl",
      ghost       : "bg-transparent text-ink-500 hover:bg-ink-800/10 rounded-full inset-shadow-sm inset-shadow-ink-200 shadow-md shadow-neutral-50",
};

export default function AppButton(props: AppButtonProps) {
      const left = props.tooltipSide === "left";
      return (
            <div className="relative inline-block group">
                  <button
                        type="button"
                        onClick={props.onClick}
                        aria-label={props.variant === "icon-only" ?  props.tooltip : props.text}
                        className={`font-medium transition-colors p-3 flex items-center cursor-pointer justify-center gap-3 leading-none ${props.active ? "bg-ink-950! text-ink-50!" : ""} ${variantMap[props.variant ?? "secondary"]} ${props.className ?? ""}`}
                  >
                        {props.icon && <props.icon size={props.iconSize ?? 32} strokeWidth={1.5} className="shrink-0" />}
                        {props.variant !== "icon-only" && props.text && <span className={`whitespace-nowrap ${props.textClassName ?? ""}`}>{props.text}</span>}
                  </button>

                  {props.tooltip && (
                        <div
                              role="tooltip"
                              className={`absolute top-1/2 -translate-y-1/2 px-3 py-1.5 w-max max-w-xs
                                         bg-ink-900 text-neutral-50 text-sm font-normal font-sans rounded-md shadow-lg
                                         opacity-0 invisible pointer-events-none
                                         ${left ? "right-full mr-3 translate-x-1" : "left-full ml-3 -translate-x-1"}
                                         transition-all duration-200 ease-out
                                         group-hover:opacity-100 group-hover:visible group-hover:translate-x-0
                                         group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-x-0 z-10`}

                            >
                                  { props.tooltip }
                                  <div className={`absolute top-1/2 -translate-y-1/2 border-4 border-transparent ${left ? "left-full border-l-ink-900" : "right-full border-r-ink-900"}`} />
                            </div>
                  )}
            </div>
      );
}
