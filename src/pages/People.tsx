import AppButton from "@/components/ui/AppButton"
import PeopleLister from "@/components/people/PeopleLister";
import { PersonCardProps } from "@/components/people/PersonCard";
import { Patients } from "@/data/data";
import { toTitleCase } from "@/utils/toTitleCase";
import { useState } from "react"

type Tab = "patients" | "therapists";

const people: PersonCardProps[] = Patients.map((p) => ({
      id: p.id,
      fullName: toTitleCase(p.name),
      city: p.city,
      authorizations: p.sessionsRequirements,
}));

export default function PeopleView() {
      const [activeTab, setActiveTab] = useState<Tab>("patients");

      return (
            <div className="w-full h-full py-8 flex flex-col gap-6">
                  <div className="flex gap-2">
                        <AppButton variant={activeTab === "patients"   ? "primary" : "secondary"} text="Pacientes"  onClick={() => setActiveTab("patients")}/>
                        <AppButton variant={activeTab === "therapists" ? "primary" : "secondary"} text="Terapeutas" onClick={() => setActiveTab("therapists")}/>
                  </div>
                  <div className="w-full flex-1 min-h-0 min-w-0 flex gap-2">
                              <PeopleLister collapsed={activeTab !== "patients"} people={people} />
                              <PeopleLister collapsed={activeTab === "patients"} people={[]} />
                  </div>
            </div>
      )
}
