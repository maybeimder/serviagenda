import AppButton from "@/components/ui/AppButton"
import PeopleLister from "@/components/people/PeopleLister";
import { PersonCardProps, PersonEdit } from "@/components/people/PersonCard";
import patientsJson from "@data/patients.json";
import therapistsJson from "@data/therapists.json";
import { toTitleCase } from "@/utils/toTitleCase";
import { useDataFile } from "@/data/dataFiles";
import { therapistIdsOf, CoordinationMap } from "@core/coordination/map";
import type { Area } from "@core/types/base";
import { useCallback, useDeferredValue, useMemo, useState } from "react"
import AppInput from "@/components/ui/AppInput";
import AppMenu, { AppMenuOption } from "@/components/ui/AppMenu";
import { City } from "@/types/shared";
import { ArrowDownWideNarrow, Filter, Zap, ZapOff } from "lucide-react";
import { useLowMotion } from "@/hooks/useLowMotion";

export type Tab = "patients" | "therapists";

// patients.json / therapists.json son las fuentes de verdad (mapas id -> datos); aquí se editan y se vuelven a escribir.
type PatientRecord = { name: string, city: City, disponibility: unknown, sessionsRequirements: Partial<Record<Area, number>> };
type TherapistRecord = { name: string, city: City, disponibility: unknown };
type PatientsFile = Record<string, PatientRecord>;
type TherapistsFile = Record<string, TherapistRecord>;

const initialPatients = patientsJson as unknown as PatientsFile;
const initialTherapists = therapistsJson as unknown as TherapistsFile;

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

      const patientsFile = useDataFile<PatientsFile>("patients", initialPatients);
      const therapistsFile = useDataFile<TherapistsFile>("therapists", initialTherapists);
      const coordination = useDataFile<CoordinationMap>("coordination", {});

      const patients = useMemo<PersonCardProps[]>(() => Object.entries(patientsFile.data).map(([id, p]) => ({
            id, fullName: toTitleCase(p.name), city: p.city, authorizations: p.sessionsRequirements,
      })), [patientsFile.data]);
      const therapists = useMemo<PersonCardProps[]>(() => Object.entries(therapistsFile.data).map(([id, t]) => ({
            id, fullName: toTitleCase(t.name), city: t.city,
      })), [therapistsFile.data]);

      // Según coordination.json: terapeutas de cada paciente y pacientes de cada terapeuta (nombres, para el botón de asociados)
      const { therapistsOfPatient, patientsOfTherapist } = useMemo(() => {
            const byName = (a: string, b: string) => a.localeCompare(b, "es");
            const therapistsOfPatient = new Map<string, string[]>();
            const patientsOfTherapist = new Map<string, string[]>();
            for (const [patientId, value] of Object.entries(coordination.data)) {
                  const patient = patientsFile.data[patientId];
                  const ids = therapistIdsOf(value).filter((tid) => therapistsFile.data[tid]);
                  therapistsOfPatient.set(patientId, ids.map((tid) => toTitleCase(therapistsFile.data[tid].name)).sort(byName));
                  for (const tid of ids)
                        patientsOfTherapist.set(tid, [...(patientsOfTherapist.get(tid) ?? []), toTitleCase(patient?.name ?? patientId)]);
            }
            for (const [tid, names] of patientsOfTherapist) patientsOfTherapist.set(tid, names.sort(byName));
            return { therapistsOfPatient, patientsOfTherapist };
      }, [coordination.data, patientsFile.data, therapistsFile.data]);

      // Guardar una edición escribe el archivo completo (tras la confirmación de la card)
      const savePatient = useCallback((id: string, edit: PersonEdit) => patientsFile.save({
            ...patientsFile.data,
            [id]: { ...patientsFile.data[id], name: edit.fullName.toUpperCase(), city: edit.city, sessionsRequirements: edit.authorizations ?? {} },
      }), [patientsFile]);
      const saveTherapist = useCallback((id: string, edit: PersonEdit) => therapistsFile.save({
            ...therapistsFile.data,
            [id]: { ...therapistsFile.data[id], name: edit.fullName.toUpperCase(), city: edit.city },
      }), [therapistsFile]);

      const visiblePatients   = useMemo(() => filterAndSort(patients,   deferredQuery, sortBy, cityFilter), [patients, deferredQuery, sortBy, cityFilter]);
      const visibleTherapists = useMemo(() => filterAndSort(therapists, deferredQuery, sortBy, cityFilter), [therapists, deferredQuery, sortBy, cityFilter]);

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
                              <PeopleLister kind="patient" collapsed={activeTab !== "patients"} people={visiblePatients} related={therapistsOfPatient} onSave={savePatient} />
                              <PeopleLister kind="therapist" collapsed={activeTab === "patients"} people={visibleTherapists} related={patientsOfTherapist} onSave={saveTherapist} />
                  </div>
            </div>
      )
}
