import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowDown,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Clock,
  FileWarning,
  Info,
  Repeat,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  UserRoundCheck,
  X,
  XCircle,
} from "lucide-react";

const ESTADOS = {
  pending: {
    key: "pending",
    nombre: "Pendiente",
    color: "warning",
    icono: Clock,
    resumen: "El socio pidió el intercambio y todavía no lo miró nadie.",
    detalle:
      "Queda así hasta que el staff lo aprueba o lo rechaza. No hay vencimiento ni auto-aprobación. El socio puede cancelarlo mientras siga pendiente.",
    acciones: ["El socio puede cancelarlo", "El staff puede aprobar o rechazar"],
    comoSale: "El staff lo aprueba (queda Aprobado) o lo rechaza. El socio también puede cancelarlo.",
  },
  approved: {
    key: "approved",
    nombre: "Aprobado",
    color: "info",
    icono: CheckCircle2,
    resumen: "El staff lo dio por bueno, pero todavía no pasó nada.",
    detalle:
      "Aprobar no aplica el cambio: el sistema lo tendrá en cuenta recién en el check-in del día acordado. Hasta entonces el socio sigue con su horario habitual.",
    acciones: ["Se concreta en el check-in del día", "Ese día se respeta la capacidad efectiva"],
    comoSale: "Cuando el socio hace check-in el día acordado se registra la asistencia del intercambio.",
  },
  rejected: {
    key: "rejected",
    nombre: "Rechazado",
    color: "danger",
    icono: XCircle,
    resumen: "El staff no dio el OK (puede dejar una nota).",
    detalle:
      "El socio queda al tanto desde su portal. A diferencia del cambio permanente, un intercambio rechazado no dispara la espera de 7 días.",
    acciones: ["El socio ve el estado en su portal"],
    comoSale: "El socio puede pedir otro intercambio (respetando el límite del mes).",
  },
  cancelled: {
    key: "cancelled",
    nombre: "Cancelado",
    color: "muted",
    icono: X,
    resumen: "El socio lo retiró, u otro sistema lo canceló.",
    detalle:
      "El socio lo cancela desde su portal mientras esté pendiente. Además, el sistema cancela automáticamente todos los intercambios pendientes cuando se aprueba un cambio de plan.",
    acciones: ["Solo los pendientes se pueden cancelar", "Un cambio de plan lo cancela solo"],
    comoSale: "El socio puede pedir otro intercambio (respetando el límite del mes).",
  },
};

const PROBLEMAS = [
  {
    titulo: "Sólo un intercambio por fecha",
    icono: Repeat,
    impacto:
      "El socio no puede tener más de un intercambio vigente para la misma fecha, aunque sea en otro horario: el segundo se rechaza con 'Ya tienes un intercambio pendiente para esta fecha'.",
    origen:
      "Validación que cuenta todo intercambio no cancelado del socio para esa fecha.",
    evidencia: "backend/attendance/serializers.py:1145-1151",
  },
  {
    titulo: "La capacidad se controla recién en el check-in",
    icono: CalendarClock,
    impacto:
      "Aprobar no vuelve a chequear la capacidad. Si el horario se llena entre la aprobación y el día del intercambio, el socio no puede concretarlo: al hacer check-in ve 'El horario está completo'.",
    origen:
      "La capacidad del destino se revalida en el check-in, no al aprobar la solicitud.",
    evidencia: "backend/attendance/public_views.py:229-246",
  },
  {
    titulo: "No dispara la espera, pero sí consume el mes",
    icono: Clock,
    impacto:
      "Un intercambio no bloquea al socio por 7 días (a diferencia del cambio permanente), pero igual cuenta para el tope mensual de cambios. Es asimétrico y puede confundir.",
    origen: "El cooldown se aplica sólo al cambio permanente; el límite mensual cuenta ambos.",
    evidencia: "backend/attendance/serializers.py:653-663 · utils.py:374-402",
  },
  {
    titulo: "Un cambio de plan barre los intercambios pendientes",
    icono: Sparkles,
    impacto:
      "Si el socio tenía un intercambio pendiente y aprueban su cambio de plan, el intercambio se cancela en silencio (con nota en inglés) y hay que pedirlo de nuevo.",
    origen: "Al aprobar un plan change se cancelan todos los schedule changes y swaps pending del socio.",
    evidencia: "backend/subscriptions/views.py:446-453",
  },
  {
    titulo: "Demasiadas solicitudes desde la misma IP",
    icono: ShieldAlert,
    impacto:
      "Los pedidos públicos están limitados a 30/hora por IP: varios socios detrás de una misma conexión pueden recibir un 429.",
    origen: "PublicAttendanceRateThrottle = 30/h por IP.",
    evidencia: "backend/config/api/throttles.py:27-29",
  },
  {
    titulo: "La fecha debe coincidir con el día del horario",
    icono: FileWarning,
    impacto:
      "No se puede pedir un intercambio para cualquier fecha: la fecha elegida tiene que caer el mismo día de la semana que el horario de destino, y no ser un día de cierre del gimnasio.",
    origen: "Validación de día de la semana y de GymClosedDate.",
    evidencia: "backend/attendance/serializers.py:1102-1119",
  },
];

