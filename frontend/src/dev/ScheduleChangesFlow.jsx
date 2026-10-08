import { useState } from "react";
import {
  ArrowRight,
  ArrowDown,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  FileWarning,
  Info,
  ShieldAlert,
  UserRoundCheck,
  Users,
  X,
  XCircle,
  RotateCcw,
  Sparkles,
  Repeat,
  CalendarRange,
} from "lucide-react";

const ESTADOS = {
  pending: {
    key: "pending",
    nombre: "Pendiente",
    color: "warning",
    icono: Clock,
    resumen: "El socio pidió el cambio y todavía no lo miró nadie.",
    detalle:
      "La solicitud queda así hasta que el staff la aprueba o la rechaza. No hay vencimiento ni auto-aprobación. El socio puede cancelarla mientras siga pendiente.",
    acciones: ["El socio puede cancelarla", "El staff puede aprobar o rechazar"],
    comoSale:
      "El staff la aprueba (queda ejecutado) o la rechaza. También puede cancelarla el propio socio.",
  },
  executed: {
    key: "executed",
    nombre: "Ejecutado",
    color: "success",
    icono: CheckCircle2,
    resumen: "Aprobado por el staff: el cambio ya se aplicó.",
    detalle:
      "Este es el estado final de un cambio permanente aprobado. El horario viejo se desactivó y el nuevo quedó activo el mismo día: no espera una fecha futura.",
    acciones: ["Horario nuevo activo desde hoy", "El horario viejo queda inactivo"],
    comoSale:
      "Es el estado final de un cambio permanente aprobado. No se revierte solo.",
    exception: true,
  },
  approved: {
    key: "approved",
    nombre: "Aprobado (solo intercambios)",
    color: "muted",
    icono: Check,
    resumen: "Estado que NO usan los cambios permanentes.",
    detalle:
      "En los cambios permanentes el estado 'aprobado' no existe en la práctica: aprobar deja la solicitud en 'ejecutado'. En los intercambios puntuales sí se usa: significa aprobado pero todavía no concretado.",
    acciones: [
      "Cambio permanente: nunca queda 'approved' (salta directo a ejecutado)",
      "Intercambio: 'approved' = aprobado, se concreta en el check-in",
    ],
    comoSale: "Para permanente: no aplica. Para intercambio: se concreta al hacer check-in el día acordado.",
  },
  rejected: {
    key: "rejected",
    nombre: "Rechazado",
    color: "danger",
    icono: XCircle,
    resumen: "El staff no dio el OK (puede dejar una nota).",
    detalle:
      "El socio queda al tanto desde su portal. Ojo: aunque esté rechazada, igual cuenta para la espera de 7 días antes del próximo pedido.",
    acciones: ["El socio ve el estado en su portal"],
    comoSale: "El socio puede pedir otro cambio después de la espera.",
  },
  cancelled_by_member: {
    key: "cancelled_by_member",
    nombre: "Cancelado por el socio",
    color: "muted",
    icono: X,
    resumen: "El socio retiró su pedido mientras estaba pendiente.",
    detalle: "Solo se puede cancelar mientras la solicitud siga en pendiente.",
    acciones: ["Solo desde el portal del socio"],
    comoSale: "El socio puede armar un nuevo pedido (respetando la espera).",
  },
  cancelled_by_staff: {
    key: "cancelled_by_staff",
    nombre: "Cancelado por el staff",
    color: "muted",
    icono: X,
    resumen: "El staff lo dio de baja, u otro sistema lo canceló.",
    detalle:
      "Además de cancelar a mano, el sistema cancela automáticamente todos los cambios pendientes de un socio cuando se aprueba un cambio de plan (con nota en inglés).",
    acciones: ["Puede ser manual o automático por cambio de plan"],
    comoSale: "El socio puede pedir de nuevo (respetando la espera).",
  },
};

