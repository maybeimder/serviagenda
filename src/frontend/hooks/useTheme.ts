import { useSyncExternalStore } from "react"

// Modo oscuro: clase .dark en <html>, persistido en localStorage; por defecto sigue prefers-color-scheme.
const KEY = "theme";
const listeners = new Set<() => void>();

function read(): boolean {
      try {
            const saved = localStorage.getItem(KEY);
            if (saved !== null) return saved === "dark";
      } catch { /* localStorage no disponible */ }
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

let dark = read();
const apply = () => document.documentElement.classList.toggle("dark", dark);
apply();

export function setDark(value: boolean) {
      dark = value;
      try { localStorage.setItem(KEY, value ? "dark" : "light"); } catch { /* ignorar */ }
      apply();
      listeners.forEach((l) => l());
}

export function useDarkMode(): [boolean, (value: boolean) => void] {
      const value = useSyncExternalStore(
            (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
            () => dark
      );
      return [value, setDark];
}
