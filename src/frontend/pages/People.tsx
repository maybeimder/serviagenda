import AppButton from "@/components/ui/AppButton"
import PeopleLister from "@/components/people/PeopleLister";
import { PersonAvailability, PersonCardProps, PersonEdit } from "@/components/people/PersonCard";
import { toTitleCase } from "@/utils/toTitleCase";
import { updateDirectoryEntry } from "@data/data";
import { refreshOption } from "@/utils/peopleOptions";
import { saveUser, useDataFile } from "@/data/dataFiles";
import { therapistIdsOf, CoordinationMap } from "@core/coordination/map";
import type { Area, Schedule } from "@core/types/base";
import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react"
import AppInput from "@/components/ui/AppInput";
import AppMenu, { AppMenuOption } from "@/components/ui/AppMenu";
import { City } from "@/types/shared";
import { ArrowDownWideNarrow, Filter, Zap, ZapOff } from "lucide-react";
import { useLowMotion } from "@/hooks/useLowMotion";

export type Tab = "patients" | "therapists";

// Mapas id -> datos (como los devuelve el backend / patients.json); cada edición se guarda de a una persona.
type PatientRecord = { name: string, city: City, disponibility: { site: Schedule, home?: Schedule }, sessionsRequirements: Partial<Record<Area, number>> };
type TherapistRecord = { name: string, city: City, disponibility: Schedule };
type PatientsFile = Record<string, PatientRecord>;
type TherapistsFile = Record<string, TherapistRecord>;

const NO_PEOPLE = {};

/** Lo guardado de una persona llega también al directorio que usan las demás vistas (Agenda, Coordinar), sin recargar. */
function propagate(kind: "patient" | "therapist", id: string, saved: PatientRecord | TherapistRecord) {
      updateDirectoryEntry(kind, id, saved);
      refreshOption(kind, id, saved);
}

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

      const patientsFile = useDataFile<PatientsFile>("patients", NO_PEOPLE);
      const therapistsFile = useDataFile<TherapistsFile>("therapists", NO_PEOPLE);
      const coordination = useDataFile<CoordinationMap>("coordination", NO_PEOPLE);

      const patients = useMemo<PersonCardProps[]>(() => Object.entries(patientsFile.data).map(([id, p]) => ({
            id, fullName: toTitleCase(p.name), city: p.city, authorizations: p.sessionsRequirements,
            availability: { site: p.disponibility.site, home: p.disponibility.home },
      })), [patientsFile.data]);
      const therapists = useMemo<PersonCardProps[]>(() => Object.entries(therapistsFile.data).map(([id, t]) => ({
            id, fullName: toTitleCase(t.name), city: t.city,
            availability: { site: t.disponibility },
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

      // Cada edición guarda solo a esa persona (tras la confirmación de la card) y refresca el mapa local con lo que respondió
      const { setLocal: setPatients } = patientsFile, { setLocal: setTherapists } = therapistsFile;
      // Último mapa, para que los callbacks (estables, así las cards memoizadas no se re-renderizan) no usen uno viejo
      const patientsRef = useRef(patientsFile.data), therapistsRef = useRef(therapistsFile.data);
      patientsRef.current = patientsFile.data;
      therapistsRef.current = therapistsFile.data;
      const savePatient = useCallback(async (id: string, edit: PersonEdit) => {
            const saved = await saveUser<PatientRecord>("patient", id, { name: edit.fullName.toUpperCase(), city: edit.city, sessionsRequirements: edit.authorizations ?? {} });
            setPatients({ ...patientsRef.current, [id]: { ...patientsRef.current[id], ...saved } });
            propagate("patient", id, saved);
      }, [setPatients]);
      const saveTherapist = useCallback(async (id: string, edit: PersonEdit) => {
            const saved = await saveUser<TherapistRecord>("therapist", id, { name: edit.fullName.toUpperCase(), city: edit.city });
            setTherapists({ ...therapistsRef.current, [id]: { ...therapistsRef.current[id], ...saved } });
            propagate("therapist", id, saved);
      }, [setTherapists]);

      // Disponibilidad: el paciente tiene presencial (site) y a domicilio (home); el terapeuta, un único horario
      const savePatientAvailability = useCallback(async (id: string, a: PersonAvailability) => {
            const disponibility = a.home && Object.keys(a.home).length > 0 ? { site: a.site, home: a.home } : { site: a.site };
            const saved = await saveUser<PatientRecord>("patient", id, { disponibility });
            setPatients({ ...patientsRef.current, [id]: { ...patientsRef.current[id], ...saved } });
            propagate("patient", id, saved);
      }, [setPatients]);
      const saveTherapistAvailability = useCallback(async (id: string, a: PersonAvailability) => {
            const saved = await saveUser<TherapistRecord>("therapist", id, { disponibility: a.site });
            setTherapists({ ...therapistsRef.current, [id]: { ...therapistsRef.current[id], ...saved } });
            propagate("therapist", id, saved);
      }, [setTherapists]);

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
                              <PeopleLister kind="patient" collapsed={activeTab !== "patients"} people={visiblePatients} related={therapistsOfPatient} onSave={savePatient} onSaveAvailability={savePatientAvailability} loading={!patientsFile.loaded} relatedLoading={!coordination.loaded} />
                              <PeopleLister kind="therapist" collapsed={activeTab === "patients"} people={visibleTherapists} related={patientsOfTherapist} onSave={saveTherapist} onSaveAvailability={saveTherapistAvailability} loading={!therapistsFile.loaded} relatedLoading={!coordination.loaded} />
                  </div>
            </div>
      )
}