const PROBLEMAS = [
  {
    titulo: "El panel marca mal las aprobadas",
    icono: FileWarning,
    impacto:
      "Las solicitudes ejecutadas muestran la etiqueta cruda 'executed' y el filtro 'Aprobadas' no muestra nada. Al aprobar, los otros usuarios ven el aviso 'Cambio permanente cancelado'.",
    origen:
      "El panel solo conoce los estados pending/approved/rejected/cancelled: no contempla 'executed' ni los 'cancelled_by_*'.",
    evidencia: "frontend/src/pages/ScheduleChangeRequests.jsx:16-21, 26 · useScheduleChangeWatcher.js:65-70",
  },
  {
    titulo: "El socio pierde días de la semana actual",
    icono: CalendarClock,
    impacto:
      "La pantalla dice 'Vigente: <fecha futura>', pero al aprobar el horario viejo se desactiva ya: si el socio tenía clases esta semana, las pierde hasta la próxima en el horario nuevo.",
    origen:
      "effective_date es solo informativo: la aprobación aplica el cambio de inmediato.",
    evidencia: "backend/attendance/views.py:893-904 · serializers.py:517-524",
  },
  {
    titulo: "La espera de 7 días cuenta hasta los rechazados",
    icono: Clock,
    impacto:
      "Una solicitud rechazada o cancelada por el staff igual bloquea al socio 7 días. Los intercambios no disparan esta espera: es asimétrico y puede confundir.",
    origen: "El cooldown se calcula sobre la última solicitud de cualquier estado; los swaps lo ignoran.",
    evidencia: "backend/attendance/serializers.py:653-663",
  },
  {
    titulo: "Posible error del servidor por doble pedido",
    icono: XCircle,
    impacto:
      "No hay verificación previa de 'ya existe un pendiente para ese horario': solo una regla de base de datos sin manejo de error, así que en un caso límite el socio puede ver un 500.",
    origen: "Única constraint de DB sin try/except (a diferencia del cambio de plan, que sí lo maneja).",
    evidencia: "backend/attendance/models.py:227-233 · subscriptions/serializers.py:52-64",
  },
  {
    titulo: "El staff puede crear cambios sin límites",
    icono: Users,
    impacto:
      "Del lado del personal no se validan ni la espera ni el máximo mensual. Al aprobar sí se re-chequea la capacidad del horario.",
    origen: "El serializer staff no valida cooldown ni límite mensual.",
    evidencia: "backend/attendance/serializers.py:443-515",
  },
  {
    titulo: "El horario puede quedar duplicado",
    icono: Repeat,
    impacto:
      "Si el staff edita a mano los horarios mientras hay una solicitud pendiente, al aprobar no se verifica que el viejo siga activo: el socio puede quedar con dos horarios.",
    origen: "Al aprobar no se re-valida que el horario 'current' siga siendo el activo del socio.",
    evidencia: "members/serializers.py:591-648 · attendance/views.py:893-904",
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
    titulo: "Un cambio de plan barre los cambios pendientes",
    icono: Sparkles,
    impacto:
      "Si el socio tenía un cambio pendiente y aprueban su cambio de plan, el cambio se cancela en silencio (nota en inglés) y hay que pedirlo de nuevo.",
    origen: "Al aprobar un plan change se cancelan todos los schedule changes y swaps pending del socio.",
    evidencia: "backend/subscriptions/views.py:446-453",
  },
];

