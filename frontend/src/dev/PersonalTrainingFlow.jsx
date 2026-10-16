import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Banknote,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Coins,
  CreditCard,
  Dumbbell,
  EyeOff,
  GitBranch,
  Inbox,
  Package,
  Power,
  RefreshCw,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Timer,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

const CAMPOS_OFERTA = [
  {
    key: "nombre",
    campo: "Nombre",
    icono: Tag,
    color: "info",
    resumen: "El rótulo de la oferta.",
    detalle: "Único dentro del gimnasio: no puede repetirse entre ofertas.",
  },
  {
    key: "modalidad",
    campo: "Modalidad de cobro",
    icono: Coins,
    color: "warning",
    resumen: "Mensual o Por sesiones.",
    detalle:
      "Mensual: cuota fija como un plan. Por sesiones: paquete de N sesiones con precio por sesión. Una oferta por sesiones fuerza el precio mensual a $0.",
  },
  {
    key: "precio",
    campo: "Precio mensual",
    icono: Wallet,
    color: "success",
    resumen: "Lo que cuesta por mes.",
    detalle:
      "Al asignar se congela en la línea de facturación del socio. Cambiar el precio después no toca a los ya asignados.",
  },
  {
    key: "duracion",
    campo: "Duración de la sesión",
    icono: Timer,
    color: "muted",
    resumen: "Cuántos minutos dura.",
    detalle:
      "Por defecto 60. Define qué franjas se ofrecen al asignar un horario.",
  },
  {
    key: "genero",
    campo: "Género del entrenador/a",
    icono: UserCog,
    color: "info",
    resumen: "Varón, Mujer o indistinto.",
    detalle:
      "Restringe qué trainers pueden tomar la oferta al asignar o al rotar el trainer.",
  },
  {
    key: "servicio",
    campo: "Servicio",
    icono: Package,
    color: "muted",
    resumen: "Agrupador del catálogo.",
    detalle:
      "Si no se elige, va al servicio “Entrenamiento personal” del gimnasio. Varias asignaciones de la misma oferta comparten una sola línea de facturación.",
  },
  {
    key: "activo",
    campo: "Activo",
    icono: Power,
    color: "success",
    resumen: "El interruptor de publicación.",
    detalle:
      "Eliminar es baja lógica: nunca se borra. Se puede reactivar sin tocar a los socios ya asignados.",
  },
];

const CAMPOS_ASIGNACION = [
  {
    key: "socio",
    campo: "Socio",
    icono: Users,
    color: "info",
    resumen: "Con quién es el 1 a 1.",
    detalle:
      "Es exclusivo: el horario es 1 a 1. No hay grupos, cupos ni lista de espera.",
  },
  {
    key: "trainer",
    campo: "Entrenador/a",
    icono: UserCog,
    color: "muted",
    resumen: "Quién entrena.",
    detalle:
      "Usuario del sistema con rol trainer del gimnasio. El género debe ser compatible con la oferta.",
  },
  {
    key: "oferta",
    campo: "Oferta",
    icono: Package,
    color: "info",
    resumen: "Qué servicio contrata.",
    detalle: "Debe pertenecer al mismo gimnasio.",
  },
  {
    key: "horario",
    campo: "Día y horario",
    icono: CalendarDays,
    color: "warning",
    resumen: "El bloque semanal fijo.",
    detalle:
      "Día + hora de inicio + hora de fin. La hora de fin debe ser posterior a la de inicio. No puede haber dos asignaciones activas iguales para el mismo socio, día y hora.",
  },
  {
    key: "modalidad",
    campo: "Modalidad",
    icono: Coins,
    color: "warning",
    resumen: "Mensual o Paquete.",
    detalle:
      "Define cómo se cobra y si hay seguimiento de sesiones. Sólo los paquetes las cuentan.",
  },
  {
    key: "paquete",
    campo: "Paquete",
    icono: Package,
    color: "info",
    resumen: "Total de sesiones y precio por sesión.",
    detalle:
      "Sólo en modalidad Paquete: se define el total y el precio por sesión (coseguro). El sistema lleva el saldo pendiente.",
  },
  {
    key: "sellado",
    campo: "Sellado / coseguro",
    icono: ShieldCheck,
    color: "muted",
    resumen: "Monto único opcional.",
    detalle:
      "Se cobra una sola vez por paquete, aparte de las sesiones, con su propia marca de cobrado.",
  },
  {
    key: "activo",
    campo: "Activa",
    icono: Power,
    color: "success",
    resumen: "El estado de la asignación.",
    detalle:
      "Desvincular es baja lógica. Si era la última asignación activa de la oferta, se cancelan las líneas de facturación en las suscripciones vigentes.",
  },
];

