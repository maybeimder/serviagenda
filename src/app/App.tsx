import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import AppLayout from "./AppLayout";
import PeopleView from "@/pages/People";
import CoordinateView from "@/pages/Coordinate";
import ScheduleView from "@/pages/Schedule";

const router = createBrowserRouter([
      {
            path: "/",
            element: < AppLayout />,
            children: [
                  { index: true           , element: <Navigate to="/people" replace /> },
                  { path: "people"        , element: <PeopleView/>      , handle: {title:"Personas"} },
                  { path: "coordinate"    , element: <CoordinateView/>  , handle: {title:"Coordinar"}},
                  { path: "schedule"      , element: <ScheduleView/>    , handle: {title:"Agenda"}},
            ],
      },
]);

export default function App() {
      return <RouterProvider router={router} />;
}
