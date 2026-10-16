import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  Ban,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  EyeOff,
  GitBranch,
  Package,
  Power,
  RefreshCw,
  Repeat,
  ShieldAlert,
  Wallet,
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

const DEUDAS = [
  {
    key: "subs",
    titulo: "Suscripciones",
    icono: Wallet,
    color: "info",
    detalle: "Lo que resta pagar de cada ciclo mensual.",
  },
  {
    key: "act",
    titulo: "Paquetes de actividades",
    icono: Package,
    color: "info",
    detalle: "Inscripciones por sesiones que no se terminaron de pagar.",
  },
  {
    key: "pt",
    titulo: "Paquetes de entrenamiento personal",
    icono: Coins,
    color: "info",
    detalle: "Igual, pero de PT.",
  },
  {
    key: "outings",
    titulo: "Paquetes de salidas",
    icono: CalendarDays,
    color: "warning",
    detalle: "Igual, pero de salidas/running.",
  },
  {
    key: "sellados",
    titulo: "Sellados (matrícula)",
    icono: ClipboardCheck,
    color: "warning",
    detalle: "Cargo único pendiente de inscripciones y asignaciones de PT.",
  },
];

const QUE_CREA = [
  {
    titulo: "Suscripción nueva",
    icono: Wallet,
    color: "success",
    detalle: "De hoy al último día del mes, origin=\"recovery\" y pendiente de pago.",
  },
  {
    titulo: "Ítems copiados",
    icono: Repeat,
    color: "info",
    detalle: "Actividades, entrenamiento personal y salidas que el socio tenía activos.",
  },
  {
    titulo: "Cambio de plan finalizado",
    icono: GitBranch,
    color: "info",
    detalle: "Si había uno aprobado y vencido, queda ligado a este ciclo y marcado como ejecutado.",
  },
  {
    titulo: "Socio activo",
    icono: Power,
    color: "success",
    detalle: "Vuelve a estar activo y en condiciones de entrenar.",
  },
];

const BUGS = [
  {
    key: "outings",
    color: "danger",
    titulo: "La deuda de salidas no la ve el badge, pero sí la validación",
    detalle:
      "El cálculo de deuda total incluye los paquetes de salidas, pero el indicador \"Recuperable\" sólo mira actividades y PT. Un socio con deuda de salidas aparece con su botón y al tocarlo el servidor responde 400 \"deuda pendiente\".",
    ref: "services.py:1100-1102 · serializers.py:280-324",
  },
  {
    key: "pcr",
    color: "danger",
    titulo: "El badge ignora un cambio de plan aprobado y vigente",
    detalle:
      "La acción real honra un cambio de plan aprobado y usa el plan pedido; el badge rechaza de plano si la ficha está en plan base. Un socio que el backend sí recuperaría queda oculto en la UI.",
    ref: "services.py:1434 / :1732 · serializers.py:407",
  },
  {
    key: "comp",
    color: "warning",
    titulo: "El badge rechaza a socios de cortesía, la acción no",
    detalle:
      "El indicador devuelve falso para un socio de cortesía, pero la recuperación no los excluye. Desajuste probablemente benigno, pero real.",
    ref: "serializers.py:277-278",
  },
  {
    key: "credit",
    color: "warning",
    titulo: "La recuperación no aplica el saldo a favor",
    detalle:
      "La renovación automática sí consume el crédito abierto; la recuperación no. Un socio con crédito y deuda $0 recupera con el ciclo nuevo 100% impago, aunque el crédito podría cubrirlo. Se aplica recién en la próxima renovación.",
    ref: "services.py:1354 vs :1441-1456",
  },
  {
    key: "status",
    color: "muted",
    titulo: "El endpoint responde siempre 201",
    detalle:
      "En el Caso A (reactivar) no se crea ninguna suscripción, pero igual devuelve 201 Created. El código de estado no distingue reactivar de crear.",
    ref: "views.py:174-177",
  },
  {
    key: "order",
    color: "warning",
    titulo: "El chequeo de deuda va antes que el de \"ciclo vigente\"",
    detalle:
      "Un socio inactivo con ciclo vigente y deuda residual no puede reactivarse por esta vía: recibe el error de deuda antes de llegar al caso en que no se cobra nada.",
    ref: "services.py:1417-1427",
  },
  {
    key: "copy",
    color: "muted",
    titulo: "El badge es una reimplementación manual y frágil",
    detalle:
      "Reproduce el total facturado, el descuento congelado y el crédito consumido en memoria, para no hacer queries de más. Cualquier cambio futuro en esos helpers puede desincronizarlo de nuevo.",
    ref: "serializers.py:258-410 · members/tests.py:103-162",
  },
  {
    key: "lock",
    color: "muted",
    titulo: "Sin bloqueo explícito en recover_member",
    detalle:
      "Lee las precondiciones sin lock. Un doble clic concurrente tiende a resolverse por el solapamiento que detecta la apertura de la suscripción, pero no es una garantía propia del flujo.",
    ref: "services.py:1408-1434 · domain.py:49+",
  },
  {
    key: "proration",
    color: "warning",
    titulo: "La recuperación no prorratea",
    detalle:
      "Recuperar a mitad o fin de mes cobra el mes completo por los pocos días que restan. En el último día del mes, el ciclo dura un solo día.",
    ref: "services.py:1445-1446",
  },
];

