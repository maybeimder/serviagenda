import AppButton from "@/components/ui/AppButton"
import PeopleLister from "@/components/people/PeopleLister";
import { PersonCardProps } from "@/components/people/PersonCard";
import { Patients, Therapists } from "@/data/data";
import { toTitleCase } from "@/utils/toTitleCase";
import { useDeferredValue, useMemo, useState } from "react"
import AppInput from "@/components/ui/AppInput";
import AppMenu, { AppMenuOption } from "@/components/ui/AppMenu";
import { City } from "@/types/shared";
import { ArrowDownWideNarrow, Filter, Zap, ZapOff } from "lucide-react";
import { useLowMotion } from "@/hooks/useLowMotion";

type Tab = "patients" | "therapists";

const patients: PersonCardProps[] = Patients.map((p) => ({
      id: p.id,
      fullName: toTitleCase(p.name),
      city: p.city,
      authorizations: p.sessionsRequirements,
}));

const therapists: PersonCardProps[] = Therapists.map((t) => ({
      id: t.id,
      fullName: toTitleCase(t.name),
      city: t.city,
}));

type SortBy = "alpha" | "city";
type CityFilter = City | "all";

const sortOptions: AppMenuOption<SortBy>[] = [
      { value: "alpha", label: "Orden alfabético" },
      { value: "city",  label: "Ciudad" },
];
const cityOptions: AppMenuOption<CityFilter>[] = [
      { value: "all", label: "Todas las ciudades" },
      { value: "CTG", label: "CTG" },
      { value: "STM", label: "STM" },
      { value: "NVA", label: "NVA" },
];

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function filterAndSort(list: PersonCardProps[], query: string, sortBy: SortBy, cityFilter: CityFilter) {
      const q = normalize(query.trim());
      return list
            .filter((p) => cityFilter === "all" || p.city === cityFilter)
            .filter((p) => !q || normalize(p.fullName).includes(q))
            .sort((a, b) =>
                  sortBy === "city"
                        ? a.city.localeCompare(b.city) || a.fullName.localeCompare(b.fullName, "es")
                        : a.fullName.localeCompare(b.fullName, "es")
            );
}

export default function PeopleView() {
      const [activeTab, setActiveTab] = useState<Tab>("patients");
      const [lowMotion, setLowMotion] = useLowMotion();
      const [query, setQuery] = useState("");
      const [sortBy, setSortBy] = useState<SortBy>("alpha");
      const [cityFilter, setCityFilter] = useState<CityFilter>("all");

      // La búsqueda se difiere para que escribir no espere al re-render de la lista
      const deferredQuery = useDeferredValue(query);

      const visiblePatients   = useMemo(() => filterAndSort(patients,   deferredQuery, sortBy, cityFilter), [deferredQuery, sortBy, cityFilter]);
      const visibleTherapists = useMemo(() => filterAndSort(therapists, deferredQuery, sortBy, cityFilter), [deferredQuery, sortBy, cityFilter]);

      return (
            <div className="w-full h-full py-8 flex flex-col gap-6">
                  <div className="@container flex flex-wrap gap-2 items-center">
                        <AppButton variant={activeTab === "patients"   ? "primary" : "secondary"} text="Pacientes"  onClick={() => setActiveTab("patients")}/>
                        <AppButton variant={activeTab === "therapists" ? "primary" : "secondary"} text="Terapeutas" onClick={() => setActiveTab("therapists")}/>

                        <div className="w-px h-6 bg-ink-300 mx-1 @max-[920px]:hidden"></div>
                        <div className="order-last w-full @[920px]:order-none @[920px]:w-auto @[920px]:flex-1 min-w-0">
                              <AppInput value={query} onChange={setQuery} />
                        </div>
                        <div className="w-px h-6 bg-ink-300 mx-1 @max-[920px]:hidden"></div>

                        <AppMenu
                              icon={ArrowDownWideNarrow} iconSize={20} text="Ordenar por" textClassName="@max-2xl:hidden"
                              options={sortOptions} value={sortBy} onSelect={setSortBy}
                        />
                        <AppMenu
                              icon={Filter} iconSize={20} text="Filtrar por" textClassName="@max-2xl:hidden"
                              options={cityOptions} value={cityFilter} onSelect={setCityFilter} active={cityFilter !== "all"}
                        />
                        <AppButton
                              variant="icon-only" icon={lowMotion ? ZapOff : Zap} iconSize={20}
                              tooltip="Bajas animaciones" tooltipSide="left"
                              active={lowMotion} onClick={() => setLowMotion(!lowMotion)}
                        />
                  </div>
                  <div className="w-full flex-1 min-h-0 min-w-0 flex gap-2">
                              <PeopleLister collapsed={activeTab !== "patients"} people={visiblePatients} />
                              <PeopleLister collapsed={activeTab === "patients"} people={visibleTherapists} />
                  </div>
            </div>
      )
}
