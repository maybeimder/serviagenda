import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import AppLayout from "./AppLayout";
import PeopleView from "@/pages/People";
import CoordinateView from "@/pages/Coordinate";
import ScheduleView from "@/pages/Schedule";
import { Calendar, Route, Users } from "lucide-react";
import { currentMonth, monthLabel } from "@/utils/calendar";

const router = createBrowserRouter([
      {
            path: "/",
            element: < AppLayout />,
            children: [
                  { index: true           , element: <Navigate to="/people" replace /> },
                  { path: "people"        , element: <PeopleView/>      , handle: {title:"Personas", icon:Users}},
                  { path: "coordinate"    , element: <CoordinateView/>  , handle: {title:"Coordinar", icon:Route}},
                  { path: "schedule"      , element: <ScheduleView/>    , handle: {title:"Agenda", icon:Calendar, subtitle: monthLabel(currentMonth())}},
            ],
      },
]);

export default function App() {
      return <RouterProvider router={router} />;
}
