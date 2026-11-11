import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import PersonAvatar from "../people/PersonAvatar";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MAX_RESULTS = 50;

export type DropdownPerson = { id: string, fullName: string };

type PersonDropdownProps<T extends DropdownPerson> = {
      people: T[]
      placeholder: string
      onSelect: (person: T) => void
      className?: string
}

/** Panel con buscador y lista de personas (avatar + nombre). El padre decide cuándo mostrarlo y filtra por ciudad. */
export default function PersonDropdown<T extends DropdownPerson>({ people, placeholder, onSelect, className = "w-72" }: PersonDropdownProps<T>) {
      const [query, setQuery] = useState("");

      const results = useMemo(() => {
            const q = normalize(query.trim());
            return people
                  .filter((p) => !q || normalize(p.fullName).includes(q))
                  .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"))
                  .slice(0, MAX_RESULTS);
      }, [people, query]);

      return (
            <div className={`absolute left-0 top-full mt-2 z-30 bg-paper rounded-xl shadow-xl p-2 flex flex-col gap-2 ${className}`}>
                  <div className="bg-neutral-50 rounded-lg flex items-center gap-2 px-3 h-9">
                        <Search size={16} className="text-ink-500 shrink-0" />
                        <input
                              autoFocus
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              placeholder={placeholder}
                              className="outline-none w-full text-sm bg-transparent"
                        />
                  </div>
                  <ul className="max-h-64 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#a3a3a3_transparent]">
                        {results.length === 0 && <li className="px-3 py-2 text-sm text-ink-500">Sin resultados</li>}
                        {results.map((p) => (
                              <li key={p.id}>
                                    <button
                                          type="button"
                                          onClick={() => onSelect(p)}
                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm cursor-pointer hover:bg-ink-200"
                                    >
                                          <PersonAvatar fullName={p.fullName} className="w-6 h-6 text-[10px]" />
                                          <span className="truncate">{p.fullName}</span>
                                    </button>
                              </li>
                        ))}
                  </ul>
            </div>
      );
}
