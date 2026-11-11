import { useSyncExternalStore } from "react"

// Modo "bajas animaciones": persistido en localStorage y expuesto como [data-low-motion] en <html>,
// que desactiva transiciones/animaciones CSS (ver index.css). Por defecto respeta prefers-reduced-motion.
const KEY = "low-motion";
const listeners = new Set<() => void>();

function read(): boolean {
      try {
            const saved = localStorage.getItem(KEY);
            if (saved !== null) return saved === "1";
      } catch { /* localStorage no disponible */ }
      return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

let current = read();
const apply = () => document.documentElement.toggleAttribute("data-low-motion", current);
apply();

export function setLowMotion(value: boolean) {
      current = value;
      try { localStorage.setItem(KEY, value ? "1" : "0"); } catch { /* ignorar */ }
      apply();
      listeners.forEach((l) => l());
}

export const getLowMotion = () => current;

export function useLowMotion(): [boolean, (value: boolean) => void] {
      const value = useSyncExternalStore(
            (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
            () => current
      );
      return [value, setLowMotion];
}