const MODOS_COBRO = [
  {
    key: "monthly",
    titulo: "Mensual",
    icono: Banknote,
    color: "info",
    resumen: "El entrenamiento se paga como una cuota mensual.",
    puntos: [
      "Al asignar se crea (o se reutiliza) una línea de facturación en la suscripción del socio.",
      "El precio se congela: el gimnasio puede cambiarlo sin tocar a los ya asignados.",
      "Si el alta fue prorrateada, la línea también se prorratea.",
      "Se cobra todos los meses con la cuota. No hay seguimiento de sesiones.",
    ],
  },
  {
    key: "sessions",
    titulo: "Paquete de sesiones",
    icono: Coins,
    color: "warning",
    resumen: "El socio contrata un paquete de N sesiones.",
    puntos: [
      "El staff carga el total de sesiones y el precio por sesión (coseguro).",
      "No se cobra por adelantado: son pagos parciales contra el total.",
      "Los pagos son la fuente de verdad: el saldo se sincroniza desde ellos.",
      "No se puede cobrar más que el saldo. Los socios de cortesía no pagan.",
    ],
  },
];

const ROLES = [
  {
    key: "staff",
    titulo: "Owner / administrador",
    icono: UserPlus,
    color: "info",
    puede: [
      "Crear y editar ofertas.",
      "Asignar socios (wizard de 2 pasos).",
      "Registrar, quitar y renovar sesiones.",
      "Cobrar paquetes y sellados, y aprobar o rechazar solicitudes.",
    ],
  },
  {
    key: "trainer",
    titulo: "Entrenador/a",
    icono: UserCog,
    color: "muted",
    puede: [
      "Ver su agenda del día.",
      "Consultar el contacto del socio y el saldo del paquete.",
    ],
    limitacion: "No carga nada: la agenda es de sólo lectura.",
  },
  {
    key: "socio",
    titulo: "Socio",
    icono: Users,
    color: "success",
    puede: [
      "Ver sus entrenamientos, el progreso y el sellado.",
      "Pedir un cambio de horario desde su portal.",
      "Cancelar una solicitud propia.",
    ],
    limitacion: "No se autoasigna: nunca se da de alta solo.",
  },
];

const CICLO_VIDA = [
  {
    titulo: "Habilitar feature",
    icono: Sparkles,
    descripcion:
      "El gimnasio activa “Entrenamiento personal”. Sin esto, no existe ni para el staff ni para el portal.",
  },
  {
    titulo: "Crear oferta",
    icono: Tag,
    descripcion:
      "Nombre, modalidad de cobro, precio mensual, duración y género de trainer.",
  },
  {
    titulo: "Asignar socio",
    icono: UserPlus,
    descripcion:
      "Wizard de 2 pasos: elegir el socio y luego oferta, trainer, día y horario. Valida solapamientos.",
  },
  {
    titulo: "Cobrar",
    icono: Banknote,
    descripcion:
      "Mensual: línea en la suscripción. Paquete: pagos parciales del coseguro + sellado opcional.",
  },
  {
    titulo: "Registrar sesiones",
    icono: ClipboardCheck,
    descripcion:
      "Sólo en paquetes. El staff carga o quita. Las faltas se descuentan automáticamente.",
  },
  {
    titulo: "Renovar",
    icono: RefreshCw,
    descripcion:
      "Agrega sesiones, reactiva y resetea el sellado. Bloquea si hay saldo sin cobrar.",
  },
  {
    titulo: "Desvincular",
    icono: Power,
    descripcion:
      "Baja lógica. Cancela las líneas de facturación si era la última asignación de la oferta.",
  },
];

