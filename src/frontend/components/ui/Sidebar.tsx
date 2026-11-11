import { Calendar, Route, Users } from "lucide-react";
import AppButton, { AppButtonProps } from "./AppButton";
import { Fragment } from "react";
import { NavLink } from "react-router";

const sidebarItems: Record<string, (AppButtonProps&{to?:string })[]> = {
      info: [
            { icon: Users, variant: "icon-only", tooltip:"Personas", to:"/people"},
      ],

      operations: [
            { icon: Route, variant: "icon-only", tooltip:"Coordinar", to:"/coordinate"},
            { icon: Calendar, variant: "icon-only", tooltip:"Agendar", to:"/schedule"},
      ],


};

export default function Sidebar() {
      return (
            <div className="w-fit h-[70dvh] self-center p-4 flex flex-col gap-5 items-center">
                  {Object.entries(sidebarItems).map(([section, items]) => (
                        <Fragment key={section}>
                              <div className="flex flex-col items-center gap-4">
                                    {items.map((item) => (
                                          <NavLink key={item.to} to={item.to??"#"} className="outline-none">
                                                {({ isActive }) => (
                                                      <AppButton icon={item.icon} variant="icon-only" tooltip={item.tooltip} active={isActive}/>
                                                )}
                                          </NavLink>
                                    ))}
                              </div>
                              <div className="w-[50%] h-px bg-ink-400 last:hidden" />
                        </Fragment>
                  ))}
            </div>
      );
}
