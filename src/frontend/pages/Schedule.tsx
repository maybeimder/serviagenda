import AppButton from "@/components/ui/AppButton";
import { useCallback, useMemo, useState } from "react";
import type { Area, Day, TimeRange } from "@core/types/base";
import type { Session } from "@core/types/dtos";
import { CalendarDays, Sparkles } from "lucide-react";
import { Tab } from "./People";
import BigCalendar, { BlockSelection, PatientAreaId, PatientFocus } from "@/components/schedule/BigCalendar";
import type { Assignment } from "@/components/schedule/SessionContextMenu";
import { newSession, withAtHome, withPatients, withTherapist } from "@core/sessions/edit";
import { toMins } from "@core/utils/time";
import { Patients, Therapists } from "@data/data";
import { coordinatedTherapists } from "@/utils/coordination";
import { toTitleCase } from "@/utils/toTitleCase";
import PersonSelect from "@/components/coordinate/PersonSelect";
import { patientOptions, therapistOptions, PersonOption } from "@/utils/peopleOptions";
import { demoSessions } from "@/utils/demoSessions";

type Option = PersonOption;

const patientById = new Map(Patients.map((p) => [p.id, p]));
const therapistById = new Map(Therapists.map((t) => [t.id, t]));

export default function ScheduleView() {
      const [activeTab, setActiveTab] = useState<Tab>("therapists");
      // Cada pestaña recuerda su propia selección
      const [patient, setPatient] = useState<Option | null>(null);
      const [therapist, setTherapist] = useState<Option | null>(null);
      const isPatients = activeTab === "patients";
      const selected = isPatients ? patient : therapist;
      const patientsInCity = useMemo(
            () => patientOptions.filter((p) => p.city === therapist?.city),
            [therapist?.city]
      );
      const [week, setWeek] = useState(1);

      // TEMPORAL: las sesiones de ejemplo viven aquí para poder moverlas; luego vendrán del scheduler
      const [sessions, setSessions] = useState(demoSessions);
      const moveSession = useCallback((id: string, day: Day, schedule: TimeRange) =>
            setSessions((prev) => prev.map((s) => s.id === id ? { ...s, day, schedule } : s)), []);

      // Las reglas de edición (cruzada si hay 2+ pacientes, en casa = 1 paciente) viven en el core
      const editSessionPatients = useCallback((id: string, entries: PatientAreaId[]) =>
            setSessions((prev) => prev.map((s) => s.id !== id ? s : withPatients(s, entries.map((e) => ({ patient: patientById.get(e.patientId)!, area: e.area }))))), []);
      const setSessionAtHome = useCallback((id: string, atHome: boolean, keepPatientId?: string) =>
            setSessions((prev) => prev.map((s) => s.id === id ? withAtHome(s, atHome, keepPatientId) : s)), []);
      const deleteSession = useCallback((id: string) =>
            setSessions((prev) => prev.filter((s) => s.id !== id)), []);

      // Vista de un paciente: cambia el terapeuta de la sesión y el área en que se atiende al paciente
      const editSessionTherapist = useCallback((id: string, therapistId: string, area: Area) =>
            setSessions((prev) => prev.map((s) => {
                  const newTherapist = therapistById.get(therapistId);
                  if (s.id !== id || !newTherapist || !patient) return s;
                  return withPatients(withTherapist(s, newTherapist), s.patient.map((p) => ({ patient: p, area: p.id === patient.id ? area : s.areaPerPatient[p.id] })));
            })), [patient]);

      // Sesiones de la persona elegida: las del terapeuta, o las que incluyen al paciente
      const visibleSessions = useMemo(
            () => sessions.filter((s) => isPatients ? s.patient.some((p) => p.id === patient?.id) : s.therapist.id === therapist?.id),
            [sessions, isPatients, patient?.id, therapist?.id]
      );

      /**
       * Crea las sesiones de los bloques seleccionados (una por día del bloque). Vista de un terapeuta: sus
       * pacientes elegidos; vista de un paciente: ese paciente con el terapeuta elegido. Los días donde el bloque
       * choca con una sesión de esta agenda se saltan.
       */
      const assignSessions = (blocks: BlockSelection[], assignments: Assignment[]) => {
            const sessionTherapist = isPatients ? therapistById.get(assignments[0]?.patient.id) : therapist && therapistById.get(therapist.id);
            if (!sessionTherapist) return;
            const entries = isPatients
                  ? patient ? [{ patient: patientById.get(patient.id)!, area: assignments[0].area }] : []
                  : assignments.map((a) => ({ patient: patientById.get(a.patient.id)!, area: a.area }));

            const created: Session[] = [];
            for (const block of blocks) for (const day of block.days) {
                  const clash = [...visibleSessions, ...created].some((o) =>
                        o.day === day && toMins(o.schedule.start) < toMins(block.schedule.end) && toMins(o.schedule.end) > toMins(block.schedule.start));
                  if (!clash) created.push(newSession(crypto.randomUUID(), { day, schedule: block.schedule, therapist: sessionTherapist }, entries));
            }
            setSessions((prev) => [...prev, ...created]);
      };

      // Vista de un paciente: sus terapeutas coordinados (se elige uno) y los demás pacientes que se le pueden sumar a una sesión
      const patientFocus = useMemo<PatientFocus | undefined>(() => !patient ? undefined : {
            patient: { id: patient.id, fullName: patient.fullName, authorizations: patient.authorizations },
            // al elegir terapeuta, las áreas disponibles son las autorizadas del paciente
            coordinatedTherapists: coordinatedTherapists(patient.id).map((t) => ({ id: t.id, fullName: toTitleCase(t.name), authorizations: patient.authorizations })),
            otherPatients: patientOptions.filter((p) => p.city === patient.city && p.id !== patient.id),
      }, [patient]);

      return (
            <div className="w-full h-full flex flex-col py-8.5 gap-6">
                  <div className="@container flex flex-wrap gap-2 items-center">
                        <AppButton variant={activeTab === "therapists" ? "primary" : "secondary"} text="Terapeutas" onClick={() => setActiveTab("therapists")} />
                        <AppButton variant={activeTab === "patients"   ? "primary" : "secondary"} text="Pacientes"  onClick={() => setActiveTab("patients")}/>
                        <div className="w-px h-6 bg-ink-300 mx-1 @max-[920px]:hidden"></div>

                        <div className="bg-transparent-50 rounded-3xl shadow-sm shadow-neutral-200 h-fill flex items-center p-1 min-w-50 flex-1 inset-shadow-sm inset-shadow-ink-200">
                              <PersonSelect
                                    key={activeTab}
                                    people={isPatients ? patientOptions : therapistOptions}
                                    value={isPatients ? patient : therapist}
                                    onChange={isPatients ? setPatient : setTherapist}
                                    placeholder={isPatients ? "Seleccionar paciente" : "Seleccionar terapeuta"}
                                    cityFilter
                                    triggerClassName="rounded-3xl! pr-2! bg-neutral-50 h-fill!"
                              />
                        </div>

                        <div className="w-px h-6 bg-ink-300 mx-1 @max-[920px]:hidden"></div>
                        {[1, 2, 3, 4].map((n) => (
                              <AppButton key={n} variant={week === n ? "primary" : "secondary"} text={`Semana ${n}`} shortText={`S${n}`} onClick={() => setWeek(n)} />
                        ))}
                        <div className="w-px h-6 bg-ink-300 mx-1 @max-[920px]:hidden"></div>

                        {/* Aún sin conectar. En tamaños pequeños queda solo el ícono */}
                        <div className="ml-auto">
                              <AppButton variant="secondary" icon={Sparkles} iconSize={20} text="Rellenar Automáticamente" textClassName="@max-[1000px]:hidden" />
                        </div>
                  </div>

                  <div className="w-full flex-1 min-h-0 min-w-0">
                        {selected ? (
                              <BigCalendar
                                    key={`${activeTab}-${selected.id}`}
                                    sessions={visibleSessions}
                                    onMoveSession={moveSession}
                                    onEditSessionPatients={editSessionPatients}
                                    onEditSessionTherapist={editSessionTherapist}
                                    onSetSessionAtHome={setSessionAtHome}
                                    onDeleteSession={deleteSession}
                                    onAssignSessions={assignSessions}
                                    perspective={isPatients ? "patient" : "therapist"}
                                    // Terapeuta: pacientes de su ciudad. Paciente: sus terapeutas coordinados (ver patientFocus)
                                    assignablePatients={isPatients ? undefined : patientsInCity}
                                    patientFocus={isPatients ? patientFocus : undefined}
                              />
                        ) : (
                              <div className="h-full flex flex-col items-center justify-center gap-3 text-ink-500">
                                    <CalendarDays size={48} strokeWidth={1.25} />
                                    <p className="text-sm">{isPatients ? "Selecciona un paciente" : "Selecciona un terapeuta"} para ver su agenda</p>
                              </div>
                        )}
                  </div>
            </div>
      )
}
