import AppButton from "@/components/ui/AppButton";
import { CalendarSkeleton } from "@/components/ui/Skeleton";
import AutoFillButton, { AutoFillScope } from "@/components/ui/AutoFillButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Area, Day, TimeRange } from "@core/types/base";
import { CalendarDays, Check, Save, Sparkles } from "lucide-react";
import { Tab } from "./People";
import BigCalendar, { BlockSelection, PatientAreaId, PatientFocus } from "@/components/schedule/BigCalendar";
import type { Assignment } from "@/components/schedule/SessionContextMenu";
import { newSession, withAtHome, withPatients, withTherapist } from "@core/sessions/edit";
import {
      CoordinationMap, Coordinator, StoredSessions, WeekSession, deserializeSessions, fromCoordinationMap, monthToSessions,
      scheduleMonth, serializeSessions, therapistIdsOf, toCoordinationMap,
} from "@core/index";
import { minsToTime, toMins } from "@core/utils/time";
import { SLOT_MINS } from "@core/config/scheduling";
import { Patients, Therapists } from "@data/data";
import { readDataFile, useDataFile, writeAgendaState, writeDataFile } from "@/data/dataFiles";
import { coordinatedTherapists, withSessionPairs } from "@/utils/coordination";
import { toTitleCase } from "@/utils/toTitleCase";
import PersonSelect from "@/components/coordinate/PersonSelect";
import { patientOptions, therapistOptions, PersonOption } from "@/utils/peopleOptions";

type Option = PersonOption;

const patientById = new Map(Patients.map((p) => [p.id, p]));
const therapistById = new Map(Therapists.map((t) => [t.id, t]));

