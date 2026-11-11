import { useEffect } from "react"

/** Llama a `onDismiss` al hacer clic fuera de `ref` o al presionar Escape, mientras `active` sea true. */
export function useDismiss(ref: React.RefObject<HTMLElement | null>, active: boolean, onDismiss: () => void) {
      useEffect(() => {
            if (!active) return;
            const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onDismiss(); };
            const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
            document.addEventListener("mousedown", close);
            document.addEventListener("keydown", esc);
            return () => {
                  document.removeEventListener("mousedown", close);
                  document.removeEventListener("keydown", esc);
            };
      }, [ref, active, onDismiss]);
}