const NO_HACE = [
  "No prorratea la recuperación: cobra el mes completo aunque se recupere sobre el final del mes.",
  "No aplica el saldo a favor en la recuperación: el crédito espera a la renovación siguiente.",
  "No avisa al socio por ningún canal: recuperar es una acción interna del staff.",
  "No revive la ficha: \"recuperar\" es del ciclo de cobro, no del socio.",
  "No recupera clases/sesiones perdidas: eso es recuperación de sesiones, otro flujo.",
  "No permite al socio recuperarse a sí mismo: sólo el staff.",
  "No genera intereses ni recargos por el tiempo inactivo.",
];

function QueEsRecuperar() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <RefreshCw size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Qué es "recuperar"</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Volver a poner al socio en curso de cobro. No es dar de alta la ficha ni devolver una clase.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <Ban size={18} className="text-danger-text dark:text-danger" />
          <p className="mt-2 text-sm font-semibold text-text-primary">No es dar de alta</p>
          <p className="mt-1 text-xs text-text-secondary">
            Eso se hace en Miembros. Acá no se crea ni se edita la ficha del socio.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <RefreshCw size={18} className="text-success-text dark:text-success" />
          <p className="mt-2 text-sm font-semibold text-text-primary">Sí es del ciclo de cobro</p>
          <p className="mt-1 text-xs text-text-secondary">
            Reactiva el ciclo mensual de la suscripción y su cobro.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <XCircle size={18} className="text-warning-text dark:text-warning" />
          <p className="mt-2 text-sm font-semibold text-text-primary">No es recuperar clases</p>
          <p className="mt-1 text-xs text-text-secondary">
            Eso es recuperación de sesiones (SessionRecovery), con su propio portal y endpoints.
          </p>
        </div>
      </div>
    </Card>
  );
}

function DosCasos() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <GitBranch size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Los dos casos del mismo botón</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Según el estado del socio, el botón "Recuperar socio" hace una cosa u otra.
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${COLOR_CLASSES.success}`}>
              <Power size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-text-primary">Caso A — Reactivar</p>
              <p className="text-xs text-text-secondary">Ya tiene ciclo vigente y no debe nada.</p>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              No crea ninguna suscripción.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Sólo marca al socio como activo otra vez.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Devuelve el ciclo que ya tenía.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${COLOR_CLASSES.info}`}>
              <Repeat size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-text-primary">Caso B — Recuperar</p>
              <p className="text-xs text-text-secondary">No tiene ningún ciclo que cubra hoy.</p>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Abre un ciclo nuevo de hoy al fin de mes.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Queda pendiente de pago hasta que se cobre.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Copia los servicios activos de la última suscripción.
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

const PRECONDICIONES = [
  "No debe nada (suscripciones, paquetes ni sellados).",
  "No tiene un ciclo vigente (si lo tuviera, es el Caso A).",
  "No tiene un ciclo futuro cargado.",
  "No está en el plan base (salvo cambio de plan aprobado).",
  "Tiene al menos una suscripción previa.",
];

