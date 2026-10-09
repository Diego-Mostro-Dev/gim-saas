import { useState } from "react";
import {
  ArrowRight,
  ArrowDown,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  Clock,
  EyeOff,
  Gift,
  GitBranch,
  Hourglass,
  Info,
  Lock,
  Package,
  Pencil,
  Power,
  Repeat,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";

const CAMPOS = [
  {
    key: "nombre",
    campo: "Nombre",
    icono: Tag,
    color: "info",
    resumen: "El rótulo que ve el socio.",
    detalle:
      "Único dentro del gimnasio. Queda congelado en cada período emitido: renombrar el plan después no cambia los meses ya facturados.",
  },
  {
    key: "precio",
    campo: "Precio",
    icono: Package,
    color: "success",
    resumen: "Lo que cuesta por mes.",
    detalle:
      "Al emitir cada ciclo el precio se congela en la línea de facturación. Cambiarlo después no toca lo ya emitido.",
  },
  {
    key: "visitas",
    campo: "Visitas semanales",
    icono: CalendarDays,
    color: "info",
    resumen: "Cuántos horarios por semana puede tener el socio.",
    detalle:
      "Se valida al inscribirlo y al pedir un cambio de plan. Vacío = ilimitado. No modifica el precio.",
  },
  {
    key: "duracion",
    campo: "Duración (días)",
    icono: Clock,
    color: "warning",
    resumen: "Sólo informativo.",
    detalle:
      "La facturación real es mensual por período calendario e ignora este campo para calcular fechas. Servicio para el manual, no para el cobro.",
    caveat: true,
  },
  {
    key: "activo",
    campo: "Activo",
    icono: Power,
    color: "success",
    resumen: "El interruptor de publicación.",
    detalle:
      "Un plan inactivo deja de ofrecerse a los socios (portal e inscripción pública), pero los que ya lo tienen siguen con él y el staff lo ve en la lista.",
  },
  {
    key: "servicio",
    campo: "Servicio",
    icono: Users,
    color: "muted",
    resumen: "Agrupador del catálogo.",
    detalle:
      "Si no se elige, el sistema asigna el servicio “Gimnasio” del gimnasio. Debe pertenecer al mismo gimnasio.",
  },
];

const CICLO_VIDA = [
  {
    titulo: "Crear",
    icono: Sparkles,
    descripcion:
      "El staff carga nombre, precio, duración (informativa) y visitas semanales. Si no elige servicio, va al servicio “Gimnasio”.",
  },
  {
    titulo: "Publicar",
    icono: Power,
    descripcion:
      "Aparece en la lista del staff y, si está activo, también en el portal del socio y en la autoinscripción pública.",
  },
  {
    titulo: "Usar en inscripciones",
    icono: UserPlus,
    descripcion:
      "Al inscribir un socio, el plan abre su primer ciclo (hoy → fin de mes) y fija su cuota mensual con precio congelado.",
  },
  {
    titulo: "Editar",
    icono: Pencil,
    descripcion:
      "Cambiar precio o nombre no toca los meses ya emitidos. El nuevo límite de visitas rige para cambios de plan venideros.",
  },
  {
    titulo: "Desactivar",
    icono: EyeOff,
    descripcion:
      "Deja de ofrecerse a socios nuevos, pero los actuales lo conservan en su ciclo y su renovación.",
  },
  {
    titulo: "Eliminar",
    icono: Trash2,
    descripcion:
      "Con confirmación. Si algún socio todavía lo tiene en una línea de facturación o en un pedido, el sistema bloquea el borrado.",
  },
];

const ORIGENES_REGISTRO = [
  {
    titulo: "Alta de staff",
    quien: "El personal, en la pantalla de socios",
    icono: UserPlus,
    color: "info",
    plan: "El plan de pago que elija (obligatorio si pide horarios de gimnasio)",
    notas: [
      "Cortesía: va directo al plan base, nace pagado.",
      "Sólo actividades: plan base en $0.",
      "Alta después del día de vencimiento: el primer ciclo se prorratea.",
    ],
  },
  {
    titulo: "Autoinscripción",
    quien: "El propio socio, con el código del gimnasio",
    icono: Users,
    color: "success",
    plan: "Elige entre los planes activos y de pago (nunca el plan base)",
    notas: [
      "El sistema valida que el plan sea del gimnasio y no base.",
      "Cortesía y descuento se ignoran: los asigna el staff después.",
      "El límite de visitas semanales acota los horarios de la misma inscripción.",
    ],
  },
  {
    titulo: "Alta del gimnasio",
    quien: "El admin, al crear el gimnasio",
    icono: Package,
    color: "warning",
    plan: "Los planes con los que el gimnasio arranca su catálogo",
    notas: [
      "El sistema crea además el plan base oculto, solo.",
      "El seed de demo crea los planes de ejemplo (Básico, Estándar, Premium…).",
    ],
  },
];

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
    quienPuede: "Staff o socio pueden cancelarlo mientras la fecha sea futura; al cancelar se libera la reserva de horarios.",
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

const REGLAS_PEDIDO = [
  "El gimnasio debe tener los cambios de plan habilitados (Configuración; por defecto sí).",
  "El socio necesita tener un ciclo vigente.",
  "No se puede pedir el plan base ni el mismo plan que ya tiene.",
  "El plan pedido debe ser del mismo gimnasio.",
  "Sólo un pedido pendiente por socio (también lo garantiza la base de datos).",
  "No puede haber otro cambio aprobado con fecha futura.",
  "Los horarios elegidos deben tener capacidad y respetar las visitas semanales del plan nuevo.",
  "Desde el portal, el socio debe estar al día con los pagos; por el staff no se chequea la deuda.",
];

const NO_HACE = [
  "No deja vender un plan “por días”: la duración es informativa, todo se factura por mes calendario.",
  "No prorratea cambios de plan ni renovaciones; sólo el primer ciclo de un alta tardía y la cortesía.",
  "No permite elegir la fecha del cambio: es hoy (sin ciclo vigente) o el 1° del mes siguiente.",
  "No admite dos pedidos de cambio a la vez, ni cambiar al mismo plan ni al plan base.",
  "No ofrece planes con vigencia limitada, por usos, ni cuotas por socio.",
  "No versiona el catálogo: no hay historial de precios; lo congelado vive en cada período.",
  "No cobra el cambio en el momento ni tiene botón para “pagar la diferencia”.",
  "No manda avisos por email o WhatsApp al crear, desactivar o aprobar un cambio.",
  "No bloquea la renovación de un socio cuyo plan quedó desactivado.",
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

function AnatomiaPlan() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Package size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Anatomía de un plan</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Qué es cada campo y qué decisión de negocio arrastra. Tocá una tarjeta para el detalle.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CAMPOS.map((c) => {
          const Icon = c.icono;
          return (
            <div
              key={c.key}
              className="rounded-xl border border-border bg-surface px-3 py-3"
            >
              <div className="flex items-center gap-2">
                <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${COLOR_CLASSES[c.color]}`}>
                  <Icon size={16} />
                </span>
                <p className="text-sm font-semibold text-text-primary">{c.campo}</p>
              </div>
              <p className="mt-2 text-xs font-medium text-text-primary">{c.resumen}</p>
              <p className="mt-1 text-xs text-text-secondary">{c.detalle}</p>
              {c.caveat && (
                <Pill className="mt-2 bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning">
                  <Info size={13} />
                  Sólo display: la facturación lo ignora
                </Pill>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        Precio y nombre quedan congelados en cada ciclo emitido: editar el plan nunca reescribe meses
        ya facturados.
      </p>
    </Card>
  );
}

function DiagramaCicloVida() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Repeat size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Ciclo de vida de un plan</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El recorrido completo en la pantalla “Planes”, de la creación al borrado.
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

function PlanBase() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Lock size={18} className="text-warning-text dark:text-warning" />
        <h2 className="text-lg font-bold text-text-primary">El plan base oculto</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        “Base Access”: el plan interno que el sistema crea y protege solo. El socio nunca ve ese
        nombre.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Para quién es
          </p>
          <ul className="mt-3 space-y-3">
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <Users size={16} className="mt-0.5 shrink-0 text-info-text dark:text-info" />
              <span>
                <span className="font-medium text-text-primary">Sólo actividades:</span> se inscribe a
                clases sin membresía de gimnasio. Su cuota mensual es el plan base en $0.
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <Gift size={16} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              <span>
                <span className="font-medium text-text-primary">Pase de cortesía:</span> al activarle
                la cortesía, su ciclo pasa al plan base y todo se factura en $0.
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Qué hace el sistema con él
          </p>
          <ul className="mt-3 space-y-3">
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <EyeOff size={16} className="mt-0.5 shrink-0 text-muted-text" />
              <span>No aparece en ningún listado (staff ni portal) ni se puede crear desde la API.</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <Tag size={16} className="mt-0.5 shrink-0 text-info-text dark:text-info" />
              <span>
                Donde corresponde se traduce a <span className="font-medium text-text-primary">“Solo actividades”</span>, y con cortesía activa a{" "}
                <span className="font-medium text-text-primary">“Pase de cortesía”</span>.
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              <span>No se puede elegir en un cambio de plan: está bloqueado por validación.</span>
            </li>
          </ul>
          <Pill className="mt-3 bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
            <Info size={13} />
            Se crea solo al dar de alta el gimnasio
          </Pill>
        </div>
      </div>
    </Card>
  );
}

function RegistroSocios() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <UserPlus size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Cómo se elige el plan al inscribir</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Tres caminos, y el plan que queda no es el mismo en todos.
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {ORIGENES_REGISTRO.map((o) => {
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
                {o.plan}
              </p>
              <ul className="mt-3 space-y-1.5">
                {o.notas.map((n) => (
                  <li key={n} className="flex items-start gap-2 text-xs text-text-secondary">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        En los tres caminos el ciclo nace hoy → fin de mes. El prorrateo del primer ciclo y los
        cobros los cubre el flujo de pagos.
      </p>
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
          Simulador: ¿qué pasa al aprobar un cambio de plan?
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
              La ejecución no depende de la deuda: una vez aprobado, se aplica aunque el socio esté debiendo.
            </li>
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Al aprobar o rechazar se cancelan sus cambios de horario pendientes.
            </li>
            {!efectoHoy && (
              <li className="flex items-start gap-2 text-sm text-text-secondary">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                Mientras sea futuro, staff o socio pueden cancelarlo y la reserva de horarios se libera.
              </li>
            )}
            {efectoHoy && (
              <li className="flex items-start gap-2 text-sm text-text-secondary">
                <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
                Camino excepcional: hoy no arrastra el entrenamiento personal ni consume saldo a favor
                (ver AUDITORIA-SUSCRIPCIONES §8).
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
                  <span className="mt-0.5 block text-xs opacity-80">Cambio Ejecutado · plan nuevo activo</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <div className="flex flex-1 items-center gap-2">
                <div className="flex-1 rounded-xl border border-border bg-muted-bg px-3 py-3 text-center text-sm font-medium text-muted-text dark:bg-muted/15 dark:text-muted">
                  Hoy → fin de mes
                  <span className="mt-0.5 block text-xs opacity-80">Sigue con el plan actual · horarios reservados</span>
                </div>
                <ArrowRight size={18} className="hidden shrink-0 text-text-secondary sm:block" />
                <ArrowDown size={18} className="shrink-0 text-text-secondary sm:hidden" />
              </div>
              <div className="flex flex-1 items-center gap-2">
                <div className="flex-1 rounded-xl border border-border bg-info-bg px-3 py-3 text-center text-sm font-medium text-info-text dark:bg-info/15 dark:text-info">
                  1° del mes siguiente
                  <span className="mt-0.5 block text-xs opacity-80">Job: se aplica solo → Ejecutado</span>
                </div>
                <ArrowRight size={18} className="hidden shrink-0 text-text-secondary sm:block" />
                <ArrowDown size={18} className="shrink-0 text-text-secondary sm:hidden" />
              </div>
              <div className="flex flex-1 items-center gap-2">
                <div className="flex-1 rounded-xl border border-border bg-success-bg px-3 py-3 text-center text-sm font-medium text-success-text dark:bg-success/15 dark:text-success">
                  Ciclo del mes nuevo
                  <span className="mt-0.5 block text-xs opacity-80">Plan nuevo · horarios sincronizados</span>
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

function DiagramaCambioPlan() {
  const [abierto, setAbierto] = useState("pending");

  return (
    <Card>
      <div className="flex items-center gap-2">
        <GitBranch size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Cambio de plan: el pedido y sus estados</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El cambio no es un botón: es un pedido con estado que revisa el staff. Tocá cada estado para
        ver sus transiciones.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {["pending", "approved", "executed"].map((key, i, arr) => {
          const s = ESTADOS_CAMBIO[key];
          const Icon = s.icono;
          return (
            <div key={key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAbierto(key)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  abierto === key
                    ? "border-info/50 bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
                }`}
              >
                <Icon size={16} />
                {s.nombre}
              </button>
              {i < arr.length - 1 && <ArrowRight size={16} className="shrink-0 text-text-secondary" />}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {["rejected", "cancelled_by_member", "cancelled_by_staff"].map((key) => {
          const s = ESTADOS_CAMBIO[key];
          const Icon = s.icono;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setAbierto(key)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                abierto === key
                  ? "border-danger/50 bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger"
                  : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
              }`}
            >
              <Icon size={16} />
              {s.nombre}
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-2">
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

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Reglas que se validan al crear el pedido (si algo falla, no se guarda)
        </p>
        <ul className="space-y-1.5">
          {REGLAS_PEDIDO.map((r) => (
            <li key={r} className="flex items-start gap-2 text-sm text-text-secondary">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              {r}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        El simulador interactivo de estas validaciones (con los mensajes reales del sistema) vive en
        el flujo de suscripciones: /subscriptions-flow.
      </p>
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

export default function PlansFlow() {
  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-5">
          <div className="flex items-center gap-2">
            <Pill className="bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger">
              Solo desarrollo · no visible en producción
            </Pill>
            <Pill className="bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
              Fuente: AUDITORIA-PLANES.md
            </Pill>
          </div>
          <h1 className="mt-3 text-3xl font-bold">Flujo de planes</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Cómo funciona el catálogo de planes hoy, en forma visual e interactiva: qué es un plan,
            el plan base oculto, su ciclo de vida, cómo se elige al inscribir un socio y el
            recorrido de un cambio de plan.
          </p>
        </div>

        <AnatomiaPlan />

        <DiagramaCicloVida />

        <PlanBase />

        <RegistroSocios />

        <SimuladorEfecto />

        <DiagramaCambioPlan />

        <LoQueNoHace />

        <p className="pb-4 text-center text-xs text-text-secondary">
          Página de desarrollo: no se incluye en git y no existe en los builds de producción.
        </p>
      </div>
    </div>
  );
}
