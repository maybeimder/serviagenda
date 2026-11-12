export const sum = (values: Iterable<number | undefined>): number => {
      let total = 0;
      for (const v of values) total += v ?? 0;
      return total;
};

export const pushTo = <K, V>(map: Map<K, V[]>, key: K, value: V): void => {
      const list = map.get(key);
      if (list) list.push(value);
      else map.set(key, [value]);
};
