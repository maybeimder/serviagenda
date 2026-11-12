import { useEffect } from "react"

type ElementRef = React.RefObject<HTMLElement | null>

/**
 * Llama a `onDismiss` al hacer clic fuera de `ref` o al presionar Escape, mientras `active` sea true.
 * `ref` puede ser una lista: un clic dentro de cualquiera de ellos no cuenta como "fuera" (p. ej. un botón y
 * su popover renderizado en un portal).
 */
export function useDismiss(ref: ElementRef | ElementRef[], active: boolean, onDismiss: () => void) {
      useEffect(() => {
            if (!active) return;
            const refs = Array.isArray(ref) ? ref : [ref];
            const close = (e: MouseEvent) => { if (!refs.some((r) => r.current?.contains(e.target as Node))) onDismiss(); };
            const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
            document.addEventListener("mousedown", close);
            document.addEventListener("keydown", esc);
            return () => {
                  document.removeEventListener("mousedown", close);
                  document.removeEventListener("keydown", esc);
            };
      }, [ref, active, onDismiss]);
}