const REGLAS_SOLAPE = [
  {
    key: "gym",
    icono: CalendarClock,
    color: "info",
    titulo: "Horario fijo del gimnasio",
    detalle: "No puede pisar el bloque de gimnasio del socio.",
  },
  {
    key: "actividades",
    icono: Users,
    color: "info",
    titulo: "Actividades",
    detalle: "No puede superponerse con las actividades del socio.",
  },
  {
    key: "pt-socio",
    icono: Dumbbell,
    color: "warning",
    titulo: "Otros PT del socio",
    detalle: "El socio no puede tener dos entrenamientos personales encimados.",
  },
  {
    key: "pt-trainer",
    icono: UserCog,
    color: "danger",
    titulo: "PT del entrenador/a",
    detalle:
      "El trainer no puede estar en dos lugares a la vez: se revisan sus otras asignaciones.",
  },
];

const VALIDACIONES = [
  {
    key: "feature_off",
    label: "La feature está deshabilitada",
    fail: "El gimnasio no tiene habilitado Entrenamiento personal.",
  },
  {
    key: "oferta_otro_gym",
    label: "La oferta es de otro gimnasio",
    fail: "La oferta no pertenece a este gimnasio.",
  },
  {
    key: "trainer_otro_gym",
    label: "El trainer es de otro gimnasio",
    fail: "El entrenador/a no pertenece a este gimnasio.",
  },
  {
    key: "sin_rol_trainer",
    label: "El elegido no tiene rol trainer",
    fail: "El usuario elegido no es un entrenador/a del gimnasio.",
  },
  {
    key: "genero",
    label: "Género incompatible con la oferta",
    fail: "El género del entrenador/a no coincide con el que pide la oferta.",
  },
  {
    key: "no_elegible",
    label: "El socio no es elegible por pago",
    fail: "El socio está bloqueado por falta de pago y no puede operar.",
  },
  {
    key: "sin_direccion",
    label: "El socio no tiene dirección",
    fail: "El entrenamiento es a domicilio y el socio no tiene dirección cargada.",
  },
  {
    key: "solape",
    label: "El horario está ocupado",
    fail: "El horario se superpone con el gimnasio, actividades u otro entrenamiento.",
  },
];

const ORIGENES_SESION = [
  {
    key: "manual",
    titulo: "Manual",
    icono: ClipboardCheck,
    color: "info",
    detalle:
      "El staff la registra a mano desde la asignación. Es idempotente por (asignación, fecha): el mismo día nunca se cobra dos veces.",
  },
  {
    key: "no_show",
    titulo: "No asistió",
    icono: AlertTriangle,
    color: "warning",
    detalle:
      "La crea el job diario de faltas para cada sesión esperada a la que el socio no fue. Por eso el paquete también se agota por inasistencia.",
  },
];

const ESTADOS_SOLICITUD = [
  {
    key: "pending",
    titulo: "Pendiente",
    icono: Clock,
    color: "warning",
    detalle: "El socio la creó y espera la respuesta del staff.",
  },
  {
    key: "executed",
    titulo: "Ejecutada",
    icono: CheckCircle2,
    color: "success",
    detalle: "El staff aprobó: la asignación ya cambió de horario.",
  },
  {
    key: "rejected",
    titulo: "Rechazada",
    icono: XCircle,
    color: "danger",
    detalle: "El staff la descartó.",
  },
  {
    key: "cancelled_by_member",
    titulo: "Cancelada por el socio",
    icono: EyeOff,
    color: "muted",
    detalle: "El socio se arrepintió antes de la respuesta.",
  },
  {
    key: "cancelled_by_staff",
    titulo: "Cancelada por el staff",
    icono: Power,
    color: "muted",
    detalle: "El staff la anuló sin aprobar ni rechazar.",
  },
];

const REGLAS_SOLICITUD = [
  "Sólo una solicitud pendiente por asignación a la vez.",
  "El horario pedido no puede ser idéntico al actual.",
  "La hora de fin debe ser posterior a la de inicio.",
  "Al aprobar se revalida el solapamiento antes de aplicar el cambio.",
  "El socio crea y cancela; el staff aprueba o rechaza.",
  "El estado “approved” existe en el modelo pero no se usa: la aprobación pasa directo a “ejecutada”.",
];

