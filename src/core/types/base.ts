export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
export type TimeRange = { start: string, end: string }
export type Schedule = Partial<Record<Day, TimeRange>>

export type Area = "fono" | "fisio" | "teo" | "psico" | "acom" | "inte" | "neuro"
export type City = "CTG" | "STM" | "NVA"
