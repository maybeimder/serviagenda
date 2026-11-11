import { nameToHslGradient } from "@/utils/nameToHSL"

export function getInitials(fullName: string) {
      const parts = fullName.trim().split(/\s+/);
      return `${parts[0]?.[0] ?? ""}${parts.length > 2 ? parts[2]?.[0] : (parts[1]?.[0] ?? "")}`;
}

/** Avatar circular con iniciales y gradiente derivado del nombre. `className` controla el tamaño. */
export default function PersonAvatar({ fullName, className = "w-12 h-12 text-lg" }: { fullName: string, className?: string }) {
      return (
            <div
                  style={{ background: nameToHslGradient(fullName) }}
                  className={`rounded-full shrink-0 flex items-center justify-center text-white text-shadow-lg border-2 border-neutral-200 ${className}`}
            >
                  {getInitials(fullName)}
            </div>
      );
}
