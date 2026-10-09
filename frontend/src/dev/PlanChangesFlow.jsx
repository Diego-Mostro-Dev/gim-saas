import { useState } from "react";
import {
  ArrowRight,
  ArrowDown,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  FileWarning,
  GitBranch,
  Hourglass,
  Info,
  Lock,
  Repeat,
  ShieldAlert,
  Sparkles,
  UserPlus,
  UserRoundCheck,
  Users,
  XCircle,
} from "lucide-react";

const ESTADOS_CAMBIO = {
  pending: {
    key: "pending",
    nombre: "Pendiente",
    color: "warning",
    icono: Hourglass,
    resumen: "El pedido quedó guardado y espera al staff.",
    detalle:
      "Aparece en la pantalla “Cambios de plan” del staff. Mientras está pendiente, el socio no puede pedir otro cambio (sólo uno por socio) y puede cancelarlo.",
    quienPuede: "El socio (su portal) o el staff pueden cancelarlo.",
    transiciones: [
      { a: "approved", cuando: "El staff lo aprueba", icono: CheckCircle2 },
      { a: "rejected", cuando: "El staff lo rechaza (con notas opcionales)", icono: XCircle },
      { a: "cancelled_by_member", cuando: "El socio lo cancela desde su portal", icono: XCircle },
      { a: "cancelled_by_staff", cuando: "El staff lo cancela", icono: XCircle },
    ],
  },
  approved: {
    key: "approved",
    nombre: "Aprobado (programado)",
    color: "info",
    icono: CalendarClock,
    resumen: "Aprobado con efecto el 1° del mes siguiente.",
    detalle:
      "El sistema ya reservó los horarios elegidos (ocupan lugar desde ahora). El día 1, junto con la renovación, aplica el cambio solo: pasa a Ejecutado. No depende de la deuda del socio.",
    quienPuede:
      "Staff o socio pueden cancelarlo mientras la fecha sea futura; al cancelar se libera la reserva de horarios.",
    transiciones: [
      { a: "executed", cuando: "El día 1 lo aplica el job de renovación", icono: CheckCircle2 },
      { a: "cancelled_by_staff", cuando: "El staff lo cancela (fecha aún futura)", icono: XCircle },
      { a: "cancelled_by_member", cuando: "El socio lo cancela (fecha aún futura)", icono: XCircle },
    ],
  },
  executed: {
    key: "executed",
    nombre: "Ejecutado",
    color: "success",
    icono: CheckCircle2,
    resumen: "El cambio ya se aplicó.",
    detalle:
      "Se creó (o se usó) el ciclo del mes con el plan nuevo, los horarios del socio se sincronizaron a los elegidos y la reserva se activó. Es idempotente: si el job corre dos veces, no duplica nada.",
    quienPuede: "Estado final. No tiene acciones.",
    transiciones: [],
  },
  rejected: {
    key: "rejected",
    nombre: "Rechazado",
    color: "danger",
    icono: XCircle,
    resumen: "El staff lo rechazó.",
    detalle:
      "Queda registrado con las notas del staff si las hubo. El socio puede volver a pedir otro cambio después.",
    quienPuede: "Estado final.",
    transiciones: [],
  },
  cancelled_by_member: {
    key: "cancelled_by_member",
    nombre: "Cancelado por el socio",
    color: "muted",
    icono: XCircle,
    resumen: "El socio se arrepintió.",
    detalle:
      "Válido mientras el pedido esté Pendiente o Aprobado con fecha futura. Si era un cambio programado, se libera la reserva de horarios.",
    quienPuede: "Estado final.",
    transiciones: [],
  },
  cancelled_by_staff: {
    key: "cancelled_by_staff",
    nombre: "Cancelado por el staff",
    color: "muted",
    icono: XCircle,
    resumen: "El staff lo dio de baja.",
    detalle:
      "Mismo comportamiento que la cancelación del socio, pero la hace el equipo del gimnasio (por ejemplo, para deshacer una aprobación apresurada).",
    quienPuede: "Estado final.",
    transiciones: [],
  },
};

