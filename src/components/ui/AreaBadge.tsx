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

export type AreaBadgeProps = {
      area: Area;
      value: number;
};

export default function AreaBadge({ area, value }: AreaBadgeProps) {
      const areaConfig = AREA_ICON_BY_CODE[area];
      if (!areaConfig) return null;

      return (
            <div
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium bg-neutral-50`}
            >
                  <areaConfig.icon size={12} color={areaConfig.color} />
                  <p>{`${value}`}</p>
            </div>
      );
}
