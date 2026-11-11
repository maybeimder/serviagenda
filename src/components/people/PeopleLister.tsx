import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import PersonCard, { PersonCardProps } from "./PersonCard"

type PeopleListerProps = {
      people : PersonCardProps[]
      collapsed? : boolean
}

const MIN_CARD_WIDTH = 280;
const MAX_COLUMNS = 3;
const GAP = 8;      // gap-2
const PADDING = 4;  // p-1

export default function PeopleLister(props:PeopleListerProps) {
      const scrollRef = useRef<HTMLDivElement>(null);
      const [columns, setColumns] = useState(MAX_COLUMNS);

      // Columnas según el ancho disponible: entre 1 y 3, cada una de al menos MIN_CARD_WIDTH
      useLayoutEffect(() => {
            const el = scrollRef.current;
            if (!el) return;
            const update = () => {
                  const width = el.clientWidth - PADDING * 2;
                  const cols = Math.floor((width + GAP) / (MIN_CARD_WIDTH + GAP));
                  setColumns(Math.min(MAX_COLUMNS, Math.max(1, cols)));
            };
            update();
            const observer = new ResizeObserver(update);
            observer.observe(el);
            return () => observer.disconnect();
      }, []);

      // Virtualización por filas: solo se montan las filas visibles (+ overscan)
      const rowCount = Math.ceil(props.people.length / columns);
      const virtualizer = useVirtualizer({
            count: rowCount,
            getScrollElement: () => scrollRef.current,
            estimateSize: () => 150,
            overscan: 2,
            gap: GAP,
      });

      useEffect(() => {
            virtualizer.measure();
      }, [columns, props.people, virtualizer]);

      useEffect(() => {
            scrollRef.current?.scrollTo({ top: 0 });
      }, [props.people]);

      return (
            <div
                  className={`
                        bg-neutral-50 px-4 rounded-xl shadow-xl min-w-0 overflow-hidden
                        transition-[flex] duration-300 ease-in-out py-4
                        ${props.collapsed ? "flex-[0_0_3rem]" : "flex-[1_1_0%]"}
                  `}
            >
                  <div
                        ref={scrollRef}
                        className={`
                              w-full h-full p-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:#a3a3a3_transparent] transition-opacity duration-150
                              ${props.collapsed ? "opacity-0 pointer-events-none" : "opacity-100 delay-150"}
                        `}
                  >
                        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
                              {!props.collapsed && virtualizer.getVirtualItems().map((row) => (
                                    <div
                                          key={row.key}
                                          data-index={row.index}
                                          ref={virtualizer.measureElement}
                                          className="absolute top-0 left-0 w-full grid gap-2"
                                          style={{
                                                transform: `translateY(${row.start}px)`,
                                                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                                          }}
                                    >
                                          {props.people
                                                .slice(row.index * columns, row.index * columns + columns)
                                                .map((person) => <PersonCard key={person.id} person={person} />)}
                                    </div>
                              ))}
                        </div>
                  </div>
            </div>
      )
}