const CICLO = [
  {
    titulo: "Socio pide",
    icono: CalendarRange,
    descripcion:
      "Desde su portal elige un horario de la misma actividad. Validan anticipación 24 h, espera 7 días, límite del mes y capacidad.",
  },
  {
    titulo: "Pendiente",
    icono: Clock,
    descripcion:
      "Queda así hasta que el staff mire la solicitud. El socio puede cancelarla. No vence ni se aprueba solo.",
  },
  {
    titulo: "Staff aprueba o rechaza",
    icono: UserRoundCheck,
    descripcion:
      "La aprueba (cambio permanente → ejecutado; intercambio → aprobado) o la rechaza con nota. Al aprobar re-chequea capacidad.",
  },
  {
    titulo: "Se aplica",
    icono: CheckCircle2,
    descripcion:
      "Permanente: horario nuevo activo el mismo día. Intercambio: recién en el check-in del día acordado se registra esa asistencia.",
  },
  {
    titulo: "Queda registrado",
    icono: RotateCcw,
    descripcion:
      "El socio lo ve en su portal y el staff en el historial. El contador mensual de cambios usados ya lo cuenta.",
  },
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
  const [usados, setUsados] = useState(2);
  const [maxMes, setMaxMes] = useState(4);
  const [cooldownHoras, setCooldownHoras] = useState(168);
  const [ultimaSolicitud, setUltimaSolicitud] = useState(3);
  const [avisosOk, setAvisosOk] = useState(true);
  const [capacidadOk, setCapacidadOk] = useState(true);
  const [alDia, setAlDia] = useState(true);
  const [mismoSlot, setMismoSlot] = useState(false);
  const [cambiosHabilitados, setCambiosHabilitados] = useState(true);

  const cooldownDias = Math.floor(cooldownHoras / 24);
  const pasoCoolodown = ultimaSolicitud >= cooldownDias;
  const limiteOk = usados < maxMes;
  const puedePedir =
    cambiosHabilitados && alDia && avisosOk && capacidadOk && !mismoSlot && pasoCoolodown && limiteOk;

  const chequeos = [
    {
      label: "Cambios habilitados en el gimnasio",
      ok: cambiosHabilitados,
      msg: cambiosHabilitados ? "Habilitados" : "Deshabilitado: el socio ni ve la opción",
    },
    {
      label: "Acceso por pago",
      ok: alDia,
      msg: alDia ? "Al día / sin deuda" : "Bloqueado: 403 'Acceso suspendido por falta de pago'",
    },
    {
      label: "Anticipación mínima (24 h)",
      ok: avisosOk,
      msg: avisosOk ? "OK" : "Falta anticipación: 'Debes solicitar con al menos 24 h de anticipación'",
    },
    {
      label: "Capacidad del horario",
      ok: capacidadOk,
      msg: capacidadOk ? "Hay lugar" : "Completo: 'El horario solicitado está completo'",
    },
    {
      label: "No pedir el mismo horario",
      ok: !mismoSlot,
      msg: mismoSlot ? "Es el mismo horario que ya tiene" : "OK",
    },
    {
      label: "Espera desde la última solicitud",
      ok: pasoCoolodown,
      msg: pasoCoolodown
        ? `Pasaron ${ultimaSolicitud} días (mínimo ${cooldownDias})`
        : `Faltan días: pediste hace ${ultimaSolicitud} día(s), mínimo ${cooldownDias}`,
    },
    {
      label: "Límite mensual",
      ok: limiteOk,
      msg: limiteOk ? `Usados ${usados} de ${maxMes}` : `Límite alcanzado: ${usados}/${maxMes}`,
    },
  ];

  return (
    <Card>
      <div className="flex items-center gap-2">
        <CalendarRange size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Simulador: ¿puede el socio pedir hoy?</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Ajustá las condiciones configurables del gimnasio y mirá si una solicitud pasaría todas las validaciones.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-primary">Cambios de horario habilitados</span>
            <input
              type="checkbox"
              checked={cambiosHabilitados}
              onChange={(e) => setCambiosHabilitados(e.target.checked)}
              className="size-4 accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-primary">Acceso por pago (al día)</span>
            <input
              type="checkbox"
              checked={alDia}
              onChange={(e) => setAlDia(e.target.checked)}
              className="size-4 accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-primary">Anticipación de 24 h cumplida</span>
            <input
              type="checkbox"
              checked={avisosOk}
              onChange={(e) => setAvisosOk(e.target.checked)}
              className="size-4 accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-primary">Horario con capacidad libre</span>
            <input
              type="checkbox"
              checked={capacidadOk}
              onChange={(e) => setCapacidadOk(e.target.checked)}
              className="size-4 accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-primary">Ya tiene ese horario asignado</span>
            <input
              type="checkbox"
              checked={mismoSlot}
              onChange={(e) => setMismoSlot(e.target.checked)}
              className="size-4 accent-blue-500"
            />
          </label>

          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text-primary">Espera mínima (cooldown)</span>
              <span className="font-semibold text-info-text dark:text-info">{cooldownDias} días</span>
            </div>
            <input
              type="range"
              min="0"
              max="14"
              value={cooldownDias}
              onChange={(e) => setCooldownHoras(Number(e.target.value) * 24)}
              className="mt-2 w-full accent-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text-primary">Días desde la última solicitud (de cualquier estado)</span>
              <span className="font-semibold text-info-text dark:text-info">{ultimaSolicitud} día(s)</span>
            </div>
            <input
              type="range"
              min="0"
              max="14"
              value={ultimaSolicitud}
              onChange={(e) => setUltimaSolicitud(Number(e.target.value))}
              className="mt-2 w-full accent-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text-primary">Usados este mes</span>
              <span className="font-semibold text-info-text dark:text-info">{usados}</span>
            </div>
            <input
              type="range"
              min="0"
              max={maxMes + 2}
              value={usados}
              onChange={(e) => setUsados(Number(e.target.value))}
              className="mt-2 w-full accent-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text-primary">Máximo por mes</span>
              <span className="font-semibold text-info-text dark:text-info">{maxMes}</span>
            </div>
            <input
              type="range"
              min="1"
              max="12"
              value={maxMes}
              onChange={(e) => setMaxMes(Number(e.target.value))}
              className="mt-2 w-full accent-blue-500"
            />
          </div>
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
              {puedePedir ? "El socio PODRÍA pedir el cambio" : "El socio NO puede pedir el cambio hoy"}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {puedePedir
                ? "Pasan todas las validaciones. Al aprobar, recién ahí se re-chequea la capacidad."
                : "Alguna validación falla. Con cooldown=0 y una carrera, el sistema puede devolver un error 500 (ver sección Problemas)."}
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

function EstadosDetalle() {
  const [abierto, setAbierto] = useState(ESTADOS.pending.key);
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Info size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Estados de una solicitud</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Tocá cada estado para ver su detalle. Cambio permanente: Pendiente → Ejecutado (el "Aprobado" no se usa).
        Intercambio: Pendiente → Aprobado (se concreta en el check-in).
      </p>
      <div className="mt-4 space-y-2">
        {Object.values(ESTADOS).map((s) => {
          const Icon = s.icono;
          const color = {
            success: "bg-success-bg text-success-text dark:bg-success/15 dark:text-success",
            warning: "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning",
            danger: "bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger",
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

function DiagramaCiclo() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <RotateCcw size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">El recorrido del cambio de horario</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Del pedido del socio al registro final. Distintas reglas actúan al pedir y recién la capacidad se re-chequea al aprobar.
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

function QuienAprueba() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <UserRoundCheck size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Quién aprueba</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El socio pide, el staff aprueba. Pero el backend no distingue roles: cualquier usuario autenticado del
        gimnasio puede aprobar por API; la restricción de pantalla es solo del frontend.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <CalendarRange size={16} className="text-info-text dark:text-info" />
            Cambio permanente
          </p>
          <ul className="mt-3 space-y-2 text-xs text-text-secondary">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Aprueba un usuario del gym → queda Ejecutado ya
            </li>
            <li className="flex items-start gap-2">
              <XCircle size={14} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              No valida cooldown ni límite del mes (solo capacidad)
            </li>
            <li className="flex items-start gap-2">
              <XCircle size={14} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              Se puede borrar por la API (sin trazabilidad)
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Repeat size={16} className="text-info-text dark:text-info" />
            Intercambio puntual
          </p>
          <ul className="mt-3 space-y-2 text-xs text-text-secondary">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Aprueba un usuario del gym → queda Aprobado (no ejecutado)
            </li>
            <li className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0 text-info-text dark:text-info" />
              Se concreta recién en el check-in del día acordado
            </li>
            <li className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0 text-info-text dark:text-info" />
              El día del chequeo respeta la capacidad efectiva
            </li>
          </ul>
        </div>
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
          No respeta fecha futura: el permanente se aplica apenas se aprueba
        </li>
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          No distingue roles en el backend (staff es solo de la interfaz)
        </li>
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          No usa el estado "Aprobado" en cambios permanentes (va directo a Ejecutado)
        </li>
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          No informa bien al staff (toast "cancelado" al aprobar)
        </li>
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          No avisa por mail/whatsapp: todo se ve solo en el portal
        </li>
      </ul>
    </Card>
  );
}

export default function ScheduleChangesFlow() {
  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-5">
          <div className="flex items-center gap-2">
            <Pill className="bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger">
              Solo desarrollo · no visible en producción
            </Pill>
            <Pill className="bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
              Fuente: AUDITORIA-HORARIOS.md
            </Pill>
          </div>
          <h1 className="mt-3 text-3xl font-bold">Cambios de horario</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Cómo funciona el flujo de cambios de horario hoy, en forma visual e interactiva: quién los aprueba,
            cómo se piden, qué reglas se aplican y qué problemas pueden aparecer.
          </p>
        </div>

        <SimuladorReglas />

        <DiagramaCiclo />

        <EstadosDetalle />

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