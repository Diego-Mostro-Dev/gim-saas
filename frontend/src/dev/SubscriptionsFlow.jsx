import { useState } from "react";
import {
  ArrowRight,
  ArrowDown,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  FileWarning,
  Gift,
  Info,
  RefreshCw,
  Repeat,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  UserRoundCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

const ORIGENES = [
  {
    titulo: "Alta de socio",
    icono: UserRoundCheck,
    quien: "El staff, desde Miembros",
    descripcion:
      "Elegís el plan y el ciclo arranca hoy hasta el último día del mes, pendiente de pago. Si el socio es de cortesía, nace con el plan base y ya pagado.",
    nota: "Prorrateo sólo en el primer ciclo: si el alta es posterior al día de vencimiento, se cobra sólo lo que queda del mes.",
  },
  {
    titulo: "Inscripción del propio socio",
    icono: Sparkles,
    quien: "El socio, desde el portal público",
    descripcion:
      "Misma salida que la alta: el ciclo nace sin pagar, desde hoy hasta fin de mes. Ahí no se pueden elegir cortesía ni descuento.",
    nota: "El plan tiene que ser de pago.",
  },
  {
    titulo: "Renovación automática",
    icono: RotateCcw,
    quien: "El sistema, el 1° del mes",
    descripcion:
      "Copia plan, actividades, entrenamiento personal y salidas al ciclo nuevo, con los precios congelados. Queda pendiente de pago.",
    nota: "Solo si la renovación está prendida y el socio no está bloqueado.",
  },
  {
    titulo: "Cambio de plan",
    icono: Repeat,
    quien: "Lo pide el socio o el staff, lo aprueba el staff",
    descripcion:
      "Al aprobar se calcula la fecha de efecto: hoy (si ya no queda ciclo vigente) o el 1° del mes siguiente, que es lo normal.",
    nota: "Un solo pedido pendiente por socio.",
  },
  {
    titulo: "Recuperación",
    icono: RefreshCw,
    quien: "El staff, desde Recuperar socios",
    descripcion:
      "Para socios que quedaron bloqueados y tienen la deuda en cero. Se abre un ciclo nuevo desde hoy hasta fin de mes.",
    nota: "Con deuda, el sistema no procede.",
  },
];

const PROBLEMAS = [
  {
    titulo: "Un cambio de plan puede no reflejar el saldo a favor",
    icono: FileWarning,
    impacto:
      "Si el cambio reprecia un período que ya estaba pagado, el sistema no vuelve a calcular el pago ni genera el crédito correspondiente. Hoy no conviene prometer que «la diferencia queda a favor» por este camino.",
    origen:
      "apply_plan_change repricia sin volver a sincronizar el flag de pago (bug P21, abierto).",
    evidencia: "backend/subscriptions/services.py:1804-1814 · BUG-Pagos.md (P21)",
  },
  {
    titulo: "El botón «recuperable» no siempre coincide con recuperar",
    icono: Info,
    impacto:
      "La lista de socios calcula las condiciones en un lugar y la acción de recuperar en otro, así que puede ofrecer recuperar y el sistema rechazar.",
    origen:
      "get_is_recoverable no mira la misma deuda que valida recover_member (bug P24). AUDITORIA-PAGOS §6 dice que son las mismas condiciones: hoy no lo son.",
    evidencia:
      "backend/members/serializers.py:258-410 · backend/subscriptions/services.py:1333-1432",
  },
  {
    titulo: "La etiqueta «Pagado/Pendiente» puede estar desactualizada",
    icono: Wallet,
    impacto:
      "Es una copia que en algunos caminos se escribe a mano. La deuda real es la que calcula el sistema: mire el saldo pendiente, no la etiqueta.",
    origen:
      "paid se escribe a mano en la renovación y en la recuperación (bugs P22/P23, abiertos).",
    evidencia:
      "backend/subscriptions/services.py:1314 · services.py:1418 · subscriptions/serializers.py:286",
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
    titulo: "Dar una cortesía re-prende la renovación",
    icono: Gift,
    impacto:
      "Activar la cortesía vuelve a encender la renovación automática aunque el socio la hubiera apagado. Al desactivarla hay que elegir plan.",
    origen: "mutate_membership fija auto_renew=True al activar la cortesía.",
    evidencia: "backend/subscriptions/domain.py:193-194",
  },
  {
    titulo: "El socio que nunca pagó su primer mes igual se renueva",
    icono: Clock,
    impacto:
      "Su estado al cierre es «pago inicial pendiente», que no corta la renovación, así que el mes siguiente nace un ciclo nuevo deudor.",
    origen: "La candidateización solo excluye el estado «blocked».",
    evidencia:
      "backend/subscriptions/services.py:1176-1183 · backend/subscriptions/services.py:1540-1554",
  },
  {
    titulo: "Borrar la suscripción desde el admin deja pagos huérfanos",
    icono: ShieldAlert,
    impacto:
      "Los pagos siguen existiendo pero dejan de contar en la deuda del socio.",
    origen: "La relación pago → suscripción queda en NULL (bug P12, fuera del plan de fixes).",
    evidencia: "BUG-Pagos.md (P12)",
  },
];

const NO_HACE = [
  "No da de baja a un socio ni cancela una suscripción con un botón.",
  "No deja que el staff apague o prenda la renovación desde la pantalla (por API es de solo lectura).",
  "No prorratea al cambiar de plan ni en las renovaciones (sí en el primer ciclo de una alta posterior al vencimiento y al activar o quitar una cortesía).",
  "No permite elegir la fecha en que rige un cambio de plan: es hoy o el 1° del mes.",
  "No admite dos pedidos de cambio de plan a la vez, ni cambiar al mismo plan ni al plan base.",
  "No avisa por email ni WhatsApp: todos los avisos son dentro del portal.",
  "No cobra el cambio de plan en el momento ni tiene botón para «pagar la diferencia».",
  "No permite prórrogas ni vencimientos por socio: todos los ciclos terminan el último día del mes.",
];

const STAFF = [
  {
    pantalla: "Estado comercial",
    puede: [
      "Ver por socio: ciclo actual, días que le quedan, «Pagado/Pendiente», renovación y origen",
      "Ver actividades incluidas, total, descuento y el historial de ciclos",
      "Filtrar (activos, pendientes, sin ciclo, con/sin renovación) y mirar los 4 contadores",
    ],
    noPuede: ["Editar la suscripción: solo puede entrar a «Registrar pago»"],
  },
  {
    pantalla: "Cambios de plan",
    puede: ["Ver los pedidos con sus estados", "Aprobar o rechazar, con notas opcionales"],
    noPuede: ["Elegir otra fecha de efecto que no sea hoy o el 1° del mes"],
  },
  {
    pantalla: "Planes",
    puede: [
      "Crear, editar y eliminar planes: nombre, descripción, precio, duración en días y visitas semanales",
    ],
    noPuede: ["Cambiar el precio de un mes ya emitido (queda congelado)"],
  },
  {
    pantalla: "Recuperar socios",
    puede: ["Ver el desglose de la deuda, cobrar y «Recuperar socio»"],
    noPuede: ["Recuperar con deuda: el sistema lo rechaza"],
  },
];

const SOCIO = [
  {
    pantalla: "Su estado",
    puede: [
      "Ver «✓ Al día», «⚠ Pago inicial pendiente», «⚠ Pendiente de pago», «❌ Pago vencido» o «⛔ Acceso suspendido»",
      "Ver cuántos días le quedan: «X días restantes», «Vence hoy» o «Vencido»",
    ],
  },
  {
    pantalla: "Renovación",
    puede: [
      "Ver «Activada/Cancelada» y cancelarla o reactivarla con un botón",
      "Recibir el aviso cuando faltan 7 días o menos, con la fecha",
    ],
  },
  {
    pantalla: "Cambio de plan",
    puede: [
      "Pedir el cambio con sus horarios, ver si está pendiente o aprobado y cancelarlo",
    ],
  },
  {
    pantalla: "Sus pagos",
    puede: ["Ver pagos pendientes e historial (solo lectura: el cobro lo hace el staff)"],
  },
  {
    pantalla: "Si algo está mal",
    puede: [
      "Ver un banner con el motivo y cuánto debe (pago inicial pendiente, acceso suspendido o renovación saltada)",
    ],
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

function SimuladorCambioPlan() {
  const [habilitados, setHabilitados] = useState(true);
  const [suscripcionActiva, setSuscripcionActiva] = useState(true);
  const [desdePortal, setDesdePortal] = useState(true);
  const [alDia, setAlDia] = useState(true);
  const [esPlanBase, setEsPlanBase] = useState(false);
  const [mismoPlan, setMismoPlan] = useState(false);
  const [otroPendiente, setOtroPendiente] = useState(false);
  const [aprobadoFuturo, setAprobadoFuturo] = useState(false);
  const [capacidadOk, setCapacidadOk] = useState(true);
  const [visitasOk, setVisitasOk] = useState(true);
  const [cicloVigente, setCicloVigente] = useState(true);

  const chequeos = [
    {
      label: "Cambios habilitados en el gimnasio",
      ok: habilitados,
      msg: habilitados
        ? "Configuración → permitidos (por defecto sí)"
        : "«El gimnasio no permite cambios de plan.»",
    },
    {
      label: "Socio con suscripción activa",
      ok: suscripcionActiva,
      msg: suscripcionActiva
        ? "Tiene un ciclo que cubre hoy"
        : "«El socio no tiene una suscripción activa.»",
    },
    {
      label: "Acceso por pago",
      ok: !desdePortal || alDia,
      msg:
        !desdePortal || alDia
          ? desdePortal
            ? "Al día"
            : "No aplica: por el staff no se chequea la deuda"
          : "«Acceso suspendido por falta de pago.» (403, solo desde el portal)",
    },
    {
      label: "No es el plan base",
      ok: !esPlanBase,
      msg: esPlanBase ? "«No se puede solicitar el plan base.»" : "Es un plan de pago",
    },
    {
      label: "Distinto al plan actual",
      ok: !mismoPlan,
      msg: mismoPlan ? "«El plan solicitado es el mismo que el actual.»" : "OK",
    },
    {
      label: "Un solo pedido pendiente",
      ok: !otroPendiente,
      msg: otroPendiente
        ? "«Ya tienes una solicitud de cambio de plan pendiente.»"
        : "Sin pedidos pendientes",
    },
    {
      label: "Sin cambio aprobado para el próximo ciclo",
      ok: !aprobadoFuturo,
      msg: aprobadoFuturo
        ? "«Ya tienes un cambio de plan aprobado programado para el próximo ciclo.»"
        : "OK",
    },
    {
      label: "Capacidad de los horarios elegidos",
      ok: capacidadOk,
      msg: capacidadOk ? "Hay lugar en todos" : "«El horario martes 19:00 está completo.»",
    },
    {
      label: "Visitas semanales del plan nuevo",
      ok: visitasOk,
      msg: visitasOk ? "Dentro del cupo del plan" : "«El plan permite un máximo de 2 horarios semanales.»",
    },
  ];

  const valido = chequeos.every((c) => c.ok);

  const toggle = (setter) => (e) => setter(e.target.checked);

  return (
    <Card>
      <div className="flex items-center gap-2">
        <CalendarDays size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">
          Simulador: ¿se guardaría este cambio de plan?
        </h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Las mismas reglas que valida el sistema al crear un pedido, con sus mensajes reales. Después mirá
        qué pasa al aprobarlo.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="font-medium text-text-primary">Cambios habilitados</span>
              <input
                type="checkbox"
                checked={habilitados}
                onChange={toggle(setHabilitados)}
                className="size-4 accent-blue-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="font-medium text-text-primary">Con suscripción activa</span>
              <input
                type="checkbox"
                checked={suscripcionActiva}
                onChange={toggle(setSuscripcionActiva)}
                className="size-4 accent-blue-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="font-medium text-text-primary">Lo pide el socio (portal)</span>
              <input
                type="checkbox"
                checked={desdePortal}
                onChange={toggle(setDesdePortal)}
                className="size-4 accent-blue-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="font-medium text-text-primary">Al día con los pagos</span>
              <input
                type="checkbox"
                checked={alDia}
                onChange={toggle(setAlDia)}
                className="size-4 accent-blue-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="font-medium text-text-primary">El plan nuevo es el base</span>
              <input
                type="checkbox"
                checked={esPlanBase}
                onChange={toggle(setEsPlanBase)}
                className="size-4 accent-amber-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="font-medium text-text-primary">Es el mismo plan</span>
              <input
                type="checkbox"
                checked={mismoPlan}
                onChange={toggle(setMismoPlan)}
                className="size-4 accent-amber-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="font-medium text-text-primary">Ya tiene otro pendiente</span>
              <input
                type="checkbox"
                checked={otroPendiente}
                onChange={toggle(setOtroPendiente)}
                className="size-4 accent-amber-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="font-medium text-text-primary">Ya hay uno aprobado a futuro</span>
              <input
                type="checkbox"
                checked={aprobadoFuturo}
                onChange={toggle(setAprobadoFuturo)}
                className="size-4 accent-amber-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="font-medium text-text-primary">Horarios completos</span>
              <input
                type="checkbox"
                checked={!capacidadOk}
                onChange={(e) => setCapacidadOk(!e.target.checked)}
                className="size-4 accent-red-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="font-medium text-text-primary">Supera las visitas semanales</span>
              <input
                type="checkbox"
                checked={!visitasOk}
                onChange={(e) => setVisitasOk(!e.target.checked)}
                className="size-4 accent-red-500"
              />
            </label>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <span className="font-medium text-text-primary">
              ¿Tiene ciclo vigente hoy al momento de aprobar?
            </span>
            <input
              type="checkbox"
              checked={cicloVigente}
              onChange={toggle(setCicloVigente)}
              className="size-4 accent-blue-500"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <div
            className={`rounded-xl border p-4 text-sm ${
              valido
                ? "border-success/40 bg-success-bg dark:bg-success/10"
                : "border-danger/40 bg-danger-bg dark:bg-danger/10"
            }`}
          >
            <p className="font-semibold text-text-primary">
              {valido
                ? "El pedido SE GUARDARÍA (queda Pendiente)"
                : "El pedido NO se guarda"}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {valido
                ? "Pasa todas las validaciones. Recién ahí el staff lo mira, aprueba o rechaza."
                : "El sistema responde 400 con el mensaje de la regla que falla en la lista."}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <p className="font-semibold text-text-primary">Al aprobarlo</p>
            <p className="mt-1 text-xs text-text-secondary">
              {cicloVigente
                ? "Fecha de efecto: 1° del mes siguiente. Queda Aprobado, el sistema reserva los horarios elegidos y el día 1 lo aplica solo, junto con la renovación."
                : "Fecha de efecto: hoy. Queda Ejecutado al instante y se crea el ciclo nuevo con el plan nuevo en este momento."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill className="bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning">
                Al aprobar o rechazar se cancelan sus cambios de horario pendientes
              </Pill>
              {!cicloVigente && (
                <Pill className="bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger">
                  Efecto hoy: no arrastra el entrenamiento personal ni consume el saldo a favor
                </Pill>
              )}
            </div>
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

function DiagramaOrigenes() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Repeat size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">De dónde sale una suscripción</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Cinco caminos, y no todos los hace la misma persona.
      </p>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {ORIGENES.map((step, i) => {
          const Icon = step.icono;
          return (
            <div key={step.titulo} className="flex flex-1 items-center gap-3 lg:flex-col lg:text-center">
              <div className="flex flex-1 items-center gap-3 lg:flex-col">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-info-bg text-info-text dark:bg-info/15 dark:text-info">
                  <Icon size={22} />
                </div>
                <div className="flex-1 lg:text-center">
                  <p className="text-sm font-semibold text-text-primary">{step.titulo}</p>
                  <p className="mt-1 text-xs font-medium text-info-text dark:text-info">
                    {step.quien}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">{step.descripcion}</p>
                  <Pill className="mt-2 bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
                    {step.nota}
                  </Pill>
                </div>
              </div>
              {i < ORIGENES.length - 1 && (
                <ArrowDown size={18} className="shrink-0 text-text-secondary lg:hidden" />
              )}
              {i < ORIGENES.length - 1 && (
                <ArrowRight size={18} className="hidden shrink-0 text-text-secondary lg:block" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DiagramaRenovacion() {
  const pasos = [
    {
      titulo: "Mes en curso",
      icono: CalendarDays,
      descripcion:
        "El ciclo corre del alta al último día del mes. El precio y el descuento quedan congelados: tocarlos después no cambia este mes.",
    },
    {
      titulo: "Interruptor",
      icono: RotateCcw,
      descripcion:
        "El socio la apaga o la reactiva desde su portal. El staff no tiene ese botón: por la API el campo es de solo lectura.",
    },
    {
      titulo: "Aviso",
      icono: Clock,
      descripcion:
        "Si la renovación está prendida y faltan 7 días o menos para el vencimiento, el portal muestra el aviso con la fecha.",
    },
    {
      titulo: "Tarea cada 6 h",
      icono: RefreshCw,
      descripcion:
        "Se dispara con el tráfico de la app y con un cron del repositorio. Nadie la corre a mano (también existe un comando manual).",
    },
    {
      titulo: "Día 1",
      icono: CheckCircle2,
      descripcion:
        "Si no hay bloqueo, nace el ciclo nuevo: mismo plan, copia actividades, PT y salidas, consume el saldo a favor y queda pendiente de pago.",
    },
  ];

  const noRenueva = [
    "El socio estaba bloqueado por falta de pago al cerrar el mes (el portal lo avisa y el staff lo recupera).",
    "El gimnasio está desactivado, el socio está inactivo o el plan quedó deshabilitado.",
    "El ciclo nuevo ya existe por otro camino: no lo duplica.",
  ];

  const seApagaSola = [
    "El ciclo nuevo ya fue cubierto por otro camino.",
    "El sistema detecta rezago: el mes de destino ya estaba cerrado.",
  ];

  return (
    <Card>
      <div className="flex items-center gap-2">
        <RefreshCw size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">La renovación automática</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Cada suscripción tiene un interruptor: prendido, cuando termina el mes el sistema crea el ciclo
        siguiente.
      </p>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {pasos.map((step, i) => {
          const Icon = step.icono;
          return (
            <div key={step.titulo} className="flex flex-1 items-center gap-3 lg:flex-col lg:text-center">
              <div className="flex flex-1 items-center gap-3 lg:flex-col">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-text dark:bg-success/15 dark:text-success">
                  <Icon size={22} />
                </div>
                <div className="flex-1 lg:text-center">
                  <p className="text-sm font-semibold text-text-primary">{step.titulo}</p>
                  <p className="mt-1 text-xs text-text-secondary">{step.descripcion}</p>
                </div>
              </div>
              {i < pasos.length - 1 && (
                <ArrowDown size={18} className="shrink-0 text-text-secondary lg:hidden" />
              )}
              {i < pasos.length - 1 && (
                <ArrowRight size={18} className="hidden shrink-0 text-text-secondary lg:block" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger-text dark:text-danger">
            No renueva si
          </p>
          <ul className="space-y-1.5">
            {noRenueva.map((n) => (
              <li key={n} className="flex items-start gap-2 text-sm text-text-secondary">
                <XCircle size={15} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
                {n}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-warning-text dark:text-warning">
            Se apaga sola si
          </p>
          <ul className="space-y-1.5">
            {seApagaSola.map((n) => (
              <li key={n} className="flex items-start gap-2 text-sm text-text-secondary">
                <XCircle size={15} className="mt-0.5 shrink-0 text-warning-text dark:text-warning" />
                {n}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-text-secondary">
            En esos casos pasa a «sin renovación» y la vuelve a prender solo el socio.
          </p>
        </div>
      </div>
    </Card>
  );
}

function CortesiasYDescuentos() {
  const reglasCortesia = [
    "El socio no paga: todo lo que se le emite sale en $0.",
    "Nunca se le bloquea por falta de pago y no consume saldo a favor.",
    "Se activa y desactiva desde el formulario de edición del socio (checkbox «Pase de cortesía»).",
    "Al activarla: pasa al plan base, prorratea por los días que ya pasaron y vuelve a prender la renovación.",
    "Al desactivarla: hay que elegir plan y prorratea por los días que quedan del mes.",
  ];

  const reglasDescuento = [
    "El gimnasio crea descuentos porcentuales desde Configuración y se los asigna a un socio.",
    "El porcentaje se congela al emitir cada período: desactivarlo después no cambia lo ya cobrado.",
    "En la tarjeta del staff, el precio original aparece tachado junto al precio final.",
    "Excepción: los períodos anteriores al campo usan el descuento vigente del socio.",
  ];

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Gift size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Cortesías y descuentos</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Las dos formas que existen de que un socio pague menos de lo que dice el plan.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning">
              <Gift size={16} />
            </span>
            <p className="text-sm font-semibold text-text-primary">Pase de cortesía (is_comp)</p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {reglasCortesia.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-text-secondary">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                {r}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-info-bg text-info-text dark:bg-info/15 dark:text-info">
              <PercentIcon />
            </span>
            <p className="text-sm font-semibold text-text-primary">Descuento porcentual</p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {reglasDescuento.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-text-secondary">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        Ese prorrateo de la cortesía y el del primer ciclo de una alta posterior al día de vencimiento
        son los únicos que existen: ni al cambiar de plan ni en las renovaciones se divide el mes (el
        cambio cae en la frontera del mes).
      </p>
    </Card>
  );
}

function PercentIcon() {
  return (
    <span className="text-sm font-bold leading-none">%</span>
  );
}

function QueVeCadaRol() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Users size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Qué ve cada rol</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El mismo dato, pero cada uno lo mira desde su pantalla.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Pill className="bg-info-bg text-info-text dark:bg-info/15 dark:text-info">
              <UserRoundCheck size={13} />
              Staff
            </Pill>
          </div>
          <div className="space-y-3">
            {STAFF.map((bloque) => (
              <div key={bloque.pantalla} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-sm font-semibold text-text-primary">{bloque.pantalla}</p>
                <ul className="mt-2 space-y-1">
                  {bloque.puede.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-text-secondary">
                      <CheckCircle2
                        size={15}
                        className="mt-0.5 shrink-0 text-success-text dark:text-success"
                      />
                      {p}
                    </li>
                  ))}
                  {bloque.noPuede.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-text-secondary">
                      <XCircle size={15} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Pill className="bg-success-bg text-success-text dark:bg-success/15 dark:text-success">
              <CreditCard size={13} />
              Socio (portal)
            </Pill>
          </div>
          <div className="space-y-3">
            {SOCIO.map((bloque) => (
              <div key={bloque.pantalla} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-sm font-semibold text-text-primary">{bloque.pantalla}</p>
                <ul className="mt-2 space-y-1">
                  {bloque.puede.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-text-secondary">
                      <CheckCircle2
                        size={15}
                        className="mt-0.5 shrink-0 text-success-text dark:text-success"
                      />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
        Comportamientos reales del sistema actual, registrados en BUG-Pagos.md (ver
        AUDITORIA-SUSCRIPCIONES.md §8). Conviene conocerlos antes de prometerlos en el manual.
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
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Info size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Lo que el sistema NO hace hoy</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Para no prometerlo en el manual. El cobro, los días de pago y los bloqueos los cubre el flujo de
        pagos.
      </p>
      <ul className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
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
    </Card>
  );
}

export default function SubscriptionsFlow() {
  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-5">
          <div className="flex items-center gap-2">
            <Pill className="bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger">
              Solo desarrollo · no visible en producción
            </Pill>
            <Pill className="bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
              Fuente: AUDITORIA-SUSCRIPCIONES.md
            </Pill>
          </div>
          <h1 className="mt-3 text-3xl font-bold">Suscripciones</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Cómo funciona hoy el ciclo de una suscripción, en forma visual e interactiva: de dónde sale,
            qué pasa al cambiar de plan, cómo renueva sola, qué es una cortesía, qué ve cada rol y qué
            problemas pueden aparecer.
          </p>
        </div>

        <SimuladorCambioPlan />

        <DiagramaOrigenes />

        <DiagramaRenovacion />

        <CortesiasYDescuentos />

        <QueVeCadaRol />

        <ProblemasPosibles />

        <LoQueNoHace />

        <p className="pb-4 text-center text-xs text-text-secondary">
          Página de desarrollo: no se incluye en git y no existe en los builds de producción.
        </p>
      </div>
    </div>
  );
}
