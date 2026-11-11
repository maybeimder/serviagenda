import { TimeRange } from "../types/base";

export const toMins = (hhmm: string): number => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
};

/** Slots completos de `slotMins` minutos que caben dentro del rango. */
export const rangeToSlots = (range: TimeRange | undefined, slotMins: number): Set<number> => {
      const slots = new Set<number>();
      if (!range) return slots;
      const first = Math.ceil(toMins(range.start) / slotMins);
      const last = Math.floor(toMins(range.end) / slotMins);
      for (let s = first; s < last; s++) slots.add(s);
      return slots;
};