const CICLO = [
  {
    titulo: "Se pide",
    icono: UserPlus,
    descripcion:
      "El socio desde su portal (si está al día de pago) o el staff a su nombre. Elige el plan nuevo y los horarios que quiere para ese plan.",
  },
  {
    titulo: "Pendiente",
    icono: Hourglass,
    descripcion:
      "El pedido queda esperando al staff. Sólo uno por socio. El socio puede cancelarlo mientras siga pendiente.",
  },
  {
    titulo: "El staff resuelve",
    icono: UserRoundCheck,
    descripcion:
      "Aprueba o rechaza (con notas opcionales). Al resolver se cancelan los pedidos de cambio de horario que el socio tuviera pendientes.",
  },
  {
    titulo: "Fecha de efecto",
    icono: CalendarClock,
    descripcion:
      "Con ciclo vigente (lo normal): 1° del mes siguiente → queda Aprobado y reserva los horarios. Sin ciclo vigente: hoy → Ejecutado en el acto.",
  },
  {
    titulo: "Ejecutado",
    icono: CheckCircle2,
    descripcion:
      "El día 1 el job aplica el cambio junto con la renovación: crea el ciclo con el plan nuevo, sincroniza los horarios y marca Ejecutado.",
  },
];

const PROBLEMAS = [
  {
    titulo: "Un cambio de plan puede no reflejar el saldo a favor",
    icono: FileWarning,
    impacto:
      "Si el cambio reprecia un período que ya estaba pagado, el sistema no vuelve a calcular el pago ni genera el crédito correspondiente. Hoy no conviene prometer que «la diferencia queda a favor» por este camino.",
    origen:
      "apply_plan_change reprecia sin volver a sincronizar el flag de pago (bug P21, abierto).",
    evidencia: "backend/subscriptions/services.py:1804-1814 · BUG-Pagos.md (P21)",
  },
  {
    titulo: "Aprobar con efecto hoy no arrastra el entrenamiento personal",
    icono: Sparkles,
    impacto:
      "El camino del 1° del mes copia actividades, salidas y PT y consume el saldo a favor; el de efecto inmediato solo copia actividades y salidas. Un socio con PT mensual puede no ver esa línea ese mes.",
    origen: "El branch de efecto inmediato no replica todo lo que replica el job.",
    evidencia:
      "backend/subscriptions/views.py:362-364 · backend/subscriptions/services.py:1800-1803",
  },
  {
    titulo: "Aprobar o rechazar barre los cambios de horario pendientes",
    icono: Repeat,
    impacto:
      "Al resolver un cambio de plan el sistema cancela todos los cambios y swaps de horario pendientes del socio (con nota en inglés). Hay que volver a pedirlos.",
    origen:
      "La resolución de un plan change cancela las solicitudes de horario pending del socio.",
    evidencia: "backend/subscriptions/views.py:446-453",
  },
];

