import { Area, City, Schedule } from "./base"

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
