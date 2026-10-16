import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Ban,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  EyeOff,
  Layers,
  Link2,
  ListChecks,
  Play,
  Repeat,
  ShieldAlert,
  UserPlus,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-border bg-surface-elevated p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Pill({ className = "", children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${className}`}>
      {children}
    </span>
  );
}

const COLOR_CLASSES = {
  success: "bg-success-bg text-success-text dark:bg-success/15 dark:text-success",
  warning: "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning",
  danger: "bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger",
  info: "bg-info-bg text-info-text dark:bg-info/15 dark:text-info",
  muted: "bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted",
};

const BLOQUES = [
  {
    key: "ex",
    titulo: "Ejercicio",
    modelo: "Exercise",
    icono: Dumbbell,
    color: "info",
    detalle: "Un movimiento del catálogo del gimnasio (Press banca, Sentadilla).",
  },
  {
    key: "tpl",
    titulo: "Plantilla",
    modelo: "RoutineTemplate",
    icono: Layers,
    color: "info",
    detalle: "Un plan con nombre que agrupa ejercicios; todavía sin socio.",
  },
  {
    key: "re",
    titulo: "Ejercicio de rutina",
    modelo: "RoutineExercise",
    icono: ClipboardList,
    color: "warning",
    detalle: "Una fila del plan: orden, series, reps, peso y descanso.",
  },
  {
    key: "as",
    titulo: "Asignación",
    modelo: "RoutineAssignment",
    icono: UserPlus,
    color: "success",
    detalle: "El enganche plantilla ↔ socio. Es la rutina que el socio \"tiene\".",
  },
  {
    key: "ws",
    titulo: "Registro",
    modelo: "WorkoutSet",
    icono: ListChecks,
    color: "success",
    detalle: "Cada serie que el socio marca como hecha al entrenar.",
  },
];

function QueEsRutina() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Dumbbell size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Qué es una rutina</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El plan de entrenamiento que el gimnasio le arma a un socio. Se construye con cinco piezas,
        siempre en el mismo orden.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {BLOQUES.map((b) => {
          const Icon = b.icono;
          return (
            <div key={b.key} className="flex flex-col rounded-xl border border-border bg-surface p-4">
              <span className={`inline-flex size-9 items-center justify-center rounded-lg ${COLOR_CLASSES[b.color]}`}>
                <Icon size={18} />
              </span>
              <p className="mt-2 text-sm font-semibold text-text-primary">{b.titulo}</p>
              <p className="mt-0.5 font-mono text-[11px] text-text-secondary">{b.modelo}</p>
              <p className="mt-1 text-xs text-text-secondary">{b.detalle}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <Ban size={18} className="text-danger-text dark:text-danger" />
          <p className="mt-2 text-sm font-semibold text-text-primary">No es entrenamiento personal</p>
          <p className="mt-1 text-xs text-text-secondary">
            El PT (1 a 1 con un profe, con paquete y facturación) es otro módulo aparte.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <ClipboardList size={18} className="text-success-text dark:text-success" />
          <p className="mt-2 text-sm font-semibold text-text-primary">Sí es un plan del socio</p>
          <p className="mt-1 text-xs text-text-secondary">
            El socio lo sigue por su cuenta desde el portal, serie por serie.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <XCircle size={18} className="text-warning-text dark:text-warning" />
          <p className="mt-2 text-sm font-semibold text-text-primary">No es recuperar clases</p>
          <p className="mt-1 text-xs text-text-secondary">
            Eso es recuperación de sesiones (SessionRecovery), con su propio portal.
          </p>
        </div>
      </div>
    </Card>
  );
}

const CATEGORIAS = [
  "Pecho",
  "Espalda",
  "Piernas",
  "Hombros",
  "Bíceps",
  "Tríceps",
  "Core",
  "Cardio",
  "Movilidad",
];

function CatalogoEjercicios() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Dumbbell size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">El catálogo de ejercicios</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El catálogo es de cada gimnasio. Cada ejercicio tiene nombre, descripción opcional y una
        categoría. El borrado es lógico: no se elimina la fila.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {CATEGORIAS.map((c) => (
          <Pill key={c} className={COLOR_CLASSES.info}>
            {c}
          </Pill>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        <EyeOff size={16} className="mt-0.5 shrink-0" />
        <span>
          Borrar un ejercicio sólo lo marca como <span className="font-medium">inactivo</span> y
          además desactiva sus filas en todas las rutinas. La pantalla usa la vista que oculta los
          inactivos, pero el dato sigue guardado.
        </span>
      </div>
    </Card>
  );
}

const CAMPOS_FILA = [
  { campo: "order", texto: "Orden del ejercicio en la rutina." },
  { campo: "sets", texto: "Cantidad de series." },
  { campo: "reps", texto: "Repeticiones. Texto libre: \"12\", \"10-12\", \"al fallo\"." },
  { campo: "weight", texto: "Peso. También texto libre." },
  { campo: "notes", texto: "Notas para el socio." },
  { campo: "rest_seconds", texto: "Cuántos segundos descansar." },
  { campo: "rest_mode", texto: "Entre series, al finalizar el ejercicio, o sin descanso." },
  { campo: "next_exercise_rest_seconds", texto: "Descanso extra antes del próximo ejercicio." },
  { campo: "exercise_type", texto: "Fuerza, peso corporal o cardio. Cambia cómo se muestra." },
];

const FILAS_EJEMPLO = [
  { orden: 1, nombre: "Press banca", sets: 4, reps: "10", peso: "40 kg", descanso: "90s entre series" },
  { orden: 2, nombre: "Sentadilla", sets: 4, reps: "8-10", peso: "60 kg", descanso: "al finalizar ejercicio" },
  { orden: 3, nombre: "Cinta", sets: 1, reps: "20 min", peso: "—", descanso: "sin descanso", tipo: "cardio" },
];

function ArmarRutina() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <ClipboardList size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Cómo se arma una rutina</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        La plantilla es sólo un nombre; el contenido son sus filas ordenadas. Así se ve una rutina
        armada en el constructor:
      </p>

      <div className="mt-5 space-y-2">
        {FILAS_EJEMPLO.map((f) => (
          <div
            key={f.orden}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-surface px-3 py-2"
          >
            <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${COLOR_CLASSES.muted}`}>
              {f.orden}
            </span>
            <span className="text-sm font-semibold text-text-primary">{f.nombre}</span>
            <span className="text-xs text-text-secondary">
              {f.sets} × {f.reps}
            </span>
            <span className="text-xs text-text-secondary">{f.peso}</span>
            <span className="ml-auto flex items-center gap-1 text-xs text-text-secondary">
              <Repeat size={12} />
              {f.descanso}
            </span>
            {f.tipo === "cardio" && (
              <Pill className={COLOR_CLASSES.warning}>Cardio</Pill>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {CAMPOS_FILA.map((c) => (
          <div key={c.campo} className="rounded-lg border border-border bg-surface p-3">
            <p className="font-mono text-[11px] text-info-text dark:text-info">{c.campo}</p>
            <p className="mt-1 text-xs text-text-secondary">{c.texto}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

const ASIGNAR_PASOS = [
  { titulo: "Elegir la plantilla", detalle: "Se selecciona una rutina ya armada." },
  { titulo: "Elegir los socios", detalle: "Uno o varios a la vez." },
  { titulo: "Desactivar la anterior", detalle: "Por cada socio, se apaga su rutina activa previa." },
  { titulo: "Crear la nueva", detalle: "Se crea una asignación activa nueva con la plantilla elegida." },
];

function AsignarRutina() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <UserPlus size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Cómo se asigna</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Es una asignación en lote: una plantilla para varios socios. El servidor lo hace por cada
        socio, uno por uno.
      </p>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        {ASIGNAR_PASOS.map((p, i) => (
          <div key={p.titulo} className="flex flex-1 items-center gap-3">
            <div className="flex-1 rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-text-primary">{p.titulo}</p>
              <p className="mt-1 text-xs text-text-secondary">{p.detalle}</p>
            </div>
            {i < ASIGNAR_PASOS.length - 1 && (
              <ArrowRight size={16} className="hidden shrink-0 text-text-secondary lg:block" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-text dark:bg-warning/15 dark:text-warning">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>
          La regla "una rutina activa por socio" es una <span className="font-medium">convención de la
          interfaz</span>: la base no la exige y el alta no es atómica. Un doble envío puede dejar
          estados intermedios.
        </span>
      </div>
    </Card>
  );
}

const EJECUCION_PASOS = [
  "Abrir el portal con el link del socio",
  "Entrar a la pestaña Rutina",
  "Ver los ejercicios en orden",
  "Marcar cada serie como hecha",
  "Descansar con el temporizador",
  "Ver la barra de progreso",
];

const SERIES_EJEMPLO = [
  { n: 1, hecha: true },
  { n: 2, hecha: true },
  { n: 3, hecha: false },
  { n: 4, hecha: false },
];

function SocioEjecuta() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Activity size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Qué hace el socio</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El socio entra con un link con token, sin usuario ni contraseña. En la pestaña Rutina marca
        las series que va completando.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <ol className="space-y-2">
          {EJECUCION_PASOS.map((paso, i) => (
            <li
              key={paso}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3 text-sm text-text-secondary"
            >
              <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${COLOR_CLASSES.muted}`}>
                {i + 1}
              </span>
              {paso}
            </li>
          ))}
        </ol>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">Press banca</p>
            <p className="text-xs text-text-secondary">2 de 4 series</p>
          </div>
          <div className="mt-3 space-y-2">
            {SERIES_EJEMPLO.map((s) => (
              <div
                key={s.n}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  s.hecha
                    ? "border-success/30 bg-success-bg text-success-text dark:bg-success/10 dark:text-success"
                    : "border-border bg-surface-elevated text-text-secondary"
                }`}
              >
                {s.hecha ? <CheckCircle2 size={16} /> : <span className="size-4 rounded border border-border" />}
                Serie {s.n}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-info-text dark:text-info">
            <Play size={13} />
            Iniciar descanso (1:30)
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-text dark:bg-danger/15 dark:text-danger">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <span>
          Si el socio está bloqueado, el portal le muestra la rutina pero <span className="font-medium">no
          lo deja registrar</span>: el servidor responde 403 "Acceso suspendido por falta de pago."
        </span>
      </div>
    </Card>
  );
}

const CAMPOS_REGISTRO = [
  { campo: "routine_assignment", texto: "A qué asignación pertenece." },
  { campo: "routine_exercise", texto: "Qué ejercicio de la rutina." },
  { campo: "set_number", texto: "Número de serie." },
  { campo: "completed", texto: "Si está completada." },
  { campo: "completed_at", texto: "Cuándo se completó." },
  { campo: "date", texto: "Fecha del registro. Siempre hoy." },
];

function ProgresoRegistro() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <ListChecks size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Progreso y registro</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Cada serie marcada queda como un <span className="font-mono text-xs">WorkoutSet</span>. No se
        crea uno nuevo al desmarcar: se actualiza el mismo.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {CAMPOS_REGISTRO.map((c) => (
          <div key={c.campo} className="rounded-lg border border-border bg-surface p-3">
            <p className="font-mono text-[11px] text-info-text dark:text-info">{c.campo}</p>
            <p className="mt-1 text-xs text-text-secondary">{c.texto}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-text dark:bg-warning/15 dark:text-warning">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>
          Sólo se registra el <span className="font-medium">entrenamiento de hoy</span>. No hay
          historial entre días: el progreso se reinicia cada fecha. Tampoco se guarda el peso o las
          reps reales que hizo.
        </span>
      </div>
    </Card>
  );
}

const TOGGLES = [
  { key: "active", label: "El socio está activo", def: true },
  { key: "comp", label: "Es socio de cortesía", def: false },
  { key: "hasSub", label: "Tiene un ciclo que cubre hoy", def: true },
];

const PAY_STATUS = [
  { value: "paid", label: "Pagado" },
  { value: "pending", label: "Pendiente" },
  { value: "overdue", label: "Vencido" },
  { value: "blocked", label: "Bloqueado" },
  { value: "initial_pending", label: "Primer pago pendiente" },
];

function accessVerdict(o) {
  if (!o.active) {
    return {
      ok: false,
      title: "Bloqueado: ficha inactiva",
      detail: "El socio figura inactivo (Member.active = False).",
    };
  }
  if (o.comp) {
    return {
      ok: true,
      title: "Puede entrenar: cortesía",
      detail: "Los socios de cortesía quedan habilitados aunque no tengan ciclo.",
    };
  }
  if (!o.hasSub) {
    return {
      ok: false,
      title: "Bloqueado: sin suscripción que cubra hoy",
      detail: "No hay ningún ciclo vigente hoy.",
    };
  }
  if (o.payStatus === "blocked") {
    return {
      ok: false,
      title: "Bloqueado: pago bloqueado",
      detail: "El estado de pago del ciclo es \"blocked\".",
    };
  }
  if (o.payStatus === "initial_pending") {
    return {
      ok: false,
      title: "Bloqueado: primer pago pendiente",
      detail: "Todavía no se registró el primer pago; no puede operar.",
    };
  }
  return {
    ok: true,
    title: "Puede entrenar",
    detail: `Estado de pago "${o.payStatus}": no bloquea el entrenamiento.`,
  };
}

function SimuladorAccesoSocio() {
  const [opts, setOpts] = useState(() => {
    const base = Object.fromEntries(TOGGLES.map((t) => [t.key, t.def]));
    return { ...base, payStatus: "paid" };
  });

  const verdict = accessVerdict(opts);

  return (
    <Card>
      <div className="flex items-center gap-2">
        <ShieldAlert size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Simulador: ¿puede registrar entrenamiento?</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Replica la decisión de <span className="font-mono text-xs">MemberEligibility.block_reason</span>.
        Cambiá la situación del socio y mirá el veredicto.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          {TOGGLES.map((t) => (
            <label
              key={t.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <span className="font-medium text-text-primary">{t.label}</span>
              <input
                type="checkbox"
                checked={opts[t.key]}
                onChange={(e) => setOpts({ ...opts, [t.key]: e.target.checked })}
                className="size-4 accent-blue-500"
              />
            </label>
          ))}

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <span className="font-medium text-text-primary">Estado de pago</span>
            <select
              value={opts.payStatus}
              onChange={(e) => setOpts({ ...opts, payStatus: e.target.value })}
              className="rounded-lg border border-border bg-surface-input px-2 py-1 text-sm text-text-primary"
            >
              {PAY_STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 ${
            verdict.ok
              ? "border-success/30 bg-success-bg dark:bg-success/10"
              : "border-danger/30 bg-danger-bg dark:bg-danger/10"
          }`}
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            {verdict.ok ? (
              <CheckCircle2 size={16} className="text-success-text dark:text-success" />
            ) : (
              <Ban size={16} className="text-danger-text dark:text-danger" />
            )}
            Resultado
          </p>
          <p className={`mt-2 text-sm font-medium ${verdict.ok ? "text-success-text dark:text-success" : "text-danger-text dark:text-danger"}`}>
            {verdict.title}
          </p>
          <p className="mt-2 text-xs text-text-secondary">{verdict.detail}</p>

          <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning-text dark:bg-warning/15 dark:text-warning">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Ojo: <span className="font-medium">pendiente</span> y <span className="font-medium">vencido</span> NO
              bloquean. Sólo <span className="font-mono">blocked</span> e{" "}
              <span className="font-mono">initial_pending</span> impiden registrar.
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

const PERMISOS = [
  {
    key: "rol",
    titulo: "Staff sin filtro de rol",
    icono: Wrench,
    color: "danger",
    detalle:
      "Los endpoints piden sólo estar logueado. Cualquier usuario del gimnasio puede administrar rutinas: no se usa require_owner.",
  },
  {
    key: "visual",
    titulo: "Gating visual del frontend",
    icono: EyeOff,
    color: "warning",
    detalle:
      "Que un usuario no vea la pantalla no es una barrera: /routines no está envuelta en ProfessorRoute.",
  },
  {
    key: "publico",
    titulo: "Público por token",
    icono: Link2,
    color: "info",
    detalle:
      "public/<token>/ abre la rutina y el portal sin login; el token es la única credencial.",
  },
];

function PermisosAccesos() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Users size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Permisos y accesos</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Tres niveles distintos, que conviene no confundir.
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {PERMISOS.map((p) => {
          const Icon = p.icono;
          return (
            <div key={p.key} className="rounded-xl border border-border bg-surface p-4">
              <span className={`inline-flex size-9 items-center justify-center rounded-lg ${COLOR_CLASSES[p.color]}`}>
                <Icon size={18} />
              </span>
              <p className="mt-2 text-sm font-semibold text-text-primary">{p.titulo}</p>
              <p className="mt-1 text-xs text-text-secondary">{p.detalle}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const BUGS = [
  {
    key: "rol",
    color: "danger",
    titulo: "Sin control de rol en el backend",
    detalle:
      "Cualquier usuario autenticado del gym puede crear/editar/borrar ejercicios y plantillas, y asignar rutinas.",
    ref: "views.py:53-80 · :272-337",
  },
  {
    key: "delete",
    color: "danger",
    titulo: "Asignación con DELETE duro",
    detalle:
      "RoutineAssignment no tiene borrado lógico y el ViewSet expone DELETE. La UI no lo usa, pero existe.",
    ref: "models.py:212-245 · views.py:65-67",
  },
  {
    key: "unique",
    color: "danger",
    titulo: "Sin unicidad de rutina activa",
    detalle:
      "Nada impide dos asignaciones activas para el mismo socio, y el alta en lote no es atómica ni bloquea: un doble envío puede dejar estados intermedios.",
    ref: "models.py:212-245 · views.py:313-332",
  },
  {
    key: "inactive",
    color: "warning",
    titulo: "Ejercicios borrados que igual aparecen",
    detalle:
      "MemberRoutineSerializer.get_exercises no filtra is_active, así que un ejercicio desactivado puede seguir viéndose en la rutina del socio.",
    ref: "serializers.py:132-148",
  },
  {
    key: "viewset",
    color: "warning",
    titulo: "RoutineExerciseViewSet no inyecta el gym",
    detalle:
      "A diferencia de los otros tres ViewSets, hereda de ModelViewSet y no usa GymModelViewSet: depende sólo de la validación del serializer.",
    ref: "views.py:70-80",
  },
  {
    key: "public",
    color: "warning",
    titulo: "Endpoints públicos sin autenticación",
    detalle:
      "public/<token>/ y su progreso no piden login (sólo throttle); el payload incluye rutina, pagos, deuda y acceso.",
    ref: "views.py:340-412 · :425-831",
  },
  {
    key: "tests",
    color: "muted",
    titulo: "Sin tests de rutinas",
    detalle:
      "No existe backend/routines/tests.py (sólo un .pyc viejo). Es una de las pocas apps sin cobertura.",
    ref: "backend/routines/",
  },
  {
    key: "hoy",
    color: "warning",
    titulo: "Registro sólo de hoy",
    detalle:
      "El progreso usa siempre la fecha actual: no hay historial de entrenamientos.",
    ref: "views.py:365-369 · models.py:272-275",
  },
  {
    key: "route",
    color: "warning",
    titulo: "Ruta /routines sin ProfessorRoute",
    detalle:
      "Cualquier rol autenticado puede abrir la pantalla de rutinas.",
    ref: "App.jsx:189",
  },
  {
    key: "naming",
    color: "muted",
    titulo: "Trampa de nombres (no es un bug)",
    detalle:
      "PublicRoutine.jsx es la página de horarios, no el workout. El entrenamiento real es member/MemberWorkout.jsx.",
    ref: "pages/PublicRoutine.jsx · member/MemberWorkout.jsx",
  },
];

function BugsConocidos() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-warning-text dark:text-warning" />
        <h2 className="text-lg font-bold text-text-primary">Posibles bugs / desajustes</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Puntos donde el comportamiento real puede sorprender. Para documentar, no necesariamente
        para arreglar.
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {BUGS.map((b) => (
          <div key={b.key} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start gap-2">
              <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg ${COLOR_CLASSES[b.color]}`}>
                <AlertTriangle size={15} />
              </span>
              <p className="text-sm font-semibold text-text-primary">{b.titulo}</p>
            </div>
            <p className="mt-2 text-xs text-text-secondary">{b.detalle}</p>
            <p className="mt-2 font-mono text-[11px] text-text-secondary">{b.ref}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

const NO_HACE = [
  "No exige un rol para crear/editar/asignar rutinas.",
  "No garantiza en la base una sola rutina activa por socio.",
  "No guarda historial de entrenamientos (sólo de hoy).",
  "No guarda el peso ni las reps reales que hizo el socio.",
  "No valida que reps y peso sean números (son texto libre).",
  "No tiene tests automáticos.",
  "No está gated por feature (gyms/features.py no incluye rutinas).",
  "No notifica al socio: sólo el link de WhatsApp que arma el staff.",
];

function LoQueNoHace() {
  const [abierto, setAbierto] = useState(false);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center gap-2"
      >
        <XCircle size={18} className="text-danger-text dark:text-danger" />
        <h2 className="flex-1 text-left text-lg font-bold text-text-primary">
          Lo que el sistema NO hace hoy
        </h2>
        <ArrowDown
          size={16}
          className={`shrink-0 text-text-secondary transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>
      {abierto && (
        <ul className="mt-4 grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
          {NO_HACE.map((n) => (
            <li
              key={n}
              className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3"
            >
              <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              {n}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function RoutinesFlow() {
  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill className="bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger">
              Solo desarrollo · no visible en producción
            </Pill>
            <Pill className="bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
              Fuente: AUDITORIA-RUTINAS.md
            </Pill>
          </div>
          <h1 className="mt-3 text-3xl font-bold">Flujo de rutinas</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Cómo funcionan hoy las rutinas, en forma visual e interactiva: el catálogo, el armado de
            una plantilla, la asignación al socio, la ejecución desde el portal, el registro de
            progreso, los permisos y los desajustes conocidos.
          </p>
        </div>

        <QueEsRutina />

        <CatalogoEjercicios />

        <ArmarRutina />

        <AsignarRutina />

        <SocioEjecuta />

        <ProgresoRegistro />

        <SimuladorAccesoSocio />

        <PermisosAccesos />

        <BugsConocidos />

        <LoQueNoHace />

        <p className="pb-4 text-center text-xs text-text-secondary">
          Página de desarrollo: no se incluye en producción y no existe en los builds finales.
        </p>
      </div>
    </div>
  );
}
