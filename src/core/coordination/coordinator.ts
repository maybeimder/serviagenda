import { CONFIG } from "../config/businessrules";
import { Patient, Therapist } from "../types/dtos";
import { pickRandom, randomInt } from "../utils/random";
import { pickByAvailability, weeklyDemandOf } from "./selection";

const therapistsInCity = (therapists: Therapist[], city: Patient["city"]) =>
      therapists.filter(t => t.city === city);

/**
 * Sugerencia para un solo paciente: los terapeutas de su ciudad que mejor cubren sus horarios.
 * Es lo que usa el botón "Asignar Automáticamente". No considera la carga de otros pacientes.
 * Devuelve [] si ningún terapeuta de la ciudad comparte horario con el paciente.
 */
export function suggestTherapists(patient: Patient, therapists: Therapist[]): Therapist[] {
      const sameCity = therapistsInCity(therapists, patient.city);
      const ids = pickByAvailability(patient, sameCity, { minCount: 1 });
      return ids.map(id => sameCity.find(t => t.id === id)!);
}

/** Reparte a todos los pacientes entre los terapeutas, balanceando la carga que va acumulando cada uno. */
export class Coordinator {
      /** demanda semanal (slots) ya asignada por terapeuta, para balancear carga */
      private readonly load = new Map<string, number>();

      constructor(
            private readonly patients: Patient[],
            private readonly therapists: Therapist[],
      ) {}

      /** therapistsPerPatient: id de paciente -> ids de sus terapeutas. */
      coordinate(): Map<string, Set<string>> {
            const therapistsPerPatient = new Map<string, Set<string>>();
            for (const patient of this.patients)
                  therapistsPerPatient.set(patient.id, this.assignTo(patient));
            return therapistsPerPatient;
      }

      private assignTo(patient: Patient): Set<string> {
            const { maxTherapists } = CONFIG.PatientRelated;
            const sameCity = therapistsInCity(this.therapists, patient.city);

            // Simula cuántos terapeutas elegiría el usuario
            const userChoiceCount = randomInt(1, maxTherapists);

            const picked = pickByAvailability(patient, sameCity, { minCount: userChoiceCount, load: this.load });
            this.registerLoad(patient, picked);
            const assigned = new Set(picked);

            // Sin horarios compatibles se elige al azar
            for (let i = 0; !assigned.size && i < userChoiceCount && sameCity.length; i++)
                  assigned.add(pickRandom(sameCity).id);

            if (assigned.size > maxTherapists)
                  throw new Error(`${assigned.size} tiene mas terapeutas del permitido (${maxTherapists})`);

            return assigned;
      }

      /** Reparte la demanda semanal del paciente en partes iguales entre los terapeutas elegidos. */
      private registerLoad(patient: Patient, therapistIds: string[]) {
            const share = weeklyDemandOf(patient) / therapistIds.length;
            for (const id of therapistIds)
                  this.load.set(id, (this.load.get(id) ?? 0) + share);
      }
}
