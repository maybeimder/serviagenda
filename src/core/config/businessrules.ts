export const CONFIG = {
      SessionDuration: 0.5,

      TravelMinutes: 30,

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
