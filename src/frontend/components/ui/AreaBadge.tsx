import { Area } from "@/types/shared";
import {Backpack,Brain,Dumbbell,Hand,LucideIcon,MessageSquareMore,Puzzle,SportShoe,} from "lucide-react";

export const AREA_ICON_BY_CODE: Record<
      Area,
      { icon: LucideIcon; color: string }
> = {
      fono: { icon: MessageSquareMore, color: "#CC0098" },
      acom: { icon: Backpack, color: "#72efdd" },
      fisio: { icon: Dumbbell, color: "#00AF52" },
      inte: { icon: Hand, color: "#f7b267" },
      neuro: { icon: Puzzle, color: "#01B0F1" },
      psico: { icon: Brain, color: "#01B0F1" },
      teo: { icon: SportShoe, color: "#FF6600" },
};

export const AREA_LABEL: Record<Area, string> = {
      fono: "Fonoaudiología",
      acom: "Acompañamiento",
      fisio: "Fisioterapia",
      inte: "Integración sensorial",
      neuro: "Neuropsicología",
      psico: "Psicología",
      teo: "Terapia ocupacional",
};

export type AreaBadgeProps = {
      area: Area;
      value: number;
      /** Muestra el nombre del área junto al valor */
      showLabel?: boolean;
};

export default function AreaBadge({ area, value, showLabel }: AreaBadgeProps) {
      const areaConfig = AREA_ICON_BY_CODE[area];
      if (!areaConfig) return null;

      return (
            <div
                  title={AREA_LABEL[area]}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium bg-transparent`}
            >
                  <areaConfig.icon size={12} color={areaConfig.color} />
                  {showLabel && <p className="truncate text-ink-600">{AREA_LABEL[area]}</p>}
                  <p className={showLabel ? "ml-auto" : ""}>{`${value}`}</p>
            </div>
      );
}
