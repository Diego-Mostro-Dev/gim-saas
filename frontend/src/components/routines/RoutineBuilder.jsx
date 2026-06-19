import { useState } from "react";
import { ChevronUp, ChevronDown, Pencil, Trash2, X, Check } from "lucide-react";

const EXERCISE_TYPES = [
  { value: "strength", label: "Fuerza" },
  { value: "bodyweight", label: "Peso corporal" },
  { value: "cardio", label: "Cardio" },
];

const REST_MODES = [
  { value: "between_sets", label: "Entre series" },
  { value: "after_exercise", label: "Al finalizar ejercicio" },
  { value: "none", label: "Sin descanso" },
];

function formatRestDisplay(seconds) {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + "min " + s + "s";
  }
  return String(seconds) + "s";
}

function formatRestShort(seconds) {
  if (seconds >= 60) {
    return Math.floor(seconds / 60) + "m";
  }
  return String(seconds) + "s";
}

function formatMobileExerciseSummary(exercise) {
  const parts = [];

  if (exercise.exercise_type === "cardio") {
    parts.push((exercise.reps || "0") + " min");
  } else {
    if (exercise.sets && exercise.reps) {
      parts.push(exercise.sets + "\u00d7" + exercise.reps);
    } else if (exercise.sets) {
      parts.push(exercise.sets + " series");
    }

    if (exercise.exercise_type === "bodyweight") {
      parts.push("PC");
    } else if (exercise.weight) {
      parts.push(exercise.weight + "kg");
    }
  }

  if (exercise.rest_seconds > 0) {
    parts.push(formatRestShort(exercise.rest_seconds));
  }

  return parts.join(" \u00b7 ");
}

