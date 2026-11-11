import { Outlet, useMatches } from "react-router";
import Sidebar from "@/components/ui/Sidebar";
import AppButton from "@/components/ui/AppButton";
import { LucideIcon, Moon, Sun } from "lucide-react";
import { useDarkMode } from "@/hooks/useTheme";

export default function AppLayout() {
      const [dark, setDark] = useDarkMode();
      const matches = useMatches();
      const currentMatch = matches[matches.length - 1];
      const title = (currentMatch?.handle as { title?: string })?.title;
      const Icon  = (currentMatch?.handle as { icon?: LucideIcon })?.icon;

      return (
            <div className="flex relative w-full h-screen bg-neutral-100 px-8 py-16 gap-16 font-sans">
                  <Sidebar />

                  <div className="absolute top-4 right-4 z-40">
                        <AppButton
                              variant="icon-only" icon={dark ? Sun : Moon} iconSize={20}
                              tooltip={dark ? "Modo claro" : "Modo oscuro"} tooltipSide="left"
                              onClick={() => setDark(!dark)}
                        />
                  </div>

                  <main className="flex-1 min-w-0 min-h-0 flex flex-col">
                        <div className="flex-1 min-h-0 w-full gap-2 flex flex-col">
                              {title && (
                                    <span className="flex gap-4 items-center">
                                          {Icon && <Icon className="text-ink-700" size={28} />}
                                          <h1 className="text-3xl font-semibold text-ink-700">{title}</h1>
                                    </span>)}
                              <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden"> <Outlet/></div>
                        </div>
                  </main>
            </div>
      );
}
