export const sum = (values: Iterable<number | undefined>): number => {
      let total = 0;
      for (const v of values) total += v ?? 0;
      return total;
};
