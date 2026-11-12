import patientsJson from "./patients.json";
import therapistsJson from "./therapists.json";
import type { Patient, Therapist } from "../core/types/dtos";

// Las fuentes de verdad son patients.json y therapists.json (mapas id -> datos); aquí se exponen como listas.
export const Patients = Object.entries(patientsJson).map(([id, p]) => ({ id, ...p })) as unknown as Patient[];
export const Therapists = Object.entries(therapistsJson).map(([id, t]) => ({ id, ...t })) as unknown as Therapist[];