const NO_HACE = [
  "No autoasigna al socio: no hay autoinscripción ni carga de PT en el alta/onboarding.",
  "No tiene lista de espera ni cupos: el horario es 1 a 1.",
  "No tiene check-in por QR para PT: la sesión se carga a mano.",
  "No tiene recuperaciones: no se puede recuperar una sesión de PT faltada.",
  "No cobra el paquete por adelantado ni tiene pasarela o link de pago de PT.",
  "No actualiza el precio de los socios ya asignados cuando la oferta cambia de precio.",
  "No distingue roles en el backend: la restricción owner vs trainer la pone el frontend.",
  "No valida la duración real: sólo exige que el fin sea posterior al inicio.",
  "No avisa por email ni WhatsApp (el portal sí muestra el contacto del trainer).",
  "No versiona precios en la asignación: el precio queda congelado en la facturación.",
];

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

function GridDeCampos({ campos }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {campos.map((c) => {
        const Icon = c.icono;
        return (
          <div key={c.key} className="rounded-xl border border-border bg-surface px-3 py-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${COLOR_CLASSES[c.color]}`}>
                <Icon size={16} />
              </span>
              <p className="text-sm font-semibold text-text-primary">{c.campo}</p>
            </div>
            <p className="mt-2 text-xs font-medium text-text-primary">{c.resumen}</p>
            <p className="mt-1 text-xs text-text-secondary">{c.detalle}</p>
          </div>
        );
      })}
    </div>
  );
}

function AnatomiaPT() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Dumbbell size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Anatomía del entrenamiento personal</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Primero la oferta (qué se vende) y después la asignación (el horario 1 a 1).
      </p>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        La oferta — el servicio
      </p>
      <div className="mt-3">
        <GridDeCampos campos={CAMPOS_OFERTA} />
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        La asignación — el horario
      </p>
      <div className="mt-3">
        <GridDeCampos campos={CAMPOS_ASIGNACION} />
      </div>

      <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        A diferencia de las actividades, no hay inscripción separada del horario: la asignación{" "}
        <span className="font-semibold">es</span> el vínculo socio ↔ trainer. Y no hay grupos: es 1 a 1.
      </p>
    </Card>
  );
}

