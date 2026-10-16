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
  EyeOff,
  GitBranch,
  Inbox,
  MapPin,
  Navigation,
  Package,
  Power,
  QrCode,
  RefreshCw,
  Repeat,
  Route,
  Send,
  ShieldAlert,
  Sparkles,
  Tag,
  Timer,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

const CAMPOS = [
  {
    key: "nombre",
    campo: "Nombre",
    icono: Tag,
    color: "info",
    resumen: "El rótulo de la salida.",
    detalle:
      "Único dentro del gimnasio: no puede repetirse entre salidas.",
  },
  {
    key: "entrenador",
    campo: "Entrenador/a",
    icono: UserCog,
    color: "muted",
    resumen: "Quién guía la salida.",
    detalle:
      "A diferencia de las actividades, es un usuario del sistema con rol trainer. El portal muestra su teléfono y WhatsApp.",
  },
  {
    key: "precio",
    campo: "Precio mensual",
    icono: Wallet,
    color: "success",
    resumen: "Lo que cuesta por mes.",
    detalle:
      "Al inscribir se congela en la línea de facturación del socio. Cambiar el precio después no toca a los ya inscriptos.",
  },
  {
    key: "modalidad",
    campo: "Modalidad de cobro",
    icono: Coins,
    color: "info",
    resumen: "Mensual o por sesiones.",
    detalle:
      "Mensual: cuota fija como un plan. Por sesiones: paquete de N sesiones con precio por sesión; sólo el staff inscribe.",
  },
  {
    key: "punto",
    campo: "Punto de encuentro",
    icono: MapPin,
    color: "warning",
    resumen: "Dónde arranca la corrida.",
    detalle:
      "Texto libre con el lugar de encuentro. Los socios lo ven en su portal.",
  },
  {
    key: "recorrido",
    campo: "Recorrido y distancia",
    icono: Navigation,
    color: "info",
    resumen: "El trazado sobre el mapa.",
    detalle:
      "El staff dibuja los puntos y la distancia en km se calcula sola (haversine). No se edita a mano.",
  },
  {
    key: "duracion",
    campo: "Duración",
    icono: Timer,
    color: "muted",
    resumen: "Cuánto dura.",
    detalle: "Minutos de la salida. Por defecto 60.",
  },
  {
    key: "activo",
    campo: "Activo",
    icono: Power,
    color: "success",
    resumen: "El interruptor de publicación.",
    detalle:
      "Desactivarla apaga también TODOS sus horarios. No cancela las inscripciones ni la facturación de los ya anotados.",
  },
  {
    key: "servicio",
    campo: "Servicio",
    icono: Package,
    color: "muted",
    resumen: "Agrupador del catálogo.",
    detalle:
      "Si no se elige, va al servicio “Running grupal” del gimnasio. Debe pertenecer al mismo gimnasio.",
  },
];

const MODOS_COBRO = [
  {
    key: "monthly",
    titulo: "Mensual",
    icono: Banknote,
    color: "info",
    resumen: "La salida se paga como una cuota mensual.",
    puntos: [
      "Al inscribir se crea una línea de facturación en la suscripción del socio.",
      "El precio se congela: el gimnasio puede cambiar el precio sin tocar a los ya inscriptos.",
      "El socio puede pedir la inscripción desde su portal (el staff la aprueba).",
      "Se cobra todos los meses mientras siga inscripto.",
    ],
  },
  {
    key: "sessions",
    titulo: "Por sesiones (paquete)",
    icono: Coins,
    color: "warning",
    resumen: "El socio compra un paquete de N salidas.",
    puntos: [
      "El staff carga el total de sesiones y el precio por sesión.",
      "Sólo consume sesión con el check-in en la ventana o carga manual del staff.",
      "El cobro son pagos parciales: el sistema lleva el saldo pendiente.",
      "El portal del socio NO permite pedirla: siempre lo hace el staff.",
    ],
  },
];

const CICLO_VIDA = [
  {
    titulo: "Crear",
    icono: Sparkles,
    descripcion:
      "El staff carga nombre, entrenador, punto de encuentro, recorrido, precio y modalidad.",
  },
  {
    titulo: "Cargar horarios",
    icono: CalendarDays,
    descripcion:
      "Uno o más días con hora y cupo. No pueden superponerse dentro de la misma salida.",
  },
  {
    titulo: "Solicitar / inscribir",
    icono: UserPlus,
    descripcion:
      "El socio solicita y el staff aprueba, o el staff inscribe directo. Valida cupo y duplicado.",
  },
  {
    titulo: "Cobrar / registrar sesiones",
    icono: CreditCard,
    descripcion:
      "Mensual: cuota en la suscripción. Por sesiones: paquete y precio por sesión; el check-in descuenta.",
  },
  {
    titulo: "Desactivar",
    icono: EyeOff,
    descripcion:
      "Apaga la salida y sus horarios. Las inscripciones y el cobro siguen igual.",
  },
  {
    titulo: "Reactivar",
    icono: RefreshCw,
    descripcion:
      "Vuelve a activarla y revive TODOS sus horarios, incluso los apagados a mano.",
  },
];