const CICLO = [
  {
    titulo: "Socio pide",
    icono: CalendarRange,
    descripcion:
      "Desde su portal elige una fecha futura y un horario (día + hora) de destino. Validan día, anticipación, capacidad y límite del mes.",
  },
  {
    titulo: "Pendiente",
    icono: Clock,
    descripcion:
      "Queda esperando al staff. El socio puede cancelarlo. No vence ni se aprueba solo.",
  },
  {
    titulo: "Staff aprueba o rechaza",
    icono: UserRoundCheck,
    descripcion:
      "Si aprueba, la solicitud queda Aprobada; si rechaza, queda Rechazado con nota opcional.",
  },
  {
    titulo: "Aprobado (sin efecto aún)",
    icono: CheckCircle2,
    descripcion:
      "Aprobar no cambia nada todavía: el socio sigue con su horario habitual hasta el día del intercambio.",
  },
  {
    titulo: "Check-in del día",
    icono: RotateCcw,
    descripcion:
      "Ese día, al hacer check-in, se registra la asistencia del intercambio (si el horario todavía tiene lugar).",
  },
];

const SITUACIONES = [
  "El gimnasio tiene los cambios de horario habilitados (`allow_schedule_changes`).",
  "El socio está al día de pago (si está suspendido, recibe 403 'Acceso suspendido por falta de pago').",
  "La fecha elegida es posterior a hoy.",
  "La fecha cae el mismo día de la semana que el horario de destino.",
  "La fecha no es un día de cierre del gimnasio.",
  "Hay anticipación suficiente (24 h por defecto) respecto del horario de destino.",
  "El horario de destino tiene capacidad efectiva libre.",
  "El horario de destino no es el actual del socio ni uno que ya tenga asignado.",
  "No hay otro intercambio vigente para esa misma fecha.",
  "No hay un cambio permanente pendiente a ese horario.",
  "No superó el máximo mensual (4 por defecto), que cuenta permanentes e intercambios.",
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

function SimuladorReglas() {
  const [habilitados, setHabilitados] = useState(true);
  const [alDia, setAlDia] = useState(true);
  const [fechaFutura, setFechaFutura] = useState(true);
  const [diaCoincide, setDiaCoincide] = useState(true);
  const [fechaAbierta, setFechaAbierta] = useState(true);
  const [anticipacionOk, setAnticipacionOk] = useState(true);
  const [capacidadOk, setCapacidadOk] = useState(true);
  const [slotDisponible, setSlotDisponible] = useState(true);
  const [sinOtroEnFecha, setSinOtroEnFecha] = useState(true);
  const [sinCambioPendiente, setSinCambioPendiente] = useState(true);
  const [limiteOk, setLimiteOk] = useState(true);

  const puedePedir =
    habilitados &&
    alDia &&
    fechaFutura &&
    diaCoincide &&
    fechaAbierta &&
    anticipacionOk &&
    capacidadOk &&
    slotDisponible &&
    sinOtroEnFecha &&
    sinCambioPendiente &&
    limiteOk;

  const chequeos = [
    {
      label: "Cambios habilitados en el gimnasio",
      ok: habilitados,
      msg: habilitados ? "Habilitados" : "Deshabilitado: el socio ni ve la opción",
    },
    {
      label: "Acceso por pago",
      ok: alDia,
      msg: alDia ? "Al día / sin deuda" : "Bloqueado: 403 'Acceso suspendido por falta de pago'",
    },
    {
      label: "La fecha es posterior a hoy",
      ok: fechaFutura,
      msg: fechaFutura ? "OK" : "La fecha debe ser posterior a hoy",
    },
    {
      label: "La fecha coincide con el día del horario",
      ok: diaCoincide,
      msg: diaCoincide
        ? "OK"
        : "La fecha no corresponde al día del horario de destino",
    },
    {
      label: "La fecha no es un día de cierre",
      ok: fechaAbierta,
      msg: fechaAbierta ? "OK" : "El gimnasio está cerrado ese día",
    },
    {
      label: "Anticipación mínima (24 h)",
      ok: anticipacionOk,
      msg: anticipacionOk
        ? "OK"
        : "Falta anticipación: 'Debes solicitar el intercambio con al menos 24 h'",
    },
    {
      label: "Capacidad del horario de destino",
      ok: capacidadOk,
      msg: capacidadOk ? "Hay lugar" : "Completo: 'El horario seleccionado está completo'",
    },
    {
      label: "El horario no es el actual ni uno ya asignado",
      ok: slotDisponible,
      msg: slotDisponible ? "OK" : "Es el mismo horario que ya tiene / ya lo tiene asignado",
    },
    {
      label: "No hay otro intercambio vigente para esa fecha",
      ok: sinOtroEnFecha,
      msg: sinOtroEnFecha ? "OK" : "Ya tienes un intercambio pendiente para esta fecha",
    },
    {
      label: "No hay un cambio permanente pendiente a ese horario",
      ok: sinCambioPendiente,
      msg: sinCambioPendiente ? "OK" : "Tienes un cambio de horario pendiente para ese horario",
    },
    {
      label: "Límite mensual",
      ok: limiteOk,
      msg: limiteOk ? "Dentro del máximo" : "Alcanzó el máximo de cambios del mes",
    },
  ];

  return (
    <Card>
      <div className="flex items-center gap-2">
        <ArrowLeftRight size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Simulador: ¿puede el socio pedir el intercambio?</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Ajustá cada validación que se chequea al crear el pedido. Si alguna falla, el sistema no lo guarda.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {[
            { label: "Cambios de horario habilitados", value: habilitados, set: setHabilitados },
            { label: "Acceso por pago (al día)", value: alDia, set: setAlDia },
            { label: "La fecha es posterior a hoy", value: fechaFutura, set: setFechaFutura },
            { label: "La fecha coincide con el día del horario", value: diaCoincide, set: setDiaCoincide },
            { label: "La fecha no es un día de cierre", value: fechaAbierta, set: setFechaAbierta },
            { label: "Anticipación de 24 h cumplida", value: anticipacionOk, set: setAnticipacionOk },
            { label: "Horario de destino con capacidad", value: capacidadOk, set: setCapacidadOk },
            { label: "El horario no es el actual ni uno ya asignado", value: slotDisponible, set: setSlotDisponible },
            { label: "No hay otro intercambio para esa fecha", value: sinOtroEnFecha, set: setSinOtroEnFecha },
            { label: "No hay un cambio permanente pendiente a ese horario", value: sinCambioPendiente, set: setSinCambioPendiente },
            { label: "Dentro del límite mensual", value: limiteOk, set: setLimiteOk },
          ].map((c) => (
            <label
              key={c.label}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="font-medium text-text-primary">{c.label}</span>
              <input
                type="checkbox"
                checked={c.value}
                onChange={(e) => c.set(e.target.checked)}
                className="size-4 accent-blue-500"
              />
            </label>
          ))}
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
              {puedePedir ? "El socio PODRÍA pedir el intercambio" : "El socio NO puede pedir el intercambio"}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {puedePedir
                ? "Pasan todas las validaciones. Queda Pendiente esperando al staff."
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

function DiagramaCiclo() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <RotateCcw size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">El recorrido del intercambio</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        A diferencia del cambio permanente, aprobar no aplica nada: el intercambio se concreta recién
        en el check-in del día acordado.
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

function EstadosDetalle() {
  const [abierto, setAbierto] = useState(ESTADOS.pending.key);
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Info size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Estados de una solicitud</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Tocá cada estado para ver su detalle. El intercambio va de Pendiente a Aprobado; el estado
        final real depende del check-in del día.
      </p>
      <div className="mt-4 space-y-2">
        {Object.values(ESTADOS).map((s) => {
          const Icon = s.icono;
          const color = {
            success: "bg-success-bg text-success-text dark:bg-success/15 dark:text-success",
            warning: "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning",
            danger: "bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger",
            info: "bg-info-bg text-info-text dark:bg-info/15 dark:text-info",
            muted: "bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted",
          }[s.color];
          const isOpen = abierto === s.key;
          return (
            <div key={s.key} className="overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setAbierto(isOpen ? null : s.key)}
                className="flex w-full items-center gap-3 bg-surface-input px-4 py-3 text-left transition hover:bg-surface-hover"
              >
                <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
                  <Icon size={16} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-text-primary">{s.nombre}</span>
                  <span className="block text-xs text-text-secondary">{s.resumen}</span>
                </span>
              </button>
              {isOpen && (
                <div className="space-y-3 border-t border-border bg-surface px-4 py-3 text-sm">
                  <p className="text-text-secondary">{s.detalle}</p>
                  {s.acciones?.length > 0 && (
                    <ul className="space-y-1">
                      {s.acciones.map((a) => (
                        <li key={a} className="flex items-start gap-2 text-text-secondary">
                          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">Cómo se sale: </span>
                    {s.comoSale}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function EnQueSituaciones() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">En qué situaciones puede hacer el intercambio</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El pedido se guarda sólo si pasa todas estas condiciones. Si alguna falla, el sistema lo rechaza.
      </p>
      <ul className="mt-4 grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
        {SITUACIONES.map((s) => (
          <li
            key={s}
            className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3"
          >
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SobreActividades() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Info size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Sobre las actividades</h2>
      </div>
      <div className="mt-3 space-y-2 text-sm text-text-secondary">
        <p>
          El intercambio se mueve entre <span className="font-medium text-text-primary">slots fijos del gimnasio (día + hora)</span>,
          sin actividad asociada. No filtra por actividad: el socio elige el horario de destino entre
          los slots con capacidad.
        </p>
        <p>
          El cambio de horario <span className="font-medium text-text-primary">de una actividad</span> (enrollments) es un
          sistema aparte: el socio lo hace desde el portal en <span className="font-medium text-text-primary">Actividades → “Elegir otro horario”</span>.
        </p>
      </div>
    </Card>
  );
}

function QuienAprueba() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <UserRoundCheck size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Quién aprueba</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El socio pide, el staff aprueba. El backend no distingue roles: cualquier usuario autenticado
        del gimnasio puede aprobar por API; la restricción de pantalla es solo del frontend.
      </p>

      <ul className="mt-4 space-y-2 text-sm text-text-secondary">
        <li className="flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
          Aprueba un usuario del gym → la solicitud queda Aprobado (no ejecutado).
        </li>
        <li className="flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-info-text dark:text-info" />
          Se concreta recién en el check-in del día acordado.
        </li>
        <li className="flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-info-text dark:text-info" />
          Ese día se respeta la capacidad efectiva del horario de destino.
        </li>
      </ul>
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
        Comportamientos reales del sistema actual que conviene tener en cuenta (ver AUDITORIA-HORARIOS.md).
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

function LoQueNohace() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Info size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Lo que el sistema NO hace</h2>
      </div>
      <ul className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          No aprueba solo: no hay auto-aprobación ni vencimiento de solicitudes
        </li>
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          No aplica el intercambio al aprobar: recién cuenta en el check-in del día
        </li>
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          No dispara la espera de 7 días (pero sí consume el límite del mes)
        </li>
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          No distingue roles en el backend (staff es solo de la interfaz)
        </li>
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          No permite cualquier fecha: tiene que coincidir con el día del horario
        </li>
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          No avisa por mail/whatsapp: todo se ve solo en el portal
        </li>
      </ul>
    </Card>
  );
}

export default function ScheduleSwapsFlow() {
  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill className="bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger">
              Solo desarrollo · no visible en producción
            </Pill>
            <Pill className="bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
              Fuente: AUDITORIA-HORARIOS.md
            </Pill>
          </div>
          <h1 className="mt-3 text-3xl font-bold">Cambio por única vez (intercambio)</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Cómo funciona el intercambio puntual hoy, en forma visual e interactiva: en qué
            situaciones se puede pedir, quién lo aprueba, qué se valida y qué problemas pueden
            aparecer. A diferencia del cambio permanente, recién se concreta en el check-in del día.
          </p>
          <Link
            to="/schedule-changes-flow"
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-info-text transition hover:bg-surface-input dark:text-info"
          >
            <ArrowLeftRight size={16} />
            Ver el flujo del cambio de horario permanente
          </Link>
        </div>

        <SimuladorReglas />

        <EnQueSituaciones />

        <DiagramaCiclo />

        <EstadosDetalle />

        <SobreActividades />

        <QuienAprueba />

        <ProblemasPosibles />

        <LoQueNohace />

        <p className="pb-4 text-center text-xs text-text-secondary">
          Página de desarrollo: no se incluye en git y no existe en los builds de producción.
        </p>
      </div>
    </div>
  );
}
