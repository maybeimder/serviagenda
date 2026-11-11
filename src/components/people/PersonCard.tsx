import { Area, City } from "@/types/shared"
import { nameToHslColor, nameToHslGradient } from "@/utils/nameToHSL"
import AppButton from "../ui/AppButton"
import { ChevronRight, MapPin, Pencil, User } from "lucide-react"
import { useRef } from "react"
import { useAnimateReflow } from "@/hooks/useAnimateReflow"
import AreaBadge from "../ui/AreaBadge";

export type PersonCardProps = {
      id: string
      fullName: string
      city: City
      authorizations?: Partial<Record<Area, number>>
}

export default function PersonCard({ person }: { person: PersonCardProps }) {
      const badgesRef = useRef<HTMLDivElement>(null);
      useAnimateReflow(badgesRef);
      const parts = person.fullName.trim().split(/\s+/);
      const initials = `${parts[0]?.[0] ?? ""}${parts.length > 2 ? parts[2]?.[0] : (parts[1]?.[0] ?? "")}`;

      return (
            <div className="@container relative [content-visibility:auto] [contain-intrinsic-size:auto_130px] w-full min-w-70 flex items-start px-4 pt-6 pb-9 gap-3 rounded-xl shadow-md inset-shadow-[0_4px_4px_white]">
                  <div
                        style={{ background: nameToHslGradient(person.fullName) }}
                        className="rounded-full w-12 h-12 shrink-0 flex items-center justify-center text-lg text-neutral-50"
                  >
                        {initials}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                        <div className="flex items-center gap-2 min-w-0 pr-8">
                              <span className="text-xl font-display font-medium tracking-tight text-ink-950 truncate">
                                    {person.fullName} ·
                              </span>
                              <span className="shrink-0 flex items-center gap-0.5 text-[11px] uppercase tracking-wider text-ink-600">
                                    <MapPin size={11} strokeWidth={1.5} />
                                    {person.city}
                              </span>
                        </div>

                        <div ref={badgesRef} className="relative flex flex-wrap items-center gap-1.5">
                              {(Object.keys(person.authorizations ?? {}) as Area[]).map((area) => {
                                    const value = person.authorizations?.[area];
                                    return value !== undefined && (
                                          <AreaBadge key={area} area={area} value={value} />
                                    );
                              })}
                        </div>
                  </div>

                  <div className="absolute top-2 right-2 z-10">
                        <AppButton
                              variant="icon-only"
                              icon={Pencil}
                              tooltip="Editar"
                              iconSize={14}
                              className="p-1.5! rounded-lg!"
                        />
                  </div>

                  <div className="absolute bottom-2 right-2 z-10 flex items-center rounded-full overflow-hidden bg-white shadow-sm text-xs">
                        <div className="flex items-center gap-1 pl-2.5 pr-0.5 py-1 text-ink-700 @max-xs:px-2">
                              <User size={16} strokeWidth={1.5} />
                              <span className="@max-xs:hidden">3</span>
                        </div>
                        <div className="@max-xs:hidden">
                              <AppButton
                                    variant="secondary"
                                    icon={ChevronRight}
                                    iconSize={16}
                                    className="px-1! py-1! rounded-none! shadow-none!"
                              />
                        </div>
                  </div>
            </div>
      );
}
