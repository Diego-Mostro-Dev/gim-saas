import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Banknote,
  CalendarClock,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Coins,
  CreditCard,
  Dumbbell,
  EyeOff,
  GitBranch,
  Package,
  Power,
  QrCode,
  RefreshCw,
  Repeat,
  ShieldAlert,
  Sparkles,
  Tag,
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
    resumen: "El rótulo de la clase.",
    detalle:
      "Único dentro del gimnasio: no puede repetirse entre actividades (aunque sean de servicios distintos).",
  },
  {
    key: "profesor",
    campo: "Profesor/a",
    icono: Users,
    color: "muted",
    resumen: "Quién dicta la clase.",
    detalle:
      "Es sólo un nombre de texto libre. No es un usuario del sistema ni recibe notificaciones.",
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
      "Mensual: cuota fija como un plan. Por sesiones: paquete de N sesiones con coseguro; sólo el staff inscribe.",
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
      "Si no se elige, va al servicio “Actividades” del gimnasio. Debe pertenecer al mismo gimnasio.",
  },
];

const MODOS_COBRO = [
  {
    key: "monthly",
    titulo: "Mensual",
    icono: Banknote,
    color: "info",
    resumen: "La actividad se paga como una cuota mensual.",
    puntos: [
      "Al inscribir se crea una línea de facturación en la suscripción del socio.",
      "El precio se congela: el gimnasio puede cambiar el precio de la actividad sin tocar a los ya inscriptos.",
      "El socio puede autoinscribirse desde su portal (si está al día).",
      "Se cobra todos los meses mientras siga inscripto.",
    ],
  },
  {
    key: "sessions",
    titulo: "Por sesiones (paquete)",
    icono: Coins,
    color: "warning",
    resumen: "El socio compra un paquete de N clases.",
    puntos: [
      "El staff carga el total de sesiones y el coseguro por sesión.",
      "Cada clase asiste (o falta) descuenta 1 sesión del paquete.",
      "El cobro son pagos parciales: el sistema lleva el saldo pendiente.",
      "El portal del socio NO permite autoinscribirse: siempre lo hace el staff.",
    ],
  },
];

