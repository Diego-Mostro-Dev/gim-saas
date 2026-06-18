import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Dumbbell, ClipboardList, Users, Activity } from "lucide-react";

import { useExercises } from "../hooks/useExercises";
import { useRoutineTemplates } from "../hooks/useRoutineTemplates";
import { useRoutineExercises } from "../hooks/useRoutineExercises";

import ExerciseForm from "../components/routines/ExerciseForm";
import ExerciseList from "../components/routines/ExerciseList";

import RoutineTemplateForm from "../components/routines/RoutineTemplateForm";
import RoutineTemplateList from "../components/routines/RoutineTemplateList";

import RoutineAssignment from "../components/routines/RoutineAssignment";
import ActiveRoutines from "../components/routines/ActiveRoutines";

import RoutineBuilder from "../components/routines/RoutineBuilder";

function Routines() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("exercises");

  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [editingExercise, setEditingExercise] = useState(null);

  const {
    exercises,
    loading: exercisesLoading,
    error: exercisesError,
    addExercise,
    editExercise,
    removeExercise,
  } = useExercises();

  const {
    templates,
    loading: templatesLoading,
    error: templatesError,
    addTemplate,
    editTemplate,
    removeTemplate,
  } = useRoutineTemplates();

  const { routineExercises, addRoutineExercise, editRoutineExercise, removeRoutineExercise } =
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
      label: "Asignadas",
      icon: Activity,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="mt-1 flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-primary transition hover:bg-surface-input"
        >
          <ArrowLeft size={18} />
          Volver al inicio
        </button>

        <div>
          <h1 className="text-2xl font-bold text-text-primary">Rutinas</h1>

          <p className="mt-1 text-sm text-text-secondary">
            Gestiona ejercicios, rutinas y asignaciones.
          </p>
        </div>
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
                  ? "border-info bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
                  : "border-border/10 bg-surface-elevated text-text-secondary hover:bg-surface-input"
              }`}
            >
              <Icon size={18} />

              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-5">
        {/* EJERCICIOS */}
        {activeTab === "exercises" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">Ejercicios</h2>

            <ExerciseForm
              onSubmit={
                editingExercise
                  ? (data) => editExercise(editingExercise.id, data)
                  : addExercise
              }
              editingExercise={editingExercise}
              onCancelEdit={() => setEditingExercise(null)}
            />

            {exercisesLoading && (
              <div className="rounded-xl border border-border p-6 text-center text-text-secondary">
                Cargando ejercicios...
              </div>
            )}

            {exercisesError && (
              <div className="rounded-xl bg-danger-bg dark:bg-danger/10 p-4 text-danger-text dark:text-danger">
                {exercisesError}
              </div>
            )}

            {!exercisesLoading && (
              <ExerciseList
                exercises={exercises}
                onEdit={(exercise) => {
                  setEditingExercise(exercise);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                onDelete={(exercise) => {
                  if (
                    window.confirm(
                      `¿Eliminar el ejercicio "${exercise.name}"?`
                    )
                  ) {
                    removeExercise(exercise.id);
                  }
                }}
              />
            )}
          </div>
        )}

        {/* RUTINAS */}
        {activeTab === "templates" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">Rutinas</h2>

            <RoutineTemplateForm onSubmit={addTemplate} />

            {templatesLoading && (
              <div className="rounded-xl border border-border p-6 text-center text-text-secondary">
                Cargando rutinas...
              </div>
            )}

            {templatesError && (
              <div className="rounded-xl bg-danger-bg dark:bg-danger/10 p-4 text-danger-text dark:text-danger">
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
                  <RoutineBuilder
                    template={selectedTemplate}
                    exercises={routineExercises.filter(
                      (item) => item.routine_template === selectedTemplate?.id,
                    )}
                    allExercises={exercises}
                    addRoutineExercise={addRoutineExercise}
                    editRoutineExercise={editRoutineExercise}
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
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              Asignaciones
            </h2>

            <RoutineAssignment />
          </div>
        )}

        {/* ACTIVAS */}
        {activeTab === "active" && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              Rutinas asignadas
            </h2>

            <ActiveRoutines />
          </div>
        )}
      </div>
    </div>
  );
}

export default Routines;