function ExerciseRow({ exercise, index, total, onMoveUp, onMoveDown, onEdit, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    sets: exercise.sets,
    reps: exercise.reps,
    weight: exercise.weight,
    notes: exercise.notes,
    rest_seconds: exercise.rest_seconds,
    exercise_type: exercise.exercise_type,
    rest_mode: exercise.rest_mode || "between_sets",
    next_exercise_rest_seconds: exercise.next_exercise_rest_seconds || 0,
  });

  async function handleSave() {
    await onEdit(exercise.id, {
      order: exercise.order,
      sets: Number(form.sets),
      reps: form.reps,
      weight: form.weight,
      notes: form.notes,
      rest_seconds: Number(form.rest_seconds),
      exercise_type: form.exercise_type,
      rest_mode: form.rest_mode,
      next_exercise_rest_seconds: Number(form.next_exercise_rest_seconds),
    });
    setEditing(false);
  }

  function handleCancel() {
    setForm({
      sets: exercise.sets,
      reps: exercise.reps,
      weight: exercise.weight,
      notes: exercise.notes,
      rest_seconds: exercise.rest_seconds,
      exercise_type: exercise.exercise_type,
      rest_mode: exercise.rest_mode || "between_sets",
      next_exercise_rest_seconds: exercise.next_exercise_rest_seconds || 0,
    });
    setEditing(false);
  }

  const restMode = exercise.rest_mode || "between_sets";
  const restModeLabel = REST_MODES.find(function (rm) { return rm.value === restMode; })?.label || restMode;
  const restDisplay = formatRestDisplay(exercise.rest_seconds);
  const nextRestDisplay = String(exercise.next_exercise_rest_seconds || 0) + "s";
  const restLabel = restMode !== "none"
    ? " \u00b7 " + restDisplay + " descanso (" + restModeLabel.toLowerCase() + ")"
    : " \u00b7 sin descanso";

  if (editing) {
    return (
      <div className="rounded-xl border border-info/30 bg-info-bg/30 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="min-w-0 truncate font-medium text-text-primary">{exercise.exercise_name}</h4>
          <div className="flex shrink-0 gap-1">
            <button onClick={handleSave} className="rounded-lg p-1.5 text-success hover:bg-success/15" title="Guardar">
              <Check size={16} />
            </button>
            <button onClick={handleCancel} className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-input" title="Cancelar">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-text-secondary">Series</label>
            <input
              type="number" min="1"
              value={form.sets}
              onChange={(e) => setForm({ ...form, sets: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-secondary">Reps</label>
            <input
              value={form.reps}
              onChange={(e) => setForm({ ...form, reps: e.target.value })}
              placeholder="Ej: 10"
              className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-secondary">Peso (kg)</label>
            <input
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              placeholder="Ej: 60"
              className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-secondary">Descanso (seg)</label>
            <input
              type="number" min="0"
              value={form.rest_seconds}
              onChange={(e) => setForm({ ...form, rest_seconds: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-secondary">Antes del próximo (seg)</label>
            <input
              type="number" min="0"
              value={form.next_exercise_rest_seconds}
              onChange={(e) => setForm({ ...form, next_exercise_rest_seconds: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-secondary">Tipo</label>
            <select
              value={form.exercise_type}
              onChange={(e) => setForm({ ...form, exercise_type: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary"
            >
              {EXERCISE_TYPES.map(function (t) { return <option key={t.value} value={t.value}>{t.label}</option>; })}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs text-text-secondary">Descanso</label>
          <div className="flex flex-wrap gap-4">
            {REST_MODES.map(function (rm) {
              return (
                <label key={rm.value} className="flex items-center gap-1.5 text-sm text-text-primary cursor-pointer">
                  <input
                    type="radio"
                    name={"rest_mode_" + exercise.id}
                    value={rm.value}
                    checked={form.rest_mode === rm.value}
                    onChange={(e) => setForm({ ...form, rest_mode: e.target.value })}
                    className="accent-primary"
                  />
                  {rm.label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-2">
          <label className="mb-1 block text-xs text-text-secondary">Notas</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary"
          />
        </div>
      </div>
    );
  }

  const typeLabel = EXERCISE_TYPES.find(function (t) { return t.value === exercise.exercise_type; })?.label || exercise.exercise_type;

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-info-bg text-xs font-bold text-info-text dark:bg-info/15 dark:text-info">
              {index + 1}
            </span>
            <h4 className="font-medium text-text-primary truncate">{exercise.exercise_name}</h4>
            <span className="shrink-0 rounded bg-surface-input px-1.5 py-0.5 text-[10px] uppercase text-text-secondary">{typeLabel}</span>
          </div>

          <div className="ml-8 mt-1.5 text-sm text-text-secondary">
            <span className="sm:hidden truncate">
              {formatMobileExerciseSummary(exercise)}
            </span>
            <span className="hidden sm:inline">
              <span className="font-medium text-text-primary">{exercise.sets}</span> series
              {exercise.reps ? <> &middot; <span className="font-medium text-text-primary">{exercise.reps}</span> reps</> : null}
              {exercise.weight ? <> &middot; <span className="font-medium text-text-primary">{exercise.weight}</span> kg</> : null}
              <span>{restLabel}</span>
              {Number(exercise.next_exercise_rest_seconds) > 0 ? (
                <> &middot; próximo: {formatRestDisplay(exercise.next_exercise_rest_seconds)}</>
              ) : null}
            </span>
          </div>

          {exercise.notes && (
            <p className="ml-8 mt-1 text-sm italic text-text-secondary">{exercise.notes}</p>
          )}
        </div>

        <div className="flex shrink-0 gap-0.5">
          <button
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className="rounded p-1.5 text-text-secondary hover:bg-surface-input disabled:opacity-30"
            title="Subir"
          >
            <ChevronUp size={16} />
          </button>

          <button
            onClick={() => onMoveDown(index)}
            disabled={index === total - 1}
            className="rounded p-1.5 text-text-secondary hover:bg-surface-input disabled:opacity-30"
            title="Bajar"
          >
            <ChevronDown size={16} />
          </button>

          <button
            onClick={function () { setEditing(true); }}
            className="rounded p-1.5 text-text-secondary hover:bg-surface-input"
            title="Editar"
          >
            <Pencil size={16} />
          </button>

          <button
            onClick={function () { onRemove(exercise.id); }}
            className="rounded p-1.5 text-text-secondary hover:bg-danger/15 hover:text-danger"
            title="Eliminar"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function RoutineBuilder({
  template,
  exercises,
  allExercises,
  addRoutineExercise,
  editRoutineExercise,
  removeRoutineExercise,
  editTemplate,
  removeTemplate,
  onTemplateDeleted,
}) {
  const [formData, setFormData] = useState({
    exercise: "",
    sets: 3,
    reps: "",
    weight: "",
    notes: "",
    rest_seconds: 60,
    exercise_type: "strength",
    rest_mode: "between_sets",
    next_exercise_rest_seconds: 0,
  });

  if (!template) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-text-secondary">
        Selecciona una rutina para verla.
      </div>
    );
  }

  const sortedExercises = exercises ? [...exercises].sort(function (a, b) { return a.order - b.order; }) : [];

  async function handleAddExercise(e) {
    e.preventDefault();
    if (!formData.exercise) return;

    var maxOrder = sortedExercises.reduce(function (max, ex) { return Math.max(max, ex.order); }, 0);

    await addRoutineExercise({
      routine_template: template.id,
      exercise: Number(formData.exercise),
      order: maxOrder + 1,
      sets: Number(formData.sets),
      reps: formData.reps,
      weight: formData.weight,
      notes: formData.notes,
      rest_seconds: Number(formData.rest_seconds),
      exercise_type: formData.exercise_type,
      rest_mode: formData.rest_mode,
      next_exercise_rest_seconds: Number(formData.next_exercise_rest_seconds),
    });

    setFormData({
      exercise: "",
      sets: 3,
      reps: "",
      weight: "",
      notes: "",
      rest_seconds: 60,
      exercise_type: "strength",
      rest_mode: "between_sets",
      next_exercise_rest_seconds: 0,
    });
  }

  async function handleEditExercise(id, data) {
    await editRoutineExercise(id, data);
  }

  async function handleMoveUp(index) {
    var current = sortedExercises[index];
    var above = sortedExercises[index - 1];
    if (!above) return;

    await editRoutineExercise(current.id, { order: above.order });
    await editRoutineExercise(above.id, { order: current.order });
  }

  async function handleMoveDown(index) {
    var current = sortedExercises[index];
    var below = sortedExercises[index + 1];
    if (!below) return;

    await editRoutineExercise(current.id, { order: below.order });
    await editRoutineExercise(below.id, { order: current.order });
  }

  async function handleRename() {
    var newName = prompt("Nuevo nombre de la rutina", template.name);
    if (!newName || !newName.trim()) return;
    await editTemplate(template.id, { name: newName });
    window.location.reload();
  }

  async function handleDeleteTemplate() {
    var confirmed = window.confirm("Eliminar la rutina \"" + template.name + "\"?");
    if (!confirmed) return;
    await removeTemplate(template.id);
    if (onTemplateDeleted) onTemplateDeleted();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-info/20 bg-info-bg/50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-text-primary">{template.name}</h2>
            <p className="text-sm text-text-secondary">{sortedExercises.length} ejercicios</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={handleRename} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white">
              Renombrar
            </button>
            <button onClick={handleDeleteTemplate} className="rounded-lg bg-danger px-3 py-2 text-sm font-medium text-white">
              Eliminar rutina
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleAddExercise} className="space-y-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <h3 className="font-semibold text-text-primary">Agregar ejercicio</h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            value={formData.exercise}
            onChange={(e) => setFormData({ ...formData, exercise: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary"
          >
            <option value="">Seleccionar ejercicio</option>
            {allExercises.map(function (ex) { return <option key={ex.id} value={ex.id}>{ex.name}</option>; })}
          </select>

          <select
            value={formData.exercise_type}
            onChange={(e) => setFormData({ ...formData, exercise_type: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary"
          >
            <option value="strength">Fuerza</option>
            <option value="bodyweight">Peso corporal</option>
            <option value="cardio">Cardio</option>
          </select>

          <div>
            <label className="mb-1 block text-xs text-text-secondary">Series</label>
            <input
              type="number" min="1"
              value={formData.sets}
              onChange={(e) => setFormData({ ...formData, sets: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-secondary">Reps</label>
            <input
              value={formData.reps}
              onChange={(e) => setFormData({ ...formData, reps: e.target.value })}
              placeholder="Ej: 10"
              className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-secondary">Peso (kg)</label>
            <input
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
              placeholder="Ej: 60"
              className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-secondary">Descanso (segundos)</label>
            <input
              type="number" min="0"
              value={formData.rest_seconds}
              onChange={(e) => setFormData({ ...formData, rest_seconds: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-secondary">Antes del próximo (seg)</label>
            <input
              type="number" min="0"
              value={formData.next_exercise_rest_seconds}
              onChange={(e) => setFormData({ ...formData, next_exercise_rest_seconds: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-text-secondary">Modo de descanso</label>
          <div className="flex flex-wrap gap-4">
            {REST_MODES.map(function (rm) {
              return (
                <label key={rm.value} className="flex items-center gap-1.5 text-sm text-text-primary cursor-pointer">
                  <input
                    type="radio"
                    name="rest_mode_add"
                    value={rm.value}
                    checked={formData.rest_mode === rm.value}
                    onChange={(e) => setFormData({ ...formData, rest_mode: e.target.value })}
                    className="accent-primary"
                  />
                  {rm.label}
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-text-secondary">Notas</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
            placeholder="Indicaciones para el alumno"
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary"
          />
        </div>

        <button type="submit" className="w-full rounded-xl bg-blue-500 py-3 font-medium text-white">
          Agregar ejercicio
        </button>
      </form>

      {sortedExercises.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-text-secondary">
          Esta rutina todavía no tiene ejercicios.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedExercises.map(function (exercise, index) { return (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              index={index}
              total={sortedExercises.length}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onEdit={handleEditExercise}
              onRemove={removeRoutineExercise}
            />
          ); })}
        </div>
      )}
    </div>
  );
}

export default RoutineBuilder;
