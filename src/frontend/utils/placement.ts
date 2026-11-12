/** Margen mínimo entre un menú/tooltip y el borde de la ventana. */
export const EDGE = 8;

/** Mantiene un elemento de tamaño `size` dentro de [EDGE, max - EDGE]. */
export const keepInside = (value: number, size: number, max: number) =>
      Math.max(EDGE, Math.min(value, max - size - EDGE));

/**
 * Coloca un elemento al lado de `anchor`: a su izquierda si cabe (si no, a su derecha, y si tampoco, encima),
 * con el borde inferior alineado al del ancla y siempre dentro de la ventana.
 */
export function placeBeside(anchor: DOMRect, width: number, height: number) {
      const gap = 6;
      if (anchor.left - width - gap >= EDGE)
            return { left: anchor.left - width - gap, top: keepInside(anchor.bottom - height, height, window.innerHeight) };
      if (anchor.right + width + gap <= window.innerWidth - EDGE)
            return { left: anchor.right + gap, top: keepInside(anchor.bottom - height, height, window.innerHeight) };
      return placeAbove(anchor, width, height);
}

/** Coloca un elemento de `width`×`height` centrado sobre `anchor`, o debajo si arriba no cabe; siempre dentro de la ventana. */
export function placeAbove(anchor: DOMRect, width: number, height: number) {
      const above = anchor.top - height - 6 >= EDGE;
      return {
            left: keepInside(anchor.left + anchor.width / 2 - width / 2, width, window.innerWidth),
            top: keepInside(above ? anchor.top - height - 6 : anchor.bottom + 6, height, window.innerHeight),
      };
}
