import { useRef } from "react"
import { useAnimateReflow } from "@/hooks/useAnimateReflow"
import PersonCard, { PersonCardProps } from "./PersonCard"

type PeopleListerProps = {
      people : PersonCardProps[]
      collapsed? : boolean
}

export default function PeopleLister(props:PeopleListerProps) {
      const gridRef = useRef<HTMLDivElement>(null);
      useAnimateReflow(gridRef);
      return (
            <div
                  className={`
                        bg-neutral-50 px-4 rounded-xl shadow-xl min-w-0 overflow-hidden
                        transition-[flex] duration-300 ease-in-out py-4
                        ${props.collapsed ? "flex-[0_0_3rem]" : "flex-[1_1_0%]"}
                  `}
            >
                  <div
                        ref={gridRef}
                        className={`
                              relative w-full h-full p-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:#a3a3a3_transparent] grid grid-cols-[repeat(auto-fill,minmax(max(280px,calc((100%-1rem)/3)),1fr))] gap-2 content-start transition-opacity duration-150
                              ${props.collapsed ? "opacity-0 pointer-events-none [content-visibility:hidden]" : "opacity-100 delay-150"}
                        `}
                  >
                        {props.people.map((person) => (
                              <PersonCard key={person.id} person={person} />
                        ))}
                  </div>
            </div>
      )
}
