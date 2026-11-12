import { Area, City, Day, Schedule, TimeRange } from "./base"

export type Patient = {
      id: string,
      name: string,
      city: City,
      disponibility: {
            home?: Schedule,
            site: Schedule,
      }

      sessionsRequirements: Partial<Record<Area, number>>
}

export type Therapist = {
      id: string,
      name: string,
      disponibility: Schedule,
      city: City,
}

export type Session = {
      id: string,
      day: Day,
      schedule: TimeRange,
      therapist: Therapist,
      patient: Patient[],
      areaPerPatient: Record<string, Area>
      crossed: boolean,
      atHome: boolean,
}
