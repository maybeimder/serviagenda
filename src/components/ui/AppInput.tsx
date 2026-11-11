import { Search } from "lucide-react";

type AppInputProps = {
      value: string
      onChange: (value: string) => void
}

export default function AppInput({ value, onChange }: AppInputProps) {
      return (
            <div className="bg-neutral-50 w-full h-10 rounded-3xl shadow-sm flex items-center px-4 gap-2">
                  <Search size={20} />
                  <input
                        type="search"
                        name="search"
                        id="search"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="outline-none w-full"
                        placeholder="Buscar paciente o terapeuta"
                  />
            </div>
      )
}
