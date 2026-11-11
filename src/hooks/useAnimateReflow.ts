import { useEffect } from "react"
import { useLowMotion } from "./useLowMotion"

// Anima (FLIP) los hijos directos del contenedor cuando cambian de posición por un reflow
// (wrap de badges, cambio de columnas de una grilla, etc). El contenedor debe ser `relative`.
// Solo anima los hijos visibles en el viewport del contenedor, y lee todas las posiciones
// antes de animar para no forzar reflows intercalados.
export function useAnimateReflow(ref: React.RefObject<HTMLElement | null>) {
      const [lowMotion] = useLowMotion();
      useEffect(() => {
            const container = ref.current;
            if (!container || lowMotion) return;
            const prev = new Map<Element, { x: number; y: number }>();

            const snapshot = () => {
                  const children = Array.from(container.children) as HTMLElement[];
                  const top = container.scrollTop;
                  const bottom = top + container.clientHeight;
                  const moves: { el: HTMLElement; dx: number; dy: number }[] = [];

                  const positions = children.map((el) => ({ el, x: el.offsetLeft, y: el.offsetTop, h: el.offsetHeight }));
                  for (const { el, x, y, h } of positions) {
                        const old = prev.get(el);
                        const visible = y + h >= top && y <= bottom;
                        if (old && visible && (old.x !== x || old.y !== y)) {
                              moves.push({ el, dx: old.x - x, dy: old.y - y });
                        }
                        prev.set(el, { x, y });
                  }

                  for (const { el, dx, dy } of moves) {
                        el.animate(
                              [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
                              { duration: 300, easing: "ease-in-out" }
                        );
                  }
            };

            snapshot();
            const observer = new ResizeObserver(snapshot);
            observer.observe(container);
            return () => observer.disconnect();
      }, [ref, lowMotion]);
}
