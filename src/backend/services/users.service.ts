import type { Patient, Therapist } from "../../core/types/dtos";
import { PatientModel } from "../models/patient.model";
import { TherapistModel } from "../models/therapist.model";
import type { PatientRecord, PatientsMap, TherapistRecord, TherapistsMap } from "../types";
import { notFound } from "../utils/errors";

// Los models devuelven filas con id; aquí se convierten a la forma de los JSON (mapa id -> datos, sin repetir el id).
const toPatientRecord = ({ id: _id, ...record }: Patient): PatientRecord => record;
const toTherapistRecord = ({ id: _id, ...record }: Therapist): TherapistRecord => record;

/** Pacientes y terapeutas ("usuarios" de la agenda). */
export const UsersService = {
      async listPatients(): Promise<PatientsMap> {
            const patients = await PatientModel.findAll();
            return Object.fromEntries(patients.map((p) => [p.id, toPatientRecord(p)]));
      },

      async getPatient(id: string): Promise<PatientRecord> {
            const patient = await PatientModel.findById(id);
            if (!patient) throw notFound(`No existe el paciente ${id}`);
            return toPatientRecord(patient);
      },

      async updatePatient(id: string, patch: Partial<PatientRecord>): Promise<PatientRecord> {
            const updated = await PatientModel.update(id, patch);
            if (!updated) throw notFound(`No existe el paciente ${id}`);
            return toPatientRecord(updated);
      },

      async listTherapists(): Promise<TherapistsMap> {
            const therapists = await TherapistModel.findAll();
            return Object.fromEntries(therapists.map((t) => [t.id, toTherapistRecord(t)]));
      },

      async getTherapist(id: string): Promise<TherapistRecord> {
            const therapist = await TherapistModel.findById(id);
            if (!therapist) throw notFound(`No existe el terapeuta ${id}`);
            return toTherapistRecord(therapist);
      },

      async updateTherapist(id: string, patch: Partial<TherapistRecord>): Promise<TherapistRecord> {
            const updated = await TherapistModel.update(id, patch);
            if (!updated) throw notFound(`No existe el terapeuta ${id}`);
            return toTherapistRecord(updated);
      },
};