const CICLO_VIDA = [
  {
    titulo: "Crear",
    icono: Sparkles,
    descripcion:
      "El staff carga nombre, profesor, precio y modalidad de cobro. Va al servicio “Actividades”.",
  },
  {
    titulo: "Cargar horarios",
    icono: CalendarDays,
    descripcion:
      "Uno o más días con hora y cupo. No pueden superponerse dentro de la misma actividad.",
  },
  {
    titulo: "Inscribir socios",
    icono: UserPlus,
    descripcion:
      "Por el alta, por el staff o por el portal. Valida cupo y choques con gimnasio, otras actividades y PT.",
  },
  {
    titulo: "Cobrar / registrar sesiones",
    icono: CreditCard,
    descripcion:
      "Mensual: cuota en la suscripción. Por sesiones: paquete y coseguro; el check-in y las faltas descuentan.",
  },
  {
    titulo: "Desactivar",
    icono: EyeOff,
    descripcion:
      "Apaga la actividad y sus horarios. Las inscripciones y el cobro siguen igual.",
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
  "No puede haber dos horarios activos que se superpongan el mismo día en la misma actividad.",
  "No se repite la misma actividad + día + hora de inicio.",
  "El horario no se borra: se desactiva (baja lógica).",
  "No se puede desactivar el único horario activo de una actividad activa.",
];

const ORIGENES = [
  {
    titulo: "Alta / onboarding",
    quien: "El staff al registrar al socio (o el admin)",
    icono: UserPlus,
    color: "info",
    detalle:
      "Se eligen actividades y horarios junto con el alta. No se re-chequea la elegibilidad de pago.",
  },
  {
    titulo: "Staff",
    quien: "El personal, en la pantalla de inscripciones",
    icono: ClipboardCheck,
    color: "success",
    detalle:
      "Puede elegir modalidad mensual o paquete y fijar el coseguro. Es el único camino para las “por sesiones”.",
  },
  {
    titulo: "Portal del socio",
    quien: "El propio socio, con su token",
    icono: QrCode,
    color: "warning",
    detalle:
      "Sólo actividades mensuales. Las “por sesiones” responden “requiere inscripción por el staff”.",
  },
];

const VALIDACIONES = [
  {
    key: "feature",
    label: "El gimnasio tiene habilitada la feature “Actividades”",
    ok: "El gimnasio tiene la feature habilitada.",
    fail: "Las actividades no están habilitadas para este gimnasio.",
    bloqueaSi: "off",
  },
  {
    key: "pago",
    label: "El socio está al día (no está bloqueado por falta de pago)",
    ok: "El socio puede operar.",
    fail: "El miembro no puede operar. (El alta/onboarding saltea esta regla.)",
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
    key: "gimnasio",
    label: "Se superpone con un horario de gimnasio del socio",
    ok: "No choca con su horario de gimnasio.",
    fail: "El socio ya tiene un horario de gimnasio que se superpone con esta actividad.",
    bloqueaSi: "on",
  },
  {
    key: "actividad",
    label: "Se superpone con otra actividad del socio",
    ok: "No choca con otra actividad.",
    fail: "El miembro ya está inscripto en una actividad cuyo horario se superpone con esta actividad.",
    bloqueaSi: "on",
  },
  {
    key: "pt",
    label: "Se superpone con su entrenamiento personal",
    ok: "No choca con su entrenamiento personal.",
    fail: "El miembro tiene un entrenamiento personal cuyo horario se superpone con esta actividad.",
    bloqueaSi: "on",
  },
  {
    key: "sesiones",
    label: "Es una actividad “por sesiones” inscripta desde el portal",
    ok: "No aplica: la inscripción es por staff, alta o actividad mensual.",
    fail: "Esta actividad requiere inscripción por el staff. (403)",
    bloqueaSi: "on",
  },
];

const ORIGENES_SESION = [
  {
    key: "auto",
    titulo: "Automática",
    icono: QrCode,
    color: "success",
    detalle:
      "El socio hace check-in dentro de la ventana horaria de la clase y se descuenta 1 sesión solo.",
  },
  {
    key: "manual",
    titulo: "Manual",
    icono: ClipboardCheck,
    color: "info",
    detalle: "El staff la registra a mano desde la inscripción.",
  },
  {
    key: "recovery",
    titulo: "Recuperación",
    icono: Repeat,
    color: "warning",
    detalle:
      "El socio recupera una clase faltada en otro día. La falta original se anula para no cobrar dos veces.",
  },
  {
    key: "no_show",
    titulo: "No asistió",
    icono: CalendarX,
    color: "danger",
    detalle:
      "El socio no fue y la clase ya pasó: la tarea programada descuenta 1 sesión del paquete.",
  },
];

const REGLAS_NO_SHOW = [
  "Corre cada ~6 h junto con el mantenimiento de suscripciones.",
  "Sólo descuenta fechas de clase estrictamente anteriores a hoy.",
  "Saltea los días de cierre del gimnasio.",
  "Nunca supera el total del paquete (no deja saldos negativos).",
  "Las recuperaciones pendientes cubren las faltas más recientes.",
  "Avanza un marcador por inscripción para no re-procesar; si el staff quita una falta, no vuelve a descontarse.",
];

const NO_HACE = [
  "No tiene lista de espera: un horario lleno rechaza la inscripción, sin cola ni aviso de cupo liberado.",
  "No aprueba ni vence nada solo: inscribir y dar de baja son inmediatos.",
  "No avisa por email ni WhatsApp: ni alta, ni baja, ni clases, ni faltas.",
  "No autoinscribe actividades “por sesiones”: el socio nunca toma un paquete solo.",
  "No cobra el paquete por adelantado: sólo registra pagos parciales del coseguro.",
  "No versiona precios de actividad: el precio se congela por socio, no en la actividad.",
  "No actualiza el precio de los ya inscriptos a una actividad mensual si el gimnasio sube el precio.",
  "No distingue roles en el backend: cualquier usuario del gimnasio puede inscribir por API.",
  "No respeta feriados salvo los días de cierre cargados al descontar faltas.",
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

function AnatomiaActividad() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Dumbbell size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Anatomía de una actividad</h2>
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
        El precio y el nombre de la actividad no quedan grabados en la actividad: quedan
        congelados en cada línea de facturación de los socios ya inscriptos.
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
        El mismo catálogo de actividades se cobra de dos formas: cuota mensual o paquete de
        sesiones.
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
          el saldo del paquete baja con cada clase. Sin sesiones restantes, el paquete está agotado.
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
        <h2 className="text-lg font-bold text-text-primary">Ciclo de vida de una actividad</h2>
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
        Cada actividad tiene uno o más horarios con día, hora y cupo de socios.
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
                Al inscribir se rechaza si el horario choca con el horario de gimnasio del socio,
                con otra actividad o con su entrenamiento personal.
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <Clock size={16} className="mt-0.5 shrink-0 text-warning-text dark:text-warning" />
              <span>
                El choque con el gimnasio se calcula como bloques de 1 hora: clases más largas
                pueden no detectarse bien.
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
        Tres caminos, con capacidades distintas.
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
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
        suscripción vigente del socio.
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
                  El socio queda anotado en el horario. Si la actividad es mensual, se agrega la
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
              un problema). El alta/onboarding saltea la regla de pago.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function RegistroDeSesiones() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <ClipboardCheck size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Registrar sesiones y faltas</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        En las actividades “por sesiones”, cada clase consume una sesión. Hay cuatro orígenes.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="mt-4 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Reglas de la tarea de no-asistencia
        </p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {REGLAS_NO_SHOW.map((r) => (
            <li key={r} className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              {r}
            </li>
          ))}
        </ul>
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
        Apagar una actividad no es lo mismo que borrarla, y reactivar tiene su trampa.
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
              El socio sigue viendo su inscripción como “no disponible” en el portal.
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
              Vuelve a activar la actividad.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warning-text dark:text-warning" />
              Reactiva TODOS sus horarios, incluso los que el staff había apagado a propósito.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Cargar un horario nuevo activo en una actividad inactiva la activa sola (camino
              “crear horarios nuevos”).
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <XCircle size={13} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              No se puede desactivar el único horario activo: hay que apagar la actividad entera.
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

export default function ActivitiesFlow() {
  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill className="bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger">
              Solo desarrollo · no visible en producción
            </Pill>
            <Pill className="bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
              Fuente: AUDITORIA-ACTIVIDADES.md
            </Pill>
          </div>
          <h1 className="mt-3 text-3xl font-bold">Flujo de actividades</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Cómo funcionan hoy las actividades, en forma visual e interactiva: qué es una
            actividad, los dos modos de cobro, los horarios, cómo se inscribe un socio, las
            sesiones, las faltas y qué pasa al desactivar o reactivar.
          </p>
        </div>

        <AnatomiaActividad />

        <LosDosModosDeCobro />

        <DiagramaCicloVida />

        <HorariosYCapacidad />

        <QuienInscribe />

        <SimuladorInscripcion />

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
