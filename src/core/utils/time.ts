import { TimeRange } from "../types/base";

export const toMins = (hhmm: string): number => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
};

export const pad = (n: number): string => String(n).padStart(2, "0");

export const minsToTime = (mins: number): string => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

export const slotToTime = (slot: number, slotMins: number): string => minsToTime(slot * slotMins);

export const timeToSlot = (hhmm: string, slotMins: number): number => Math.floor(toMins(hhmm) / slotMins);

export const rangeToSlots = (range: TimeRange | undefined, slotMins: number): Set<number> => {
      const slots = new Set<number>();
      if (!range) return slots;
      const first = Math.ceil(toMins(range.start) / slotMins);
      const last = Math.floor(toMins(range.end) / slotMins);
      for (let s = first; s < last; s++) slots.add(s);
      return slots;
};