const NO_HACE = [
  "No prorratea el cambio de plan: lo ya pagado del período en curso queda como está y el ciclo nuevo nace con el precio del plan nuevo.",
  "No permite elegir la fecha del cambio: es hoy (sin ciclo vigente) o el 1° del mes siguiente.",
  "No admite dos pedidos de cambio a la vez, ni cambiar al mismo plan ni al plan base.",
  "No cobra el cambio en el momento ni tiene botón para «pagar la diferencia».",
  "No ejecuta el cambio condicionado a la deuda: una vez aprobado, se aplica aunque el socio esté debiendo.",
  "No manda avisos por email o WhatsApp: el socio ve el estado solo en su portal.",
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

function SimuladorReglas() {
  const [canal, setCanal] = useState("member");
  const [habilitados, setHabilitados] = useState(true);
  const [cicloVigente, setCicloVigente] = useState(true);
  const [alDia, setAlDia] = useState(true);
  const [distinto, setDistinto] = useState(true);
  const [esBase, setEsBase] = useState(false);
  const [mismoGym, setMismoGym] = useState(true);
  const [existePendiente, setExistePendiente] = useState(false);
  const [aprobadoFuturo, setAprobadoFuturo] = useState(false);
  const [capacidadOk, setCapacidadOk] = useState(true);
  const [visitasOk, setVisitasOk] = useState(true);

  const pagoOk = canal === "staff" ? true : alDia;

  const puedePedir =
    habilitados &&
    cicloVigente &&
    pagoOk &&
    distinto &&
    !esBase &&
    mismoGym &&
    !existePendiente &&
    !aprobadoFuturo &&
    capacidadOk &&
    visitasOk;

  const chequeos = [
    {
      label: "Cambios de plan habilitados en el gimnasio",
      ok: habilitados,
      msg: habilitados ? "Habilitados" : "Deshabilitado: el socio ni ve la opción",
    },
    {
      label: "El socio tiene un ciclo vigente",
      ok: cicloVigente,
      msg: cicloVigente ? "OK" : "Sin ciclo vigente: el cambio tendría efecto HOY",
    },
    {
      label: "Acceso por pago (sólo si lo pide el socio)",
      ok: pagoOk,
      msg: pagoOk
        ? canal === "staff"
          ? "El staff no chequea la deuda"
          : "Al día / sin deuda"
        : "Suspendido: 'Acceso suspendido por falta de pago'",
    },
    {
      label: "El plan pedido es distinto al actual",
      ok: distinto,
      msg: distinto ? "OK" : "Es el mismo plan que ya tiene",
    },
    {
      label: "El plan pedido no es el plan base",
      ok: !esBase,
      msg: esBase ? "Bloqueado: no se puede elegir el plan base oculto" : "OK",
    },
    {
      label: "El plan es del mismo gimnasio",
      ok: mismoGym,
      msg: mismoGym ? "OK" : "El plan pertenece a otro gimnasio",
    },
    {
      label: "No hay otro pedido pendiente",
      ok: !existePendiente,
      msg: existePendiente ? "Ya existe un pedido pendiente (uno por socio)" : "OK",
    },
    {
      label: "No hay un cambio aprobado con fecha futura",
      ok: !aprobadoFuturo,
      msg: aprobadoFuturo ? "Ya hay un cambio aprobado esperando el 1° del mes" : "OK",
    },
    {
      label: "Los horarios elegidos tienen capacidad",
      ok: capacidadOk,
      msg: capacidadOk ? "Hay lugar" : "Completo: 'El horario solicitado está completo'",
    },
    {
      label: "La cantidad de horarios respeta las visitas semanales del plan nuevo",
      ok: visitasOk,
      msg: visitasOk ? "OK" : "Supera el límite de visitas semanales del plan",
    },
  ];

  return (
    <Card>
      <div className="flex items-center gap-2">
        <GitBranch size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">
          Simulador: ¿puede pedirse este cambio?
        </h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Ajustá las reglas que se validan al crear el pedido. Si alguna falla, el sistema ni siquiera
        lo guarda.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">¿Quién pide el cambio?</p>
            <div className="flex gap-2">
              {[
                { key: "member", label: "El socio (portal)" },
                { key: "staff", label: "El staff" },
              ].map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setCanal(o.key)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    canal === o.key
                      ? "border-info/50 bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {[
            { label: "Cambios de plan habilitados", value: habilitados, set: setHabilitados },
            { label: "Tiene ciclo vigente hoy", value: cicloVigente, set: setCicloVigente },
            { label: "Está al día con el pago", value: alDia, set: setAlDia, soloSocio: true },
            { label: "El plan pedido es distinto al actual", value: distinto, set: setDistinto },
            { label: "El plan pedido es el plan base oculto", value: esBase, set: setEsBase },
            { label: "El plan es de otro gimnasio", value: !mismoGym, set: (v) => setMismoGym(!v) },
            { label: "Ya tiene un pedido pendiente", value: existePendiente, set: setExistePendiente },
            { label: "Ya tiene un cambio aprobado a futuro", value: aprobadoFuturo, set: setAprobadoFuturo },
            { label: "Los horarios elegidos tienen capacidad", value: capacidadOk, set: setCapacidadOk },
            { label: "Respeta las visitas semanales del plan nuevo", value: visitasOk, set: setVisitasOk },
          ].map((c) => {
            const disabled = c.soloSocio && canal === "staff";
            return (
              <label
                key={c.label}
                className={`flex items-center justify-between gap-3 text-sm ${disabled ? "opacity-50" : ""}`}
              >
                <span className="font-medium text-text-primary">{c.label}</span>
                <input
                  type="checkbox"
                  checked={c.value}
                  disabled={disabled}
                  onChange={(e) => c.set(e.target.checked)}
                  className="size-4 accent-blue-500"
                />
              </label>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          <div
            className={`rounded-xl border p-4 text-sm ${
              puedePedir
                ? "border-success/40 bg-success-bg dark:bg-success/10"
                : "border-danger/40 bg-danger-bg dark:bg-danger/10"
            }`}
          >
            <p className="font-semibold text-text-primary">
              {puedePedir ? "El pedido se crearía" : "El pedido NO se crea"}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {puedePedir
                ? "Pasa todas las validaciones. Queda Pendiente esperando al staff."
                : "Alguna validación falla y el sistema rechaza la creación del pedido."}
            </p>
          </div>

          <ul className="space-y-2">
            {chequeos.map((c) => (
              <li key={c.label} className="flex items-start gap-2 text-sm text-text-secondary">
                {c.ok ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                ) : (
                  <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
                )}
                <span>
                  <span className="font-medium text-text-primary">{c.label}: </span>
                  {c.msg}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function SimuladorEfecto() {
  const [cicloVigente, setCicloVigente] = useState(true);
  const efectoHoy = !cicloVigente;

  return (
    <Card className="col-span-full">
      <div className="flex items-center gap-2">
        <CalendarClock size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">
          Simulador: ¿qué pasa al aprobar el cambio?
        </h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        La fecha de efecto se calcula sola al aprobar: hoy sólo si el socio no tiene ciclo vigente;
        lo normal es que rija el 1° del mes siguiente.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <span className="font-medium text-text-primary">
              ¿Tiene ciclo vigente hoy al momento de aprobar?
            </span>
            <input
              type="checkbox"
              checked={cicloVigente}
              onChange={(e) => setCicloVigente(e.target.checked)}
              className="size-4 accent-blue-500"
            />
          </label>

          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <p className="font-semibold text-text-primary">
              {efectoHoy ? "Fecha de efecto: HOY" : "Fecha de efecto: 1° del mes siguiente"}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {efectoHoy
                ? "El pedido pasa directamente a Ejecutado: se abre el ciclo del mes actual con el plan nuevo, en este mismo momento."
                : "El pedido queda Aprobado y espera. El sistema reserva los horarios elegidos desde ya; el día 1 lo aplica solo, junto con la renovación."}
            </p>
          </div>

          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              La ejecución no depende de la deuda: una vez aprobado, se aplica aunque el socio esté
              debiendo.
            </li>
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Al aprobar o rechazar se cancelan sus cambios de horario pendientes.
            </li>
            {!efectoHoy && (
              <li className="flex items-start gap-2 text-sm text-text-secondary">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                Mientras sea futuro, staff o socio pueden cancelarlo y la reserva de horarios se
                libera.
              </li>
            )}
            {efectoHoy && (
              <li className="flex items-start gap-2 text-sm text-text-secondary">
                <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
                Camino excepcional: hoy no arrastra el entrenamiento personal ni consume saldo a
                favor (ver sección Problemas).
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Línea de tiempo del socio
          </p>

          {efectoHoy ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <div className="flex flex-1 items-center gap-2">
                <div className="flex-1 rounded-xl border border-border bg-success-bg px-3 py-3 text-center text-sm font-medium text-success-text dark:bg-success/15 dark:text-success">
                  Hoy
                  <span className="mt-0.5 block text-xs opacity-80">
                    Cambio Ejecutado · plan nuevo activo
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <div className="flex flex-1 items-center gap-2">
                <div className="flex-1 rounded-xl border border-border bg-muted-bg px-3 py-3 text-center text-sm font-medium text-muted-text dark:bg-muted/15 dark:text-muted">
                  Hoy → fin de mes
                  <span className="mt-0.5 block text-xs opacity-80">
                    Sigue con el plan actual · horarios reservados
                  </span>
                </div>
                <ArrowRight size={18} className="hidden shrink-0 text-text-secondary sm:block" />
                <ArrowDown size={18} className="shrink-0 text-text-secondary sm:hidden" />
              </div>
              <div className="flex flex-1 items-center gap-2">
                <div className="flex-1 rounded-xl border border-border bg-info-bg px-3 py-3 text-center text-sm font-medium text-info-text dark:bg-info/15 dark:text-info">
                  1° del mes siguiente
                  <span className="mt-0.5 block text-xs opacity-80">
                    Job: se aplica solo → Ejecutado
                  </span>
                </div>
                <ArrowRight size={18} className="hidden shrink-0 text-text-secondary sm:block" />
                <ArrowDown size={18} className="shrink-0 text-text-secondary sm:hidden" />
              </div>
              <div className="flex flex-1 items-center gap-2">
                <div className="flex-1 rounded-xl border border-border bg-success-bg px-3 py-3 text-center text-sm font-medium text-success-text dark:bg-success/15 dark:text-success">
                  Ciclo del mes nuevo
                  <span className="mt-0.5 block text-xs opacity-80">
                    Plan nuevo · horarios sincronizados
                  </span>
                </div>
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-text-secondary">
            El job de renovación corre con el tráfico de la app y con un cron cada 6 h; aplicar el
            cambio es idempotente, correrlo dos veces no duplica nada.
          </p>
        </div>
      </div>
    </Card>
  );
}

function DiagramaCiclo() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Repeat size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">El recorrido del cambio de plan</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Del pedido del socio a la ejecución, pasando por la aprobación del staff.
      </p>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {CICLO.map((step, i) => {
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
              {i < CICLO.length - 1 && (
                <ArrowDown size={18} className="shrink-0 text-text-secondary lg:hidden" />
              )}
              {i < CICLO.length - 1 && (
                <ArrowRight size={18} className="hidden shrink-0 text-text-secondary lg:block" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function QuienPide() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Users size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Quién pide y quién aprueba</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El socio pide desde su portal, el staff también puede pedirlo a su nombre. La aprobación
        siempre la hace el staff en la pantalla “Cambios de plan”.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <CalendarRange size={16} className="text-info-text dark:text-info" />
            El socio (su portal)
          </p>
          <ul className="mt-3 space-y-2 text-xs text-text-secondary">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Elige el plan nuevo y arma los horarios que quiere para ese plan.
            </li>
            <li className="flex items-start gap-2">
              <XCircle size={14} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              Si está suspendido por falta de pago no puede pedirlo ni cancelarlo.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Puede cancelar mientras esté Pendiente o Aprobado con fecha futura.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <UserRoundCheck size={16} className="text-info-text dark:text-info" />
            El staff
          </p>
          <ul className="mt-3 space-y-2 text-xs text-text-secondary">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Puede crear el pedido a nombre del socio con el mismo formulario, sin chequear deuda.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Aprueba o rechaza (con notas opcionales) desde “Cambios de plan”.
            </li>
            <li className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0 text-info-text dark:text-info" />
              El gimnasio entero puede deshabilitar los cambios desde Configuración
              (<span className="font-medium text-text-primary">allow_plan_changes</span>, por
              defecto activo).
            </li>
          </ul>
        </div>
      </div>

      <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        El plan base oculto (“Solo actividades”) nunca se puede elegir en un cambio: está bloqueado
        por validación.
      </p>
    </Card>
  );
}

function EstadosDetalle() {
  const [abierto, setAbierto] = useState("pending");
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Lock size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Estados del pedido</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El cambio no es un botón: es un pedido con estado que revisa el staff. Tocá cada estado para
        ver sus transiciones.
      </p>
      <div className="mt-4 space-y-2">
        {Object.values(ESTADOS_CAMBIO).map((s) => {
          const Icon = s.icono;
          const isOpen = abierto === s.key;
          return (
            <div key={s.key} className="overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setAbierto(isOpen ? null : s.key)}
                className="flex w-full items-center gap-3 bg-surface-input px-4 py-3 text-left transition hover:bg-surface-hover"
              >
                <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${COLOR_CLASSES[s.color]}`}>
                  <Icon size={16} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-text-primary">{s.nombre}</span>
                  <span className="block text-xs text-text-secondary">{s.resumen}</span>
                </span>
                <ArrowDown
                  size={16}
                  className={`shrink-0 text-text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="border-t border-border px-4 py-3">
                  <p className="text-sm text-text-secondary">{s.detalle}</p>
                  <p className="mt-2 text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">Quién puede actuar: </span>
                    {s.quienPuede}
                  </p>
                  {s.transiciones.length > 0 && (
                    <>
                      <p className="mt-3 mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        Hacia dónde pasa
                      </p>
                      <ul className="space-y-1.5">
                        {s.transiciones.map((t) => {
                          const TIcon = t.icono;
                          const destino = ESTADOS_CAMBIO[t.a];
                          return (
                            <li key={t.a + t.cuando} className="flex items-start gap-2 text-sm text-text-secondary">
                              <TIcon size={15} className="mt-0.5 shrink-0 text-info-text dark:text-info" />
                              <span>
                                <span className="font-medium text-text-primary">{destino.nombre}</span>
                                {" — "}
                                {t.cuando}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ProblemasPosibles() {
  const [abierto, setAbierto] = useState(PROBLEMAS[0].titulo);
  return (
    <Card>
      <div className="flex items-center gap-2">
        <ShieldAlert size={18} className="text-danger-text dark:text-danger" />
        <h2 className="text-lg font-bold text-text-primary">Problemas que pueden pasar</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Comportamientos reales del sistema actual que conviene tener en cuenta (ver
        AUDITORIA-SUSCRIPCIONES.md §8).
      </p>
      <div className="mt-4 space-y-2">
        {PROBLEMAS.map((p) => {
          const Icon = p.icono;
          const isOpen = abierto === p.titulo;
          return (
            <div key={p.titulo} className="overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setAbierto(isOpen ? null : p.titulo)}
                className="flex w-full items-center gap-3 bg-surface-input px-4 py-3 text-left transition hover:bg-surface-hover"
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning">
                  <Icon size={16} />
                </span>
                <span className="flex-1 text-sm font-semibold text-text-primary">{p.titulo}</span>
                <ArrowDown
                  size={16}
                  className={`shrink-0 text-text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-border bg-surface px-4 py-3 text-sm">
                  <p className="text-text-secondary">{p.impacto}</p>
                  <p className="text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">Origen: </span>
                    {p.origen}
                  </p>
                  <p className="text-[10px] font-mono text-muted-text">{p.evidencia}</p>
                </div>
              )}
            </div>
          );
        })}
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

export default function PlanChangesFlow() {
  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-5">
          <div className="flex items-center gap-2">
            <Pill className="bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger">
              Solo desarrollo · no visible en producción
            </Pill>
            <Pill className="bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
              Fuente: AUDITORIA-PLANES.md §5 · AUDITORIA-SUSCRIPCIONES.md §3
            </Pill>
          </div>
          <h1 className="mt-3 text-3xl font-bold">Cambios de plan</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Cómo funciona el flujo de cambios de plan hoy, en forma visual e interactiva: quién
            pide, qué se valida, cómo lo resuelve el staff, cuándo rige el cambio y qué problemas
            pueden aparecer.
          </p>
        </div>

        <SimuladorReglas />

        <SimuladorEfecto />

        <DiagramaCiclo />

        <EstadosDetalle />

        <QuienPide />

        <ProblemasPosibles />

        <LoQueNoHace />

        <p className="pb-4 text-center text-xs text-text-secondary">
          Página de desarrollo: no se incluye en git y no existe en los builds de producción.
        </p>
      </div>
    </div>
  );
}