function LosDosModosDeCobro() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Coins size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Los dos modos de cobro</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        La misma oferta se cobra de dos formas: cuota mensual o paquete de sesiones.
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {MODOS_COBRO.map((m) => {
          const Icon = m.icono;
          return (
            <div key={m.key} className="flex flex-col rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${COLOR_CLASSES[m.color]}`}>
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{m.titulo}</p>
                  <p className="text-xs text-text-secondary">{m.resumen}</p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {m.puntos.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-xs text-text-secondary">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">Mensual: </span>
          vive dentro de la cuota de la suscripción, como cualquier plan.
        </div>
        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">Paquete: </span>
          pagos parciales del coseguro, más un sellado único opcional.
        </div>
      </div>
    </Card>
  );
}

function QuienCargaQue() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <UserPlus size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Quién carga qué</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Sólo el staff carga. El trainer mira y el socio pide cambios.
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {ROLES.map((r) => {
          const Icon = r.icono;
          return (
            <div key={r.key} className="flex flex-col rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${COLOR_CLASSES[r.color]}`}>
                  <Icon size={16} />
                </span>
                <p className="text-sm font-semibold text-text-primary">{r.titulo}</p>
              </div>
              <ul className="mt-3 space-y-1.5">
                {r.puede.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-xs text-text-secondary">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                    {p}
                  </li>
                ))}
              </ul>
              {r.limitacion && (
                <p className="mt-3 rounded-lg bg-warning-bg px-2.5 py-2 text-xs text-warning-text dark:bg-warning/15 dark:text-warning">
                  {r.limitacion}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        El alta/onboarding <span className="font-semibold">NO</span> carga entrenamiento personal:
        sólo actividades y horarios del gimnasio. Todo PT lo carga el staff.
      </p>
    </Card>
  );
}

function DiagramaCicloVida() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Repeat size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Ciclo de vida de un entrenamiento</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El recorrido completo, de habilitar la feature a desvincular.
      </p>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {CICLO_VIDA.map((step, i) => {
          const Icon = step.icono;
          return (
            <div key={step.titulo} className="flex flex-1 items-center gap-3 lg:flex-col lg:text-center">
              <div className="flex flex-1 items-center gap-3 lg:flex-col">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-info-bg text-info-text dark:bg-info/15 dark:text-info">
                  <Icon size={20} />
                </div>
                <div className="flex-1 lg:text-center">
                  <p className="text-sm font-semibold text-text-primary">{step.titulo}</p>
                  <p className="mt-1 text-xs text-text-secondary">{step.descripcion}</p>
                </div>
              </div>
              {i < CICLO_VIDA.length - 1 && (
                <ArrowDown size={18} className="shrink-0 text-text-secondary lg:hidden" />
              )}
              {i < CICLO_VIDA.length - 1 && (
                <ArrowRight size={18} className="hidden shrink-0 text-text-secondary lg:block" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ReglasDeSolapamiento() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <ShieldAlert size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Reglas de solapamiento</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Antes de crear o mover un horario, el sistema revisa cuatro choques.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {REGLAS_SOLAPE.map((r) => {
          const Icon = r.icono;
          return (
            <div key={r.key} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
              <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${COLOR_CLASSES[r.color]}`}>
                <Icon size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-text-primary">{r.titulo}</p>
                <p className="mt-1 text-xs text-text-secondary">{r.detalle}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        La pantalla ofrece las <span className="font-semibold">franjas libres</span> por día, calculadas
        desde las ventanas de apertura del gimnasio menos los intervalos ocupados.
      </p>
    </Card>
  );
}

function SimuladorAsignacion() {
  const [estado, setEstado] = useState(() => Object.fromEntries(VALIDACIONES.map((v) => [v.key, false])));

  const bloqueos = VALIDACIONES.filter((v) => estado[v.key]);

  return (
    <Card className="col-span-full">
      <div className="flex items-center gap-2">
        <GitBranch size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">
          Simulador: ¿se puede asignar?
        </h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Activá cada problema para ver si el sistema deja asignar y con qué mensaje.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          {VALIDACIONES.map((v) => (
            <label
              key={v.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <span className="font-medium text-text-primary">{v.label}</span>
              <input
                type="checkbox"
                checked={estado[v.key]}
                onChange={(e) => setEstado({ ...estado, [v.key]: e.target.checked })}
                className="size-4 accent-blue-500"
              />
            </label>
          ))}
        </div>

        <div className="space-y-3">
          <div
            className={`rounded-xl border p-4 ${
              bloqueos.length > 0
                ? "border-danger/30 bg-danger-bg dark:bg-danger/10"
                : "border-success/30 bg-success-bg dark:bg-success/10"
            }`}
          >
            {bloqueos.length > 0 ? (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold text-danger-text dark:text-danger">
                  <XCircle size={16} />
                  Asignación rechazada
                </p>
                <ul className="mt-2 space-y-1.5">
                  {bloqueos.map((b) => (
                    <li key={b.key} className="flex items-start gap-2 text-xs text-danger-text dark:text-danger">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      {b.fail}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold text-success-text dark:text-success">
                  <CheckCircle2 size={16} />
                  Asignación creada
                </p>
                <p className="mt-2 text-xs text-success-text dark:text-success">
                  El socio queda con su horario 1 a 1. Si es mensual, se agrega la cuota; si es
                  paquete, se abre el saldo de sesiones.
                </p>
              </>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Cómo leerlo
            </p>
            <p className="mt-2 text-xs text-text-secondary">
              Todos estos son <span className="font-medium text-text-primary">problemas</span>: bloquean
              cuando están tildados. Detalle: al aprobar una solicitud de cambio del socio, el
              chequeo de elegibilidad por pago se saltea; los demás se revalidan igual.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function NumField({ label, value, onChange, min = 0, step = 1, prefix = "" }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-text-secondary">
      <span className="font-medium text-text-primary">{label}</span>
      <div className="flex items-center rounded-lg border border-border bg-surface px-2">
        {prefix && <span className="text-sm text-text-secondary">{prefix}</span>}
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
          className="w-full bg-transparent px-1 py-1.5 text-sm text-text-primary outline-none"
        />
      </div>
    </label>
  );
}

function SimuladorCobro() {
  const [modalidad, setModalidad] = useState("package");
  const [monthlyPrice, setMonthlyPrice] = useState(15000);
  const [totalSessions, setTotalSessions] = useState(8);
  const [sessionPrice, setSessionPrice] = useState(3000);
  const [sellado, setSellado] = useState(0);
  const [pagado, setPagado] = useState(6000);
  const [selladoPagado, setSelladoPagado] = useState(false);
  const [usadas, setUsadas] = useState(2);

  const esPaquete = modalidad === "package";
  const total = esPaquete ? totalSessions * sessionPrice : monthlyPrice;
  const saldo = esPaquete ? Math.max(total - pagado, 0) : 0;
  const restantes = Math.max(totalSessions - usadas, 0);
  const agotado = esPaquete && usadas >= totalSessions;

  const fmt = (n) => `$${n.toLocaleString("es-AR")}`;

  return (
    <Card>
      <div className="flex items-center gap-2">
        <CreditCard size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">
          Simulador: cómo se calcula el cobro
        </h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Cambiá la modalidad y los números para ver el total, el saldo y el estado del paquete.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { key: "monthly", label: "Mensual", icono: Banknote },
          { key: "package", label: "Paquete de sesiones", icono: Coins },
        ].map((m) => {
          const Icon = m.icono;
          const activo = modalidad === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setModalidad(m.key)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                activo
                  ? "border-info/40 bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
                  : "border-border bg-surface text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon size={15} />
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="grid gap-3 sm:grid-cols-2">
          {esPaquete ? (
            <>
              <NumField label="Sesiones del paquete" value={totalSessions} onChange={setTotalSessions} min={1} />
              <NumField label="Precio por sesión" value={sessionPrice} onChange={setSessionPrice} min={0} step={100} prefix="$" />
              <NumField label="Sellado / coseguro (único)" value={sellado} onChange={setSellado} min={0} step={100} prefix="$" />
              <NumField label="Pagado del paquete" value={pagado} onChange={setPagado} min={0} step={100} prefix="$" />
              <NumField label="Sesiones usadas" value={usadas} onChange={setUsadas} min={0} />
              <label className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                <span className="font-medium text-text-primary">Sellado cobrado</span>
                <input
                  type="checkbox"
                  checked={selladoPagado}
                  onChange={(e) => setSelladoPagado(e.target.checked)}
                  className="size-4 accent-blue-500"
                />
              </label>
            </>
          ) : (
            <NumField label="Precio mensual de la oferta" value={monthlyPrice} onChange={setMonthlyPrice} min={0} step={100} prefix="$" />
          )}
        </div>

        <div className="space-y-3">
          {esPaquete ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-secondary">Total del paquete</p>
                  <p className="mt-1 text-lg font-bold text-text-primary">{fmt(total)}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-secondary">Saldo pendiente</p>
                  <p className={`mt-1 text-lg font-bold ${saldo > 0 ? "text-warning-text dark:text-warning" : "text-success-text dark:text-success"}`}>
                    {fmt(saldo)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="text-xs text-text-secondary">Sesiones</p>
                <p className="mt-1 text-sm text-text-primary">
                  {usadas} usadas · {restantes} restantes de {totalSessions}
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted-bg dark:bg-muted/15">
                  <div
                    className={`h-full rounded-full ${agotado ? "bg-danger" : "bg-info"}`}
                    style={{ width: `${totalSessions > 0 ? Math.min(100, (usadas / totalSessions) * 100) : 0}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {agotado && (
                  <Pill className={COLOR_CLASSES.danger}>
                    <AlertTriangle size={13} />
                    Paquete agotado
                  </Pill>
                )}
                {sellado > 0 && (
                  <Pill className={selladoPagado ? COLOR_CLASSES.success : COLOR_CLASSES.warning}>
                    <ShieldCheck size={13} />
                    Sellado {selladoPagado ? "cobrado" : "pendiente"} · {fmt(sellado)}
                  </Pill>
                )}
                {saldo > 0 && (
                  <Pill className={COLOR_CLASSES.warning}>
                    <Clock size={13} />
                    Renovar bloqueado hasta cobrar
                  </Pill>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="text-xs text-text-secondary">Cuota mensual</p>
                <p className="mt-1 text-lg font-bold text-text-primary">{fmt(monthlyPrice)}</p>
              </div>
              <p className="rounded-lg bg-info-bg px-3 py-2 text-xs text-info-text dark:bg-info/15 dark:text-info">
                Se agrega a la suscripción del socio y se factura todos los meses. Sin sesiones, sin
                sellado y sin seguimiento.
              </p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function SesionesYFaltas() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <ClipboardCheck size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Sesiones y no-asistencia</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Sólo los paquetes cuentan sesiones. Hay un origen manual y uno automático.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {ORIGENES_SESION.map((o) => {
          const Icon = o.icono;
          return (
            <div key={o.key} className="flex flex-col rounded-xl border border-border bg-surface p-4">
              <span className={`inline-flex size-9 items-center justify-center rounded-lg ${COLOR_CLASSES[o.color]}`}>
                <Icon size={18} />
              </span>
              <p className="mt-2 text-sm font-semibold text-text-primary">{o.titulo}</p>
              <p className="mt-1 text-xs text-text-secondary">{o.detalle}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-warning/30 bg-warning-bg p-4 dark:bg-warning/10">
        <p className="flex items-center gap-2 text-sm font-semibold text-warning-text dark:text-warning">
          <AlertTriangle size={16} />
          Acá SÍ se descuentan las faltas
        </p>
        <p className="mt-2 text-xs text-warning-text dark:text-warning">
          A diferencia de las salidas, el job diario de no-asistencia descuenta una sesión por cada
          entrenamiento esperado al que el socio no fue. Un socio que falta puede agotar el paquete
          sin haber entrenado. No hay recuperaciones para compensar.
        </p>
      </div>

      <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        El registro es idempotente por (asignación, fecha): el mismo día nunca se cobra dos veces.
        Renovar agrega sesiones, reactiva la asignación y resetea el sellado; se bloquea si hay saldo
        sin cobrar.
      </p>
    </Card>
  );
}

function SolicitudesDeCambio() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Inbox size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Solicitudes de cambio de horario</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El socio no cambia su horario solo: pide y el staff aprueba o rechaza.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {ESTADOS_SOLICITUD.map((e) => {
          const Icon = e.icono;
          return (
            <div key={e.key} className="flex flex-col rounded-xl border border-border bg-surface p-4">
              <span className={`inline-flex size-9 items-center justify-center rounded-lg ${COLOR_CLASSES[e.color]}`}>
                <Icon size={18} />
              </span>
              <p className="mt-2 text-sm font-semibold text-text-primary">{e.titulo}</p>
              <p className="mt-1 text-xs text-text-secondary">{e.detalle}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Reglas del flujo
        </p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {REGLAS_SOLICITUD.map((r) => (
            <li key={r} className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              {r}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function AsistenciaYMetricas() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <CalendarClock size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Asistencia y métricas</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Un tablero por rango de fechas, con foco en paquetes.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Qué muestra el resumen
          </p>
          <ul className="mt-3 space-y-1.5">
            {[
              "Sesiones programadas, asistidas, no asistidas y pendientes.",
              "Tasa de asistencia.",
              "Desglose por entrenador/a con cada asignación activa.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-text-secondary">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Detalles finos
          </p>
          <ul className="mt-3 space-y-2">
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <Coins size={15} className="mt-0.5 shrink-0 text-info-text dark:text-info" />
              Sólo los paquetes tienen seguimiento; los mensuales se listan sin datos de asistencia.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CalendarDays size={15} className="mt-0.5 shrink-0 text-info-text dark:text-info" />
              Las fechas esperadas saltean los días cerrados del gimnasio.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <Clock size={15} className="mt-0.5 shrink-0 text-warning-text dark:text-warning" />
              Si el paquete ya está agotado, sólo se listan las fechas con registro.
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

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

export default function PersonalTrainingFlow() {
  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill className="bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger">
              Solo desarrollo · no visible en producción
            </Pill>
            <Pill className="bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
              Fuente: AUDITORIA-PERSONAL-TRAINING.md
            </Pill>
          </div>
          <h1 className="mt-3 text-3xl font-bold">Flujo de entrenamiento personal</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Cómo funciona hoy el entrenamiento personal, en forma visual e interactiva: qué es la
            oferta y la asignación 1 a 1, sus dos modos de cobro, quién carga qué, las reglas de
            solapamiento, las sesiones y faltas, y las solicitudes de cambio de horario.
          </p>
        </div>

        <AnatomiaPT />

        <LosDosModosDeCobro />

        <QuienCargaQue />

        <DiagramaCicloVida />

        <ReglasDeSolapamiento />

        <SimuladorAsignacion />

        <SimuladorCobro />

        <SesionesYFaltas />

        <SolicitudesDeCambio />

        <AsistenciaYMetricas />

        <LoQueNoHace />

        <p className="pb-4 text-center text-xs text-text-secondary">
          Página de desarrollo: no se incluye en git y no existe en los builds de producción.
        </p>
      </div>
    </div>
  );
}
