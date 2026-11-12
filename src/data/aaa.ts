import type { Patient } from "@core/index";
import { writeFile } from "node:fs/promises";
import { Patients } from "./data.ts";

type PatientWithoutId = Omit<Patient, "id">;

export const patientsById: Record<string, PatientWithoutId> =
      Object.fromEntries(Patients.map(({ id, ...rest }) => [id, rest]));

async function saveToJson() {
      console.log("Total pacientes:", Patients.length);
      console.log("Keys de Patients:", Object.keys(Patients).slice(0, 5));
      console.log("Primer elemento:", Patients[0]);
      console.log("JSON directo de Patients:", JSON.stringify(Patients.slice(0, 2), null, 2));
      const jsonContent = JSON.stringify(patientsById, null, 2);
      await writeFile("src/data/patients.json", jsonContent, "utf-8");
      console.log("Archivo patients.json guardado con éxito");
}

saveToJson();
