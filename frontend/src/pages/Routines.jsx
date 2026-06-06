import { useState } from "react";
import { Dumbbell, ClipboardList, Users, Activity } from "lucide-react";

function Routines() {
  const [activeTab, setActiveTab] = useState("exercises");

  const tabs = [
    {
      id: "exercises",
      label: "Ejercicios",
      icon: Dumbbell,
    },
    {
      id: "templates",
      label: "Plantillas",
      icon: ClipboardList,
    },
    {
      id: "assignments",
      label: "Asignaciones",
      icon: Users,
    },
    {
      id: "active",
      label: "Activas",
      icon: Activity,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Rutinas</h1>

        <p className="mt-1 text-sm text-zinc-400">
          Gestiona ejercicios, plantillas y asignaciones.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 transition ${
                activeTab === tab.id
                  ? "border-blue-500 bg-blue-500/10 text-blue-300"
                  : "border-white/10 bg-[#201f1f] text-zinc-400 hover:bg-[#2a2a2a]"
              }`}
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-5">
        {activeTab === "exercises" && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-white">
              Ejercicios
            </h2>

            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-zinc-500">
              Próximamente listado de ejercicios
            </div>
          </div>
        )}

        {activeTab === "templates" && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-white">
              Plantillas
            </h2>

            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-zinc-500">
              Próximamente listado de plantillas
            </div>
          </div>
        )}

        {activeTab === "assignments" && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-white">
              Asignaciones
            </h2>

            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-zinc-500">
              Próximamente asignación masiva de rutinas
            </div>
          </div>
        )}

        {activeTab === "active" && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-white">
              Rutinas activas
            </h2>

            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-zinc-500">
              Próximamente listado de rutinas activas
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Routines;