const REGLAS_HORARIO = [
  "La hora de fin debe ser posterior a la de inicio.",
  "No puede haber dos horarios activos que se superpongan el mismo día en la misma salida.",
  "No se repite la misma salida + día + hora de inicio.",
  "El horario no se borra: se desactiva (baja lógica).",
  "No se puede desactivar el único horario activo de una salida activa.",
  "No se valida choque con el gimnasio, otras actividades ni el entrenamiento personal.",
];

const ORIGENES = [
  {
    titulo: "Solicitud del socio",
    quien: "El socio, con su token; el staff aprueba",
    icono: Send,
    color: "warning",
    detalle:
      "Sólo salidas mensuales. Queda pendiente hasta que el staff la apruebe. No hay autoinscripción.",
  },
  {
    titulo: "Staff",
    quien: "El personal, en la pantalla de inscripciones",
    icono: ClipboardCheck,
    color: "success",
    detalle:
      "Único camino para las “por sesiones”. Puede elegir mensual o paquete y fijar el precio por sesión.",
  },
];

const VALIDACIONES = [
  {
    key: "feature",
    label: "El gimnasio tiene habilitada la feature “Running grupal”",
    ok: "El gimnasio tiene la feature habilitada.",
    fail: "Las salidas no están habilitadas para este gimnasio.",
    bloqueaSi: "off",
  },
  {
    key: "pago",
    label: "El socio está al día (no está bloqueado por falta de pago)",
    ok: "El socio puede operar.",
    fail: "El miembro no puede operar.",
    bloqueaSi: "off",
  },
  {
    key: "cupo",
    label: "El horario tiene cupo disponible",
    ok: "Hay lugar en el horario.",
    fail: "El horario alcanzó su capacidad máxima.",
    bloqueaSi: "off",
  },
  {
    key: "duplicado",
    label: "El socio YA está inscripto en ese mismo horario",
    ok: "No estaba inscripto en ese horario.",
    fail: "El miembro ya está inscripto en este horario. (409)",
    bloqueaSi: "on",
  },
  {
    key: "solicitud",
    label: "Ya tiene una solicitud de inscripción pendiente",
    ok: "No tiene otra solicitud pendiente.",
    fail: "El socio ya tiene una solicitud pendiente. (409)",
    bloqueaSi: "on",
  },
  {
    key: "sesiones",
    label: "Es una salida “por sesiones” pedida desde el portal",
    ok: "No aplica: la inscripción es por staff o salida mensual.",
    fail: "Esta salida requiere inscripción por el staff. (403)",
    bloqueaSi: "on",
  },
];

const ESTADOS_SOLICITUD = [
  {
    key: "pending",
    titulo: "Pendiente",
    icono: Clock,
    color: "warning",
    detalle: "El socio la creó; el staff todavía no la revisó.",
  },
  {
    key: "approved",
    titulo: "Aprobada",
    icono: CheckCircle2,
    color: "success",
    detalle: "El staff la ejecutó: se creó o canceló la inscripción.",
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
    icono: XCircle,
    color: "muted",
    detalle: "El socio la anuló desde su portal.",
  },
  {
    key: "cancelled_by_staff",
    titulo: "Cancelada por el staff",
    icono: XCircle,
    color: "muted",
    detalle: "El staff la anuló.",
  },
];

const REGLAS_SOLICITUD = [
  "Sólo puede haber una solicitud pendiente por tipo y socio (inscripción o baja).",
  "Al aprobar una inscripción se saltea el chequeo de pago y se genera el cobro.",
  "Si la salida se desactivó mientras tanto, al aprobar responde “La salida ya no está activa” (410).",
  "Al aprobar una baja se cancela la inscripción y su facturación.",
];

const ORIGENES_SESION = [
  {
    key: "auto",
    titulo: "Automática",
    icono: QrCode,
    color: "success",
    detalle:
      "El socio hace check-in dentro de la ventana horaria de la salida y se descuenta 1 sesión solo.",
  },
  {
    key: "manual",
    titulo: "Manual",
    icono: ClipboardCheck,
    color: "info",
    detalle: "El staff la registra a mano desde la inscripción.",
  },
];