function Precondiciones() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <ClipboardCheck size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Las condiciones que exige</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Tienen que cumplirse todas. Si alguna falla, el sistema avisa y no toca nada.
      </p>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {PRECONDICIONES.map((p) => (
          <li
            key={p}
            className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-xs text-text-secondary"
          >
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
            {p}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DeudaQueBloquea() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Wallet size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Qué cuenta como deuda</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Todo esto suma al "debe". El saldo a favor (crédito) NO es deuda.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DEUDAS.map((d) => {
          const Icon = d.icono;
          return (
            <div key={d.key} className="rounded-xl border border-border bg-surface px-3 py-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${COLOR_CLASSES[d.color]}`}>
                  <Icon size={16} />
                </span>
                <p className="text-sm font-semibold text-text-primary">{d.titulo}</p>
              </div>
              <p className="mt-2 text-xs text-text-secondary">{d.detalle}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <span>
          El sistema no usa la marca "pagado" del ciclo: manda el <span className="font-medium">saldo
          calculado</span>. Un ciclo marcado como pagado pero con saldo real cuenta como deuda.
        </span>
      </div>
    </Card>
  );
}

const TOGGLES = [
  { key: "prev", label: "Tiene al menos una suscripción previa", def: true },
  { key: "active", label: "El socio está activo (limbo)", def: true },
  { key: "debtSub", label: "Debe suscripción / paquete de actividades o PT", def: false },
  { key: "debtSellado", label: "Debe un sellado de actividad o PT", def: false },
  { key: "debtOuting", label: "Debe un paquete de salidas", def: false },
  { key: "current", label: "Tiene un ciclo vigente hoy", def: false },
  { key: "future", label: "Tiene un ciclo futuro cargado", def: false },
  { key: "base", label: "Está en el plan base", def: false },
  { key: "pcr", label: "Tiene un cambio de plan aprobado y vigente", def: false },
  { key: "comp", label: "Es socio de cortesía", def: false },
];

function backendVerdict(o) {
  if (!o.prev) {
    return { accept: false, title: "Rechaza: sin suscripción previa", reasons: ["El socio nunca tuvo una suscripción."] };
  }
  if (o.debtSub || o.debtSellado || o.debtOuting) {
    return { accept: false, title: "Rechaza: deuda pendiente", reasons: ["Tiene saldo sin pagar; primero hay que cobrarlo."] };
  }
  if (o.current) {
    return {
      accept: true,
      title: "Acepta: Caso A — reactiva",
      reasons: ["Ya tiene ciclo vigente: sólo marca al socio activo. No crea nada."],
    };
  }
  if (o.future) {
    return { accept: false, title: "Rechaza: ciclo futuro", reasons: ["Ya tiene un ciclo cargado que arranca más adelante."] };
  }
  if (o.base && !o.pcr) {
    return { accept: false, title: "Rechaza: plan base", reasons: ["Recuperar con plan base no tiene sentido de cobro."] };
  }
  if (o.pcr) {
    return {
      accept: true,
      title: "Acepta: Caso B — recupera",
      reasons: ["Abre un ciclo nuevo hoy → fin de mes y finaliza el cambio de plan aprobado."],
    };
  }
  return {
    accept: true,
    title: "Acepta: Caso B — recupera",
    reasons: ["Abre un ciclo nuevo hoy → fin de mes, pendiente de pago."],
  };
}

function badgeVerdict(o) {
  if (o.comp) {
    return { accept: false, title: "No recuperable: cortesía", reasons: ["El indicador excluye a los socios de cortesía."] };
  }
  if (o.debtSub || o.debtSellado) {
    return { accept: false, title: "No recuperable: deuda", reasons: ["Ve deuda en suscripciones y paquetes de actividades/PT."] };
  }
  if (!o.prev) {
    return { accept: false, title: "No recuperable: sin previa", reasons: ["No tiene suscripción previa."] };
  }
  if (o.future) {
    return { accept: false, title: "No recuperable: ciclo futuro", reasons: ["Ve un ciclo que arranca más adelante."] };
  }
  if (o.active && o.current) {
    return { accept: false, title: "No recuperable: está al día", reasons: ["Activo y con ciclo vigente: no necesita recuperación."] };
  }
  if (!o.current && o.base && !o.pcr) {
    return { accept: false, title: "No recuperable: plan base", reasons: ["La ficha está en plan base; ignora el cambio aprobado."] };
  }
  return { accept: true, title: "Recuperable", reasons: ["El badge muestra el botón \"Recuperar socio\"."] };
}

function VerdictCard({ icono: Icon, titulo, verdict, tone }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        verdict.accept ? "border-success/30 bg-success-bg dark:bg-success/10" : "border-danger/30 bg-danger-bg dark:bg-danger/10"
      }`}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <Icon size={16} className={tone} />
        {titulo}
      </p>
      <p className={`mt-2 text-sm font-medium ${verdict.accept ? "text-success-text dark:text-success" : "text-danger-text dark:text-danger"}`}>
        {verdict.title}
      </p>
      <ul className="mt-2 space-y-1">
        {verdict.reasons.map((r) => (
          <li key={r} className="flex items-start gap-2 text-xs text-text-secondary">
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-text-secondary" />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SimuladorRecuperar() {
  const [opts, setOpts] = useState(() =>
    Object.fromEntries(TOGGLES.map((t) => [t.key, t.def])),
  );

  const backend = backendVerdict(opts);
  const badge = badgeVerdict(opts);
  const mismatch = backend.accept !== badge.accept;

  return (
    <Card className="col-span-full">
      <div className="flex items-center gap-2">
        <GitBranch size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Simulador: ¿qué decide cada lado?</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Activá cada situación y compará la acción real contra el badge de la lista.
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
        </div>

        <div className="space-y-3">
          <VerdictCard
            icono={RefreshCw}
            titulo="Acción real (recover_member)"
            verdict={backend}
            tone="text-info-text dark:text-info"
          />
          <VerdictCard
            icono={EyeOff}
            titulo="Badge de la lista (is_recoverable)"
            verdict={badge}
            tone="text-info-text dark:text-info"
          />

          {mismatch ? (
            <div className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-text dark:bg-warning/15 dark:text-warning">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-medium">Desajuste:</span> el badge y la acción no coinciden.
                Un socio con deuda de salidas aparece como recuperable y falla al tocarlo; un socio
                en plan base con cambio aprobado queda oculto aunque el backend sí lo recupere.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg bg-success-bg px-3 py-2 text-sm text-success-text dark:bg-success/15 dark:text-success">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              En esta combinación, el badge y la acción coinciden.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function QueCreaRecuperar() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <GitBranch size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Qué crea la recuperación (Caso B)</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Todo junto en una sola operación indivisible (atómica). Si algo falla, no queda nada a medias.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {QUE_CREA.map((q) => {
          const Icon = q.icono;
          return (
            <div key={q.titulo} className="flex flex-col rounded-xl border border-border bg-surface p-4">
              <span className={`inline-flex size-9 items-center justify-center rounded-lg ${COLOR_CLASSES[q.color]}`}>
                <Icon size={18} />
              </span>
              <p className="mt-2 text-sm font-semibold text-text-primary">{q.titulo}</p>
              <p className="mt-1 text-xs text-text-secondary">{q.detalle}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-text dark:bg-warning/15 dark:text-warning">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>
          La recuperación <span className="font-medium">no prorratea</span>: recuperar el día 25 cobra
          el mes completo por los días que restan. El último día del mes, el ciclo dura uno solo.
        </span>
      </div>
    </Card>
  );
}

function BadgeRecuperable() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <EyeOff size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">El badge "Recuperable"</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        La lista no consulta al servidor por cada fila: cada socio trae el indicador ya calculado.
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">Dónde se usa</p>
          <p className="mt-1 text-xs text-text-secondary">
            Badge en la lista, filtro "Recuperables (N)" y botón "Recuperar socio".
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">Cómo se calcula</p>
          <p className="mt-1 text-xs text-text-secondary">
            Replica las condiciones en modo lectura, sin abrir nada ni marcar a nadie.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">El riesgo</p>
          <p className="mt-1 text-xs text-text-secondary">
            Al ser una copia manual, puede desincronizarse del servicio real. Ya pasó con el crédito.
          </p>
        </div>
      </div>
    </Card>
  );
}

function BugsConocidos() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-warning-text dark:text-warning" />
        <h2 className="text-lg font-bold text-text-primary">Posibles bugs / desajustes</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Puntos donde el badge, la validación y la acción real no siempre coinciden. Para documentar,
        no necesariamente para arreglar.
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

export default function RecoveryFlow() {
  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill className="bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger">
              Solo desarrollo · no visible en producción
            </Pill>
            <Pill className="bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
              Fuente: AUDITORIA-RECUPERACION.md
            </Pill>
          </div>
          <h1 className="mt-3 text-3xl font-bold">Flujo de recuperación de socios</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Cómo funciona hoy "Recuperar socios", en forma visual e interactiva: qué es recuperar,
            los dos casos, las condiciones, qué cuenta como deuda, qué crea, el badge de la lista y
            los desajustes conocidos.
          </p>
        </div>

        <QueEsRecuperar />

        <DosCasos />

        <Precondiciones />

        <DeudaQueBloquea />

        <SimuladorRecuperar />

        <QueCreaRecuperar />

        <BadgeRecuperable />

        <BugsConocidos />

        <LoQueNoHace />

        <p className="pb-4 text-center text-xs text-text-secondary">
          Página de desarrollo: no se incluye en producción y no existe en los builds finales.
        </p>
      </div>
    </div>
  );
}