const overlaps = (a: TimeRange, b: TimeRange) => toMins(a.start) < toMins(b.end) && toMins(a.end) > toMins(b.start);
/** ¿Chocan dos sesiones? Misma semana y día, horarios que se solapan, y comparten terapeuta o algún paciente. */
const clashes = (a: WeekSession, b: WeekSession) =>
      a.week === b.week && a.day === b.day && overlaps(a.schedule, b.schedule) &&
      (a.therapist.id === b.therapist.id || a.patient.some((p) => b.patient.some((q) => q.id === p.id)));

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

      // ---- Persistencia: sessions.json guarda el estado confirmado; los cambios viven en memoria hasta "Guardar cambios" ----
      const sessionsFile = useDataFile<StoredSessions>("sessions", {});
      const coordinationFile = useDataFile<CoordinationMap>("coordination", {});
      const [sessions, setSessions] = useState<WeekSession[]>([]);
      const [baseline, setBaseline] = useState("{}"); // lo último guardado, serializado, para saber si hay cambios
      const [saving, setSaving] = useState(false);

      useEffect(() => {
            if (!sessionsFile.loaded) return;
            const list = deserializeSessions(sessionsFile.data, patientById, therapistById);
            setSessions(list);
            setBaseline(JSON.stringify(serializeSessions(list)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [sessionsFile.loaded]);

      const dirty = useMemo(() => JSON.stringify(serializeSessions(sessions)) !== baseline, [sessions, baseline]);

      const saveChanges = async () => {
            setSaving(true);
            try {
                  const stored = serializeSessions(sessions);
                  // Sesiones y coordinación van juntas: todo paciente con una sesión tiene a ese terapeuta coordinado
                  const coordination = withSessionPairs(coordinationFile.data, sessions);
                  await writeAgendaState("current", { coordination, sessions: stored });
                  sessionsFile.setLocal(stored);
                  coordinationFile.setLocal(coordination);
                  setBaseline(JSON.stringify(stored));
                  setNotice({ text: "Cambios guardados" });
            } catch (e) {
                  setNotice({ text: `No se pudo guardar: ${e instanceof Error ? e.message : e}` });
            } finally {
                  setSaving(false);
            }
      };

      const [notice, setNotice] = useState<{ text: string } | null>(null);
      useEffect(() => {
            if (!notice) return;
            const t = setTimeout(() => setNotice(null), 3500);
            return () => clearTimeout(t);
      }, [notice]);

      // ---- Ediciones de la agenda (en memoria). Las reglas viven en el core ----
      const keepWeek = (s: WeekSession, edited: Omit<WeekSession, "week">): WeekSession => ({ ...edited, week: s.week });

      const moveSession = useCallback((id: string, day: Day, schedule: TimeRange) =>
            setSessions((prev) => prev.map((s) => s.id === id ? { ...s, day, schedule } : s)), []);
      const editSessionPatients = useCallback((id: string, entries: PatientAreaId[]) =>
            setSessions((prev) => prev.map((s) => s.id !== id ? s : keepWeek(s, withPatients(s, entries.map((e) => ({ patient: patientById.get(e.patientId)!, area: e.area })))))), []);
      const setSessionAtHome = useCallback((id: string, atHome: boolean, keepPatientId?: string) =>
            setSessions((prev) => prev.map((s) => s.id === id ? keepWeek(s, withAtHome(s, atHome, keepPatientId)) : s)), []);
      const deleteSession = useCallback((id: string) =>
            setSessions((prev) => prev.filter((s) => s.id !== id)), []);
      // Sesiones ya agendadas por paciente y área (todo el mes, estado actual en pantalla): "usadas" de usadas/autorizadas
      const usage = useMemo(() => {
            const byPatient = new Map<string, Partial<Record<Area, number>>>();
            for (const s of sessions) for (const p of s.patient) {
                  const area = s.areaPerPatient[p.id];
                  const counts = byPatient.get(p.id) ?? {};
                  counts[area] = (counts[area] ?? 0) + 1;
                  byPatient.set(p.id, counts);
            }
            return byPatient;
      }, [sessions]);

      // Para validar el cuadradito de expansión contra TODA la agenda, no solo lo que se ve
      const sessionsRef = useRef(sessions);
      sessionsRef.current = sessions;
      const canExpandTo = useCallback((sourceId: string, day: Day, schedule: TimeRange) => {
            const source = sessionsRef.current.find((s) => s.id === sourceId);
            if (!source) return false;
            const copy: WeekSession = { ...source, id: "", day, schedule };
            return !sessionsRef.current.some((o) => o.id !== sourceId && clashes(o, copy));
      }, []);

      /** Expandir con el cuadradito de la esquina: copias de la sesión (mismo terapeuta, pacientes, áreas y modo) en esas celdas. Las que chocan se saltan. */
      const expandSession = useCallback((sourceId: string, targets: { id: string, day: Day, schedule: TimeRange }[]) =>
            setSessions((prev) => {
                  const source = prev.find((s) => s.id === sourceId);
                  if (!source) return prev;
                  const created: WeekSession[] = [];
                  for (const t of targets) {
                        const copy: WeekSession = { ...source, id: t.id, day: t.day, schedule: t.schedule };
                        if (![...prev, ...created].some((o) => clashes(o, copy))) created.push(copy);
                  }
                  return created.length ? [...prev, ...created] : prev;
            }), []);

      // Vista de un paciente: cambia el terapeuta de la sesión y el área en que se atiende al paciente
      const editSessionTherapist = useCallback((id: string, therapistId: string, area: Area) =>
            setSessions((prev) => prev.map((s) => {
                  const newTherapist = therapistById.get(therapistId);
                  if (s.id !== id || !newTherapist || !patient) return s;
                  return keepWeek(s, withPatients(withTherapist(s, newTherapist), s.patient.map((p) => ({ patient: p, area: p.id === patient.id ? area : s.areaPerPatient[p.id] }))));
            })), [patient]);

      // Sesiones de la semana elegida de la persona elegida: las del terapeuta, o las que incluyen al paciente
      const visibleSessions = useMemo(
            () => sessions.filter((s) => s.week === week && (isPatients ? s.patient.some((p) => p.id === patient?.id) : s.therapist.id === therapist?.id)),
            [sessions, week, isPatients, patient?.id, therapist?.id]
      );

      /**
       * Crea las sesiones de los bloques seleccionados (una por día del bloque) en la semana elegida. Vista de un
       * terapeuta: sus pacientes elegidos; vista de un paciente: ese paciente con el terapeuta elegido. Los días
       * donde el bloque choca con una sesión de esta agenda se saltan.
       */
      const assignSessions = (blocks: BlockSelection[], assignments: Assignment[]) => {
            const sessionTherapist = isPatients ? therapistById.get(assignments[0]?.patient.id) : therapist && therapistById.get(therapist.id);
            if (!sessionTherapist) return;
            const entries = isPatients
                  ? patient ? [{ patient: patientById.get(patient.id)!, area: assignments[0].area }] : []
                  : assignments.map((a) => ({ patient: patientById.get(a.patient.id)!, area: a.area }));

            // Una sesión por cada slot de 30 min de lo seleccionado (7:00–8:00 son dos: 7:00–7:30 y 7:30–8:00), que se dibujan
            // juntas como un bloque. Los slots que chocan con otra sesión (de cualquier agenda) se saltan.
            const created: WeekSession[] = [];
            let skipped = 0;
            for (const block of blocks) for (const day of block.days)
                  for (let t = toMins(block.schedule.start); t < toMins(block.schedule.end); t += SLOT_MINS) {
                        const schedule = { start: minsToTime(t), end: minsToTime(t + SLOT_MINS) };
                        const candidate: WeekSession = { ...newSession(crypto.randomUUID(), { day, schedule, therapist: sessionTherapist }, entries), week };
                        if ([...sessions, ...created].some((o) => clashes(o, candidate))) skipped++;
                        else created.push(candidate);
                  }
            setSessions((prev) => [...prev, ...created]);
            if (skipped > 0) setNotice({ text: `${created.length} sesiones creadas; ${skipped} no, porque chocan con otra sesión` });
      };

      // Vista de un paciente: sus terapeutas coordinados (se elige uno) y los demás pacientes que se le pueden sumar a una sesión
      const patientFocus = useMemo<PatientFocus | undefined>(() => !patient ? undefined : {
            patient: { id: patient.id, fullName: patient.fullName, authorizations: patient.authorizations },
            // al elegir terapeuta, las áreas disponibles son las autorizadas del paciente
            coordinatedTherapists: coordinatedTherapists(coordinationFile.data, patient.id).map((t) => ({ id: t.id, fullName: toTitleCase(t.name), authorizations: patient.authorizations })),
            otherPatients: patientOptions.filter((p) => p.city === patient.city && p.id !== patient.id),
      }, [patient, coordinationFile.data]);

      // ---- Rellenar Automáticamente ----
      const [filling, setFilling] = useState(false);

      /**
       * Rellenar Automáticamente, con el óptimo del core:
       *  - Coordinación a usar: opt_coordination.json con las entradas de coordination.json por encima.
       *  - El horario óptimo del mes (opt_sessions.json) se calcula para todos una sola vez y se reutiliza.
       *  - "Todos": sessions.json pasa a ser el óptimo completo (se descartan los cambios sin guardar).
       *  - "Uno": se reemplazan las sesiones de la persona elegida (las 4 semanas) por las óptimas, tanto en sessions.json
       *    como en pantalla; los cambios sin guardar de otras personas siguen pendientes.
       */
      const autoFill = async (scope: AutoFillScope) => {
            if (filling || (scope === "one" && !selected)) return;
            setFilling(true);
            try {
                  const coordination = await readDataFile<CoordinationMap>("coordination");
                  let optCoordination = await readDataFile<CoordinationMap>("opt_coordination");
                  if (Object.keys(optCoordination).length === 0) {
                        setNotice({ text: "Calculando la coordinación óptima de todos los pacientes…" });
                        await new Promise((r) => setTimeout(r, 30));
                        optCoordination = toCoordinationMap(new Coordinator(Patients, Therapists).coordinate());
                        await writeDataFile("opt_coordination", optCoordination);
                  }
                  const merged: CoordinationMap = { ...optCoordination, ...coordination };

                  // Sesiones del óptimo, solo con pares paciente–terapeuta que siguen coordinados
                  const optSessions = (stored: StoredSessions) => deserializeSessions(stored, patientById, therapistById)
                        .filter((s) => s.patient.every((p) => therapistIdsOf(merged[p.id]).includes(s.therapist.id)));
                  const ofSelected = (s: WeekSession) => isPatients ? s.patient.some((p) => p.id === selected?.id) : s.therapist.id === selected?.id;

                  let opt = optSessions(await readDataFile<StoredSessions>("opt_sessions"));
                  if (scope === "all" ? opt.length === 0 : !opt.some(ofSelected)) {
                        setNotice({ text: "Calculando el horario óptimo del mes (puede tardar unos segundos)…" });
                        await new Promise((r) => setTimeout(r, 30));
                        const month = scheduleMonth(Patients, Therapists, fromCoordinationMap(merged));
                        const stored = serializeSessions(monthToSessions(month));
                        await writeDataFile("opt_sessions", stored);
                        opt = optSessions(stored);
                  }

                  if (scope === "all") {
                        const stored = serializeSessions(opt);
                        // El óptimo se aplica con su coordinación (la de coordination.json manda sobre la óptima), todo junto
                        const coordinationOut = withSessionPairs(merged, opt);
                        await writeAgendaState("current", { coordination: coordinationOut, sessions: stored });
                        coordinationFile.setLocal(coordinationOut);
                        sessionsFile.setLocal(stored);
                        setSessions(opt);
                        setBaseline(JSON.stringify(stored));
                        setNotice({ text: `Horario óptimo aplicado a todos: ${opt.length} sesiones guardadas` });
                        return;
                  }

                  // Reemplaza las sesiones de la persona: quita las suyas y agrega las óptimas que no choquen con el resto
                  const candidates = opt.filter(ofSelected);
                  const replace = (list: WeekSession[]) => {
                        const rest = list.flatMap((s) => {
                              if (!ofSelected(s)) return [s];
                              if (!isPatients || s.patient.length === 1) return []; // sesión del terapeuta, o del paciente solo
                              return [keepWeek(s, withPatients(s, s.patient.filter((p) => p.id !== selected!.id).map((p) => ({ patient: p, area: s.areaPerPatient[p.id] }))))];
                        });
                        const added: WeekSession[] = [];
                        for (const c of candidates) if (![...rest, ...added].some((o) => clashes(o, c))) added.push(c);
                        return [...rest, ...added];
                  };

                  const truth = replace(deserializeSessions(await readDataFile<StoredSessions>("sessions"), patientById, therapistById));
                  const stored = serializeSessions(truth);
                  const coordinationOut = withSessionPairs(coordination, truth);
                  await writeAgendaState("current", { coordination: coordinationOut, sessions: stored });
                  coordinationFile.setLocal(coordinationOut);
                  sessionsFile.setLocal(stored);
                  setBaseline(JSON.stringify(stored));
                  setSessions((prev) => replace(prev));
                  setNotice({ text: candidates.length === 0
                        ? `${selected!.fullName}: no hay sesiones posibles con la coordinación actual (se vació su agenda)`
                        : `Agenda de ${selected!.fullName} reemplazada por el óptimo: ${candidates.length} sesiones` });
            } catch (e) {
                  setNotice({ text: `No se pudo rellenar: ${e instanceof Error ? e.message : e}` });
            } finally {
                  setFilling(false);
            }
      };
      return (
            <div className="w-full h-full flex flex-col py-8.5 gap-6">
                  {notice && (
                        <div
                              role="status"
                              className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full text-sm shadow-xl bg-ink-900 text-neutral-50 animate-[toast-in_250ms_ease-out]"
                        >
                              <Check size={16} />
                              {notice.text}
                        </div>
                  )}

                  {/* Hay cambios sin guardar en la agenda: se confirman en sessions.json */}
                  {dirty && (
                        <div className="fixed bottom-8 right-8 z-30 animate-[patient-in_200ms_ease-out]">
                              <AppButton
                                    variant="primary" icon={Save} iconSize={20} className="shadow-xl"
                                    text="Guardar cambios" loading={saving} onClick={saveChanges}
                              />
                        </div>
                  )}

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

                        {/* En tamaños pequeños queda solo el ícono */}
                        <div className="ml-auto">
                              <AutoFillButton
                                    icon={Sparkles} textClassName="@max-[1000px]:hidden"
                                    text="Rellenar Automáticamente"
                                    oneLabel={selected ? `Solo ${selected.fullName}` : null}
                                    allLabel={isPatients ? "Todos los pacientes y terapeutas" : "Todos los terapeutas y pacientes"}
                                    oneWarning={`Reemplazará las sesiones de ${selected?.fullName ?? "esta persona"} (las 4 semanas) en sessions.json por las óptimas.`}
                                    allWarning="Reemplazará TODAS las sesiones de sessions.json por las óptimas y descartará los cambios sin guardar."
                                    busy={filling} onConfirm={autoFill}
                              />
                        </div>
                  </div>

                  <div className="w-full flex-1 min-h-0 min-w-0">
                        {selected && (!sessionsFile.loaded || filling) ? (
                              // sesiones todavía bajando, o rellenando automáticamente: el calendario en gris
                              <CalendarSkeleton />
                        ) : selected ? (
                              <BigCalendar
                                    key={`${activeTab}-${selected.id}-${week}`}
                                    sessions={visibleSessions}
                                    onMoveSession={moveSession}
                                    onEditSessionPatients={editSessionPatients}
                                    onEditSessionTherapist={editSessionTherapist}
                                    onSetSessionAtHome={setSessionAtHome}
                                    onDeleteSession={deleteSession}
                                    onExpandSession={expandSession}
                                    canExpandTo={canExpandTo}
                                    usage={usage}
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