const NO_HACE = [
  "No tiene lista de espera: un horario lleno rechaza la inscripción o la solicitud.",
  "No inscribe en el alta/onboarding: sólo el staff o una solicitud aprobada.",
  "No autoinscribe salidas “por sesiones”: el socio nunca toma un paquete solo.",
  "No descuenta faltas: no hay tarea de no-asistencia; el paquete no se agota por inasistencia.",
  "No tiene recuperaciones: no existe recuperar una salida faltada.",
  "No valida solapamiento con gimnasio, otras actividades ni entrenamiento personal.",
  "No cobra el paquete por adelantado: sólo registra pagos parciales.",
  "No versiona precios de salida: el precio se congela por socio, no en la salida.",
  "No actualiza el precio de los ya inscriptos a una salida mensual si el gimnasio sube el precio.",
  "No distingue roles en el backend: cualquier usuario del gimnasio puede inscribir por API.",
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

function AnatomiaSalida() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Route size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Anatomía de una salida</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Qué es cada campo y qué decisión de negocio arrastra.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CAMPOS.map((c) => {
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

      <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        A diferencia de las actividades, el entrenador es un usuario del sistema y la
        distancia del recorrido se calcula sola. El precio queda congelado en cada
        línea de facturación de los socios ya inscriptos.
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
        La misma salida se cobra de dos formas: cuota mensual o paquete de sesiones.
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
          se factura todos los meses mientras el socio siga inscripto, como cualquier plan.
        </div>
        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">Por sesiones: </span>
          el saldo baja con cada check-in o carga manual. Faltar NO descuenta.
        </div>
      </div>
    </Card>
  );
}

function DiagramaCicloVida() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Repeat size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Ciclo de vida de una salida</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El recorrido completo, de la creación a la reactivación.
      </p>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {CICLO_VIDA.map((step, i) => {
          const Icon = step.icono;
          return (
            <div key={step.titulo} className="flex flex-1 items-center gap-3 lg:flex-col lg:text-center">
              <div className="flex flex-1 items-center gap-3 lg:flex-col">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-info-bg text-info-text dark:bg-info/15 dark:text-info">
                  <Icon size={22} />
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

function HorariosYCapacidad() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <CalendarClock size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Horarios y capacidad</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Cada salida tiene uno o más horarios con día, hora y cupo de socios.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Reglas al cargar horarios
          </p>
          <ul className="mt-3 space-y-1.5">
            {REGLAS_HORARIO.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-text-secondary">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                {r}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            El cupo y los choques
          </p>
          <ul className="mt-3 space-y-3">
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <Users size={16} className="mt-0.5 shrink-0 text-info-text dark:text-info" />
              <span>
                El cupo se controla con un bloqueo: dos inscripciones al mismo tiempo no pueden
                pasarse de la capacidad.
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              <span>
                A diferencia de las actividades, NO se rechaza por choque con el gimnasio, otras
                actividades ni el entrenamiento personal.
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <Clock size={16} className="mt-0.5 shrink-0 text-warning-text dark:text-warning" />
              <span>
                “Por sesiones” consume una sesión sólo con el check-in dentro de la ventana; si el
                socio llega fuera, la sesión queda para carga manual.
              </span>
            </li>
          </ul>
          <Pill className="mt-3 bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning">
            <AlertTriangle size={13} />
            Sin lista de espera: si está lleno, no entra
          </Pill>
        </div>
      </div>
    </Card>
  );
}

function QuienInscribe() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <UserPlus size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Quién inscribe al socio</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Dos caminos, con capacidades distintas.
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {ORIGENES.map((o) => {
          const Icon = o.icono;
          return (
            <div key={o.titulo} className="flex flex-col rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${COLOR_CLASSES[o.color]}`}>
                  <Icon size={16} />
                </span>
                <p className="text-sm font-semibold text-text-primary">{o.titulo}</p>
              </div>
              <p className="mt-2 text-xs text-text-secondary">{o.quien}</p>
              <p className="mt-2 rounded-lg bg-surface-elevated px-2.5 py-2 text-xs text-text-primary">
                {o.detalle}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        La inscripción crea la línea de facturación (mensual) o el paquete (por sesiones) en la
        suscripción vigente del socio. El alta/onboarding <span className="font-semibold">NO</span> inscribe salidas.
      </p>
    </Card>
  );
}

function SimuladorInscripcion() {
  const [estado, setEstado] = useState(() =>
    Object.fromEntries(VALIDACIONES.map((v) => [v.key, v.bloqueaSi === "on"]))
  );

  const bloqueos = VALIDACIONES.filter((v) => estado[v.key]);

  return (
    <Card className="col-span-full">
      <div className="flex items-center gap-2">
        <GitBranch size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">
          Simulador: ¿se puede inscribir?
        </h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Activá cada situación para ver si el sistema deja inscribir y con qué mensaje.
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
                  Inscripción rechazada
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
                  Inscripción creada
                </p>
                <p className="mt-2 text-xs text-success-text dark:text-success">
                  El socio queda anotado en el horario. Si la salida es mensual, se agrega la
                  cuota; si es por sesiones, se crea el paquete.
                </p>
              </>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Cómo leerlo
            </p>
            <p className="mt-2 text-xs text-text-secondary">
              Las tres primeras reglas se cumplen cuando están <span className="font-medium text-text-primary">destildadas</span>.
              Las demás bloquean cuando están <span className="font-medium text-text-primary">tildadas</span> (representan
              un problema). A diferencia de las actividades, acá no hay chequeo de choques con
              gimnasio, otras actividades ni entrenamiento personal.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SolicitudesDelSocio() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Inbox size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Solicitudes del socio</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El socio no se inscribe solo: pide y el staff aprueba o rechaza.
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

function RegistroDeSesiones() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <ClipboardCheck size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Registrar sesiones</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        En las salidas “por sesiones”, cada salida consume una sesión. Hay dos orígenes.
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
          Acá NO hay faltas ni recuperaciones
        </p>
        <p className="mt-2 text-xs text-warning-text dark:text-warning">
          A diferencia de las actividades, no existe tarea de no-asistencia: si el socio falta,
          no se le descuenta ninguna sesión. Tampoco se pueden recuperar salidas faltadas. El
          paquete sólo baja con el check-in en la ventana o con la carga manual del staff.
        </p>
      </div>

      <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        El registro es idempotente por inscripción + fecha + horario: el mismo día nunca se cobra
        dos veces. La sesión automática se traga los errores: el socio siempre puede entrar.
      </p>
    </Card>
  );
}

function DesactivarYReactivar() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Power size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Desactivar y reactivar</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Apagar una salida no es lo mismo que borrarla, y reactivar tiene su trampa.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <EyeOff size={16} className="text-muted-text" />
            <p className="text-sm font-semibold text-text-primary">Desactivar</p>
          </div>
          <ul className="mt-3 space-y-2">
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              No se borra nada: es baja lógica. El botón de eliminar hace lo mismo.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Apaga en cascada todos sus horarios activos.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <XCircle size={13} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              NO toca las inscripciones ni la facturación de los socios ya anotados: el cobro sigue.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warning-text dark:text-warning" />
              El socio sigue viendo su grupo en el portal, pero no puede pedir altas nuevas.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-info-text dark:text-info" />
            <p className="text-sm font-semibold text-text-primary">Reactivar</p>
          </div>
          <ul className="mt-3 space-y-2">
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Vuelve a activar la salida.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warning-text dark:text-warning" />
              Reactiva TODOS sus horarios, incluso los que el staff había apagado a propósito.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Cargar un horario nuevo activo en una salida inactiva la activa sola (camino
              “crear horarios nuevos”).
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <XCircle size={13} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              No se puede desactivar el único horario activo: hay que apagar la salida entera.
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

export default function OutingsFlow() {
  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill className="bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger">
              Solo desarrollo · no visible en producción
            </Pill>
            <Pill className="bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
              Fuente: AUDITORIA-SALIDAS.md
            </Pill>
          </div>
          <h1 className="mt-3 text-3xl font-bold">Flujo de salidas (Running grupal)</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Cómo funcionan hoy las salidas grupales, en forma visual e interactiva: qué es una
            salida, sus dos modos de cobro, los horarios, cómo se solicita e inscribe un socio,
            las sesiones, y qué pasa al desactivar o reactivar.
          </p>
        </div>

        <AnatomiaSalida />

        <LosDosModosDeCobro />

        <DiagramaCicloVida />

        <HorariosYCapacidad />

        <QuienInscribe />

        <SimuladorInscripcion />

        <SolicitudesDelSocio />

        <RegistroDeSesiones />

        <DesactivarYReactivar />

        <LoQueNoHace />

        <p className="pb-4 text-center text-xs text-text-secondary">
          Página de desarrollo: no se incluye en git y no existe en los builds de producción.
        </p>
      </div>
    </div>
  );
}
