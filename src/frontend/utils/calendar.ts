import type { Day } from "@core/types/base";

/** `month` va de 0 (enero) a 11, como en Date. */
export type MonthRef = { year: number, month: number };

/** Un día de una semana del calendario. `inMonth` es false para los días de los meses vecinos que completan la semana. */
export type CalendarDay = { day: Day, dayOfMonth: number, inMonth: boolean, isToday: boolean };

/** Semana del calendario: domingo a sábado. `number` empieza en 1. */
export type CalendarWeek = { number: number, days: CalendarDay[] };

/** Día de la semana de `Date.getDay()` (0 = domingo). */
const DAY_BY_INDEX: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const currentMonth = (now = new Date()): MonthRef => ({ year: now.getFullYear(), month: now.getMonth() });

/** "Noviembre 2026" */
export function monthLabel({ year, month }: MonthRef): string {
      const name = new Intl.DateTimeFormat("es", { month: "long" }).format(new Date(year, month, 1));
      return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

/**
 * Las semanas del mes tal como se ven en un calendario (domingo a sábado): la semana 1 es la que contiene el día 1, y la
 * última, la que contiene el último día. Los días que caen en el mes anterior o el siguiente quedan con `inMonth: false`.
 * Noviembre de 2026 empieza en domingo: Semana 1 = Dom 1 … Sáb 7, y la Semana 5 solo tiene Dom 29 y Lun 30.
 */
export function weeksOfMonth({ year, month }: MonthRef, now = new Date()): CalendarWeek[] {
      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);
      const start = new Date(year, month, 1 - first.getDay()); // el domingo de la semana del día 1
      const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

      const weeks: CalendarWeek[] = [];
      for (let cursor = new Date(start); cursor <= last; cursor.setDate(cursor.getDate() + 7)) {
            const days: CalendarDay[] = Array.from({ length: 7 }, (_, i) => {
                  const date = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i);
                  return {
                        day: DAY_BY_INDEX[date.getDay()], dayOfMonth: date.getDate(),
                        inMonth: date.getMonth() === month && date.getFullYear() === year, isToday: sameDay(date, now),
                  };
            });
            weeks.push({ number: weeks.length + 1, days });
      }
      return weeks;
}

/** Número de la semana (desde 1) que contiene el día de hoy, o 1 si hoy no cae en ese mes. */
export function weekOfToday(weeks: CalendarWeek[]): number {
      return weeks.find((w) => w.days.some((d) => d.isToday && d.inMonth))?.number ?? 1;
}
