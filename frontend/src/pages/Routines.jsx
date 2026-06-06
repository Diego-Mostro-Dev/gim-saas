import { useState } from "react";
import { Dumbbell, ClipboardList, Users, Activity } from "lucide-react";

import { useExercises } from "../hooks/useExercises";
import { useRoutineTemplates } from "../hooks/useRoutineTemplates";
import { useRoutineExercises } from "../hooks/useRoutineExercises";

import ExerciseForm from "../components/routines/ExerciseForm";
import ExerciseList from "../components/routines/ExerciseList";

import RoutineTemplateForm from "../components/routines/RoutineTemplateForm";
import RoutineTemplateList from "../components/routines/RoutineTemplateList";

import RoutineAssignment from "../components/routines/RoutineAssignment";
import ActiveRoutines from "../components/routines/ActiveRoutines";

import TemplateDetails from "../components/routines/TemplateDetails";

function Routines() {
  const [activeTab, setActiveTab] = useState("exercises");

  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const {
    exercises,
    loading: exercisesLoading,
    error: exercisesError,
    addExercise,
  } = useExercises();

  const {
    templates,
    loading: templatesLoading,
    error: templatesError,
    addTemplate,
    editTemplate,
    removeTemplate,
  } = useRoutineTemplates();

  const { routineExercises, addRoutineExercise, removeRoutineExercise } =
    useRoutineExercises();

  const tabs = [
    {
      id: "exercises",
      label: "Ejercicios",
      icon: Dumbbell,
    },
    {
      id: "templates",
      label: "Rutinas",
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
        {/* EJERCICIOS */}
        {activeTab === "exercises" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Ejercicios</h2>

            <ExerciseForm onSubmit={addExercise} />

            {exercisesLoading && (
              <div className="rounded-xl border border-white/10 p-6 text-center text-zinc-400">
                Cargando ejercicios...
              </div>
            )}

            {exercisesError && (
              <div className="rounded-xl bg-red-500/10 p-4 text-red-300">
                {exercisesError}
              </div>
            )}

            {!exercisesLoading && <ExerciseList exercises={exercises} />}
          </div>
        )}

        {/* RUTINAS */}
        {activeTab === "templates" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Rutinas</h2>

            <RoutineTemplateForm onSubmit={addTemplate} />

            {templatesLoading && (
              <div className="rounded-xl border border-white/10 p-6 text-center text-zinc-400">
                Cargando rutinas...
              </div>
            )}

            {templatesError && (
              <div className="rounded-xl bg-red-500/10 p-4 text-red-300">
                {templatesError}
              </div>
            )}

            {!templatesLoading && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* LISTA DE RUTINAS */}
                <div>
                  <RoutineTemplateList
                    templates={templates}
                    selectedTemplate={selectedTemplate}
                    onSelectTemplate={setSelectedTemplate}
                  />
                </div>

                {/* DETALLE DE LA RUTINA  */}
                <div>
                  <TemplateDetails
                    template={selectedTemplate}
                    exercises={routineExercises.filter(
                      (item) => item.routine_template === selectedTemplate?.id,
                    )}
                    allExercises={exercises}
                    addRoutineExercise={addRoutineExercise}
                    removeRoutineExercise={removeRoutineExercise}
                    editTemplate={editTemplate}
                    removeTemplate={removeTemplate}
                    onTemplateDeleted={() => setSelectedTemplate(null)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ASIGNACIONES */}
        {activeTab === "assignments" && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-white">
              Asignaciones
            </h2>

            <RoutineAssignment />
          </div>
        )}

        {/* ACTIVAS */}
        {activeTab === "active" && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-white">
              Rutinas activas
            </h2>

            <ActiveRoutines />
          </div>
        )}
      </div>
    </div>
  );
}

export default Routines;
