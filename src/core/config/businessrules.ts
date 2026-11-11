export const CONFIG = {
      SessionDuration: 0.5,

      /** hueco mínimo entre dos sesiones de un mismo terapeuta en lugares distintos (sede <-> casa, casa de A <-> casa de B) */
      TravelMinutes: 30,

      /** los requerimientos de los pacientes son mensuales; se planifican semana a semana */
      WeeksPerMonth: 4,

      PatientRelated: {
            maxDailyHours: 10,
            maxTherapists: 4,
      },

      TherapistRelated: {
            WeeklyHours: { max: 42, min: 20 },
            PatientsAtTheSameTime: { max: 3, min: 1 },
      },
}
