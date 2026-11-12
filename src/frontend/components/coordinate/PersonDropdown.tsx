import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import PersonAvatar from "../people/PersonAvatar";
import AppMenu, { AppMenuOption } from "../ui/AppMenu";
import { City } from "@/types/shared";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MAX_RESULTS = 50;

type CityFilter = City | "all";
const cityOptions: AppMenuOption<CityFilter>[] = [
      { value: "all", label: "Todas las ciudades" },
      { value: "CTG", label: "CTG" },
      { value: "STM", label: "STM" },
      { value: "NVA", label: "NVA" },
];

export type DropdownPerson = { id: string, fullName: string, city?: City };

type PersonDropdownProps<T extends DropdownPerson> = {
      people: T[]
      placeholder: string
      onSelect: (person: T) => void
      /** Muestra un mini botón para filtrar por ciudad dentro del dropdown (las personas deben traer `city`) */
      cityFilter?: boolean
      className?: string
}

/** Panel con buscador y lista de personas (avatar + nombre). El padre decide cuándo mostrarlo. */
export default function PersonDropdown<T extends DropdownPerson>({ people, placeholder, onSelect, cityFilter, className = "w-72" }: PersonDropdownProps<T>) {
      const [query, setQuery] = useState("");
      const [city, setCity] = useState<CityFilter>("all");

      const results = useMemo(() => {
            const q = normalize(query.trim());
            return people
                  .filter((p) => city === "all" || p.city === city)
                  .filter((p) => !q || normalize(p.fullName).includes(q))
                  .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"))
                  .slice(0, MAX_RESULTS);
      }, [people, query, city]);

      return (
            <div className={`absolute left-0 top-full mt-2 z-30 bg-paper rounded-xl shadow-xl p-2 flex flex-col gap-2 ${className}`}>
                  <div className="bg-neutral-50 rounded-lg flex items-center gap-2 pl-3 pr-1 h-9">
                        <Search size={16} className="text-ink-500 shrink-0" />
                        <input
                              autoFocus
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              placeholder={placeholder}
                              className="outline-none w-full text-sm bg-transparent"
                        />
                        {cityFilter && (
                              <AppMenu
                                    variant="tertiary" icon={Filter} iconSize={14} tooltip="Filtrar por ciudad" className="p-1.5!"
                                    align="right" options={cityOptions} value={city} onSelect={setCity} active={city !== "all"}
                              />
                        )}
                  </div>
                  <ul className="max-h-64 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#a3a3a3_transparent]">
                        {results.length === 0 && <li className="px-3 py-2 text-sm text-ink-500">Sin resultados</li>}
                        {results.map((p) => (
                              <li key={p.id}>
                                    <PersonMiniRow p={p} onClick={() => onSelect(p)} />
                              </li>
                        ))}
                  </ul>
            </div>
      );
}

export function PersonMiniRow(props: { onClick: (p: DropdownPerson) => void; p: DropdownPerson, className?:string }) {
      return (
            <button
                  type="button"
                  onClick={() => props.onClick(props.p)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm cursor-pointer hover:bg-ink-200 ${props.className??""}`}
            >
                  <PersonAvatar fullName={props.p.fullName} className="w-6 h-6 text-[10px]" />
                  <span className="truncate">{props.p.fullName}</span>
            </button>
      );
}
