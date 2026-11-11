import { Outlet, useMatches } from "react-router";
import Sidebar from "@/components/ui/Sidebar";

export default function AppLayout() {
      const matches = useMatches();
      const currentMatch = matches[matches.length - 1];
      const title = (currentMatch?.handle as { title?: string })?.title;

      return (
            <div className="flex relative w-full h-screen bg-neutral-100 px-8 py-16 gap-16 font-sans">
                  <Sidebar />

                  <main className="flex-1 min-w-0 min-h-0 flex flex-col">
                        <div className="flex-1 min-h-0 w-full gap-2 flex flex-col">
                              {title && (<h1 className="text-3xl font-semibold text-ink-700">{title}</h1>)}
                              <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden"> <Outlet/></div>
                        </div>
                  </main>
            </div>
      );
}
