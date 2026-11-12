/** Margen mínimo entre un menú/tooltip y el borde de la ventana. */
export const EDGE = 8;

/** Mantiene un elemento de tamaño `size` dentro de [EDGE, max - EDGE]. */
export const keepInside = (value: number, size: number, max: number) =>
      Math.max(EDGE, Math.min(value, max - size - EDGE));

/** Coloca un elemento de `width`×`height` centrado sobre `anchor`, o debajo si arriba no cabe; siempre dentro de la ventana. */
export function placeAbove(anchor: DOMRect, width: number, height: number) {
      const above = anchor.top - height - 6 >= EDGE;
      return {
            left: keepInside(anchor.left + anchor.width / 2 - width / 2, width, window.innerWidth),
            top: keepInside(above ? anchor.top - height - 6 : anchor.bottom + 6, height, window.innerHeight),
      };
}
