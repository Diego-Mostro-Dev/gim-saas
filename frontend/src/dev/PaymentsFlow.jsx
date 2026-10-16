import { useState } from "react";
import {
  ArrowRight,
  ArrowDown,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Coins,
  FileWarning,
  Gift,
  Info,
  ShieldAlert,
  Wallet,
  XCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";

const ESTADOS = {
  paid: {
    key: "paid",
    nombre: "Al día",
    color: "success",
    icono: CheckCircle2,
    resumen: "El socio cerró el mes sin saldo pendiente.",
    detalle:
      "Puede entrenar, inscribirse, cambiar horarios, recuperar sesiones, cambiar de plan y ver sus datos. Su acceso está completamente habilitado.",
    acciones: [
      "Check-in en el gimnasio",
      "Inscribirse a actividades, salidas y entrenamiento personal",
      "Solicitar cambios e intercambios de horario",
      "Recuperar sesiones perdidas",
      "Cambiarse de plan y gestionar su renovación",
      "Ver y editar sus datos personales",
    ],
    comoSale:
      "Es el estado de reposo: mientras pague, el mes transcurre sin cortes.",
  },
  initial_pending: {
    key: "initial_pending",
    nombre: "Pago inicial pendiente",
    color: "warning",
    icono: Sparkles,
    resumen: "Socio nuevo que todavía no pagó ni una sola vez.",
    detalle:
      "Bloqueado desde el día 1, sin importar en qué día del mes se inscribió. Es la única excepción a los días de gracia.",
    accionesBloqueadas: [
      "Check-in en el gimnasio",
      "Inscribirse a actividades, salidas y entrenamiento personal",
      "Solicitar cambios e intercambios de horario",
      "Recuperar sesiones perdidas",
      "Cambiarse de plan y gestionar su renovación",
      "Ver y editar sus datos personales",
    ],
    accionesPermitidas: [
      "Subir su comprobante de pago",
      "Ver su rutina y su estado",
      "Ver la comunidad del gimnasio",
    ],
    comoSale:
      "El staff registra su primer pago (de la suscripción inicial) y el acceso se habilita solo.",
    exception: true,
  },
  pending: {
    key: "pending",
    nombre: "Pendiente de pago",
    color: "muted",
    icono: Wallet,
    resumen: "Socio con deuda en la primera etapa del mes.",
    detalle:
      "Desde el día 1 hasta el día {due} el socio tiene tiempo de pagar. El acceso sigue totalmente habilitado.",
    acciones: [
      "Check-in en el gimnasio",
      "Inscribirse a actividades, salidas y entrenamiento personal",
      "Solicitar cambios e intercambios de horario",
      "Recuperar sesiones perdidas",
      "Cambiarse de plan y gestionar su renovación",
      "Ver y editar sus datos personales",
    ],
    accionesBloqueadas: [],
    comoSale: "Paga su suscripción antes del día {due}.",
  },
  overdue: {
    key: "overdue",
    nombre: "Pago vencido",
    color: "warning",
    icono: FileWarning,
    resumen: "Debe, pero todavía tiene ventana de cortesía.",
    detalle:
      "Entre el día {due} y el día {block} el socio sigue pudiendo entrenar, aunque figura como vencido. Es una etapa informativa: no hay recargos ni intereses.",
    acciones: [
      "Check-in en el gimnasio",
      "Inscribirse a actividades, salidas y entrenamiento personal",
      "Solicitar cambios e intercambios de horario",
      "Recuperar sesiones perdidas",
      "Cambiarse de plan y gestionar su renovación",
      "Ver y editar sus datos personales",
    ],
    accionesBloqueadas: [],
    comoSale: "Paga antes del día {block}. No se pierde acceso en esta etapa.",
  },
  blocked: {
    key: "blocked",
    nombre: "Acceso suspendido",
    color: "danger",
    icono: ShieldAlert,
    resumen: "Acceso cortado por falta de pago desde el día {block}.",
    detalle:
      "Desde el día {block} en adelante el socio pierde el acceso hasta que el staff registre su pago. El gimnasio ve el conteo en el panel principal.",
    accionesBloqueadas: [
      "Check-in en el gimnasio",
      "Inscribirse a actividades, salidas y entrenamiento personal",
      "Solicitar cambios e intercambios de horario",
      "Recuperar sesiones perdidas",
      "Cambiarse de plan y gestionar su renovación",
      "Ver y editar sus datos personales",
      "Guardar su rutina de entrenamiento",
    ],
    accionesPermitidas: [
      "Subir su comprobante de pago",
      "Ver su rutina y su estado",
      "Ver la comunidad del gimnasio",
    ],
    comoSale:
      "El staff registra el pago de la suscripción y el acceso se restablece de inmediato, sin trámite.",
  },
};

const CONCEPTOS = [
  {
    nombre: "Suscripción (cuota mensual)",
    icono: CreditCard,
    color: "info",
    detalle:
      "El plan del socio (con sus actividades, PT y salidas incluidas). Cada mes se emite un ciclo: nace pendiente y se cierra con el pago.",
    nota: "Cada mes arranca impago hasta que el gimnasio lo cobre.",
  },
  {
    nombre: "Sellado / matrícula",
    icono: Coins,
    color: "success",
    detalle:
      "Monto único al inscribirse en un paquete. Se cobra exacto y una sola vez por paquete.",
    nota: "Al agregar sesiones a un paquete, el sellado vuelve a quedar pendiente.",
  },
  {
    nombre: "Coseguro por sesión",
    icono: Sparkles,
    color: "warning",
    detalle:
      "Valor por sesión de actividades según la obra social configurada del socio (no lo define el gimnasio). Los socios de cortesía pagan $0.",
    nota: "El precio lo trae la obra social del socio.",
  },
  {
    nombre: "Sesiones (actividades / PT / salidas)",
    icono: CalendarDays,
    color: "info",
    detalle:
      "Paquetes de sesiones con su propio saldo. Se suman a la cuenta del socio.",
    nota: "Un paquete no se renueva si el socio tiene sesiones sin cobrar.",
  },
  {
    nombre: "Saldo a favor",
    icono: Gift,
    color: "success",
    detalle:
      "Nace automáticamente cuando el total de un mes baja después de pagar (cortesía, descuento o cambio de plan). Se consume solo contra el próximo ciclo.",
    nota: "No se reembolsa en efectivo.",
  },
];

const METODOS = ["Efectivo", "Transferencia", "Tarjeta"];

const REGLAS_COBRO = [
  "Un pago apunta a UNA sola cosa (suscripción, paquete, sellado). No existe “pagar todo junto”.",
  "No se puede cobrar de más que el saldo pendiente: el sistema lo rechaza.",
  "Si en las últimas 24 h ya se registró un pago en efectivo para la misma suscripción, pide confirmación (aviso de duplicado).",
  "El staff puede editar o borrar un pago (con doble confirmación). Al borrar, los saldos se recalculan solos.",
  "Se puede exportar el detalle mensual en CSV (fecha, socio, concepto, detalle, monto, método, notas).",
];

const NO_HACE = [
  "No recalcula el monto al cobrar: registra el saldo que la suscripción ya trae, prorrateo del primer ciclo incluido.",
  "No hay cobro online ni pasarela: el socio no puede pagarse solo.",
  "No manda recordatorios ni emails de vencimiento.",
  "No cobra intereses ni recargos por atraso.",
  "No emite factura ni recibo (solo el CSV mensual).",
  "No reembolsa dinero: el saldo a favor se usa contra futuros ciclos.",
  "No permite pagar varios meses juntos ni un “pagar todo”.",
  "No registra qué usuario del staff cobró.",
  "No tiene cierre de caja.",
];

const CICLO = [
  {
    titulo: "Inscripción",
    icono: CreditCard,
    descripcion:
      "El mes va del día del alta al último día del mes. Alta el día {due} o antes: mes completo. Alta posterior: sólo los días que quedan.",
  },
  {
    titulo: "Mes calendario",
    icono: CalendarDays,
    descripcion:
      "El precio y el descuento quedan congelados. Si el gimnasio cambia precios, el mes ya emitido no se toca.",
  },
  {
    titulo: "Vencimiento y bloqueo",
    icono: ShieldAlert,
    descripcion:
      "Hasta el día {due} puede pagar (al día); hasta el día {block} sigue entrenando; desde {block} pierde el acceso.",
  },
  {
    titulo: "Renovación automática",
    icono: RotateCcw,
    descripcion:
      "El día 1 del mes siguiente se crea el nuevo ciclo con el mismo plan y actividades, pendiente de pago.",
  },
  {
    titulo: "Recuperación",
    icono: RotateCcw,
    descripcion:
      "Si un socio quedó bloqueado, se puede recuperar solo con deuda en cero. Se le abre un ciclo nuevo hasta fin de mes.",
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

const money = (n) =>
  `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Simulador() {
  const [dia, setDia] = useState(5);
  const [due, setDue] = useState(10);
  const [block, setBlock] = useState(16);
  const [pagado, setPagado] = useState(false);
  const [primeraVez, setPrimeraVez] = useState(false);
  const [cortesia, setCortesia] = useState(false);

  const [diaAlta, setDiaAlta] = useState(11);
  const [precioPlan, setPrecioPlan] = useState(5000);
  const [diasMes, setDiasMes] = useState(31);

  const bloqueoValido = block > due;

  const altaValida = diaAlta >= 1 && diaAlta <= diasMes;
  const diasCobrados = diasMes - diaAlta + 1;
  const prorratea = altaValida && !cortesia && diaAlta > due;
  const primerCiclo = !altaValida
    ? 0
    : cortesia
      ? 0
      : prorratea
        ? Math.round((precioPlan * diasCobrados * 100) / diasMes) / 100
        : precioPlan;
  const renovacion = cortesia ? 0 : precioPlan;

  let estado = "paid";
  if (!cortesia) {
    if (pagado) {
      estado = "paid";
    } else if (primeraVez) {
      estado = "initial_pending";
    } else if (dia <= due) {
      estado = "pending";
    } else if (dia <= block) {
      estado = "overdue";
    } else {
      estado = "blocked";
    }
  }

  const s = ESTADOS[estado];
  const EstadoIcon = s.icono;
  const colorClasses = {
    success: "bg-success-bg text-success-text dark:bg-success/15 dark:text-success",
    warning: "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning",
    danger: "bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger",
    muted: "bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted",
  }[s.color];

  const AccionItem = ({ ok = true, children }) => (
    <li className="flex items-start gap-2 text-sm text-text-secondary">
      {ok ? (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
      ) : (
        <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
      )}
      <span>{children}</span>
    </li>
  );

  return (
    <Card className="col-span-full">
      <div className="flex items-center gap-2">
        <CalendarDays size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Simulador de estado</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Mové el día del mes y probá distintas situaciones para ver cómo queda el socio hoy.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text-primary">Día del mes (hoy)</span>
              <span className="font-semibold text-info-text dark:text-info">Día {dia}</span>
            </div>
            <input
              type="range"
              min="1"
              max="31"
              value={dia}
              onChange={(e) => setDia(Number(e.target.value))}
              className="mt-2 w-full accent-blue-500"
            />
            <div className="mt-1 flex justify-between text-xs text-text-secondary">
              <span>1</span>
              <span className={dia <= due ? "font-semibold text-success-text" : ""}>
                pago {due}
              </span>
              <span className={dia > due && dia <= block ? "font-semibold text-warning-text" : ""}>
                corte {block}
              </span>
              <span>31</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-text-primary">Día límite de pago</span>
                <span className="font-semibold text-success-text">{due}</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                value={due}
                onChange={(e) => setDue(Number(e.target.value))}
                className="mt-2 w-full accent-green-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-text-primary">Día de bloqueo</span>
                <span className={`font-semibold ${bloqueoValido ? "text-danger-text" : "text-danger"}`}>
                  {block}
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="31"
                value={block}
                onChange={(e) => setBlock(Number(e.target.value))}
                className="mt-2 w-full accent-red-500"
              />
            </div>
          </div>
          {!bloqueoValido && (
            <p className="text-xs text-danger-text dark:text-danger">
              El día de bloqueo debe ser mayor que el día de pago.
            </p>
          )}

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-text-primary">
              <input
                type="checkbox"
                checked={pagado}
                onChange={(e) => setPagado(e.target.checked)}
                className="h-4 w-4 accent-green-500"
              />
              Pagó su suscripción
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-text-primary">
              <input
                type="checkbox"
                checked={primeraVez}
                onChange={(e) => setPrimeraVez(e.target.checked)}
                className="h-4 w-4 accent-amber-500"
              />
              Primera suscripción (socio nuevo)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-text-primary">
              <input
                type="checkbox"
                checked={cortesia}
                onChange={(e) => setCortesia(e.target.checked)}
                className="h-4 w-4 accent-purple-500"
              />
              Pase de cortesía
            </label>
          </div>
        </div>

        <div className={`rounded-xl border p-4 ${colorClasses.replace("bg-", "border-").replace("text-", "") || "border-border"}`}>
          <div className="flex items-center gap-2">
            <EstadoIcon size={20} className={colorClasses} />
            <span className="font-bold text-text-primary">{s.nombre}</span>
          </div>
          <p className="mt-2 text-sm text-text-secondary">{s.detalle}</p>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              El socio puede
            </p>
            <ul className="space-y-1.5">
              {(s.acciones || []).map((a) => (
                <AccionItem key={a}>{a}</AccionItem>
              ))}
              {(s.accionesPermitidas || []).map((a) => (
                <AccionItem key={a}>{a}</AccionItem>
              ))}
            </ul>
          </div>

          {s.accionesBloqueadas?.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger-text dark:text-danger">
                El socio NO puede
              </p>
              <ul className="space-y-1.5">
                {s.accionesBloqueadas.map((a) => (
                  <AccionItem key={a} ok={false}>
                    {a}
                  </AccionItem>
                ))}
              </ul>
            </div>
          )}

          <Pill className={`mt-4 ${s.exception ? "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning" : "bg-info-bg text-info-text dark:bg-info/15 dark:text-info"}`}>
            <Info size={13} />
            {s.comoSale}
          </Pill>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <Coins size={16} className="text-info-text dark:text-info" />
          <p className="text-sm font-bold text-text-primary">
            El primer ciclo: qué ve el socio y qué se le cobra
          </p>
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          Mové el día de alta. Si cae después del día de vencimiento se cobra sólo lo que queda del
          mes; el día {due} inclusive paga el mes completo.
        </p>

        {!altaValida ? (
          <p className="mt-3 text-xs text-danger-text dark:text-danger">
            Un mes de {diasMes} días no llega hasta el día {diaAlta}.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-text-primary">Día de alta</span>
                  <span className="font-semibold text-info-text dark:text-info">Día {diaAlta}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="31"
                  value={diaAlta}
                  onChange={(e) => setDiaAlta(Number(e.target.value))}
                  className="mt-2 w-full accent-blue-500"
                />
                <div className="mt-1 flex justify-between text-xs text-text-secondary">
                  <span>1</span>
                  <span
                    className={diaAlta > due ? "font-semibold text-warning-text" : "font-semibold text-success-text"}
                  >
                    vence {due}
                  </span>
                  <span>{diasMes}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  <span className="font-medium text-text-primary">Precio del plan</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={precioPlan}
                    onChange={(e) => setPrecioPlan(Math.max(0, Number(e.target.value)))}
                    className="mt-1 w-full rounded-lg border border-border bg-surface-input px-2 py-1.5 text-sm text-text-primary focus:border-info focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-text-primary">Días del mes</span>
                  <select
                    value={diasMes}
                    onChange={(e) => setDiasMes(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border bg-surface-input px-2 py-1.5 text-sm text-text-primary focus:border-info focus:outline-none"
                  >
                    {[28, 29, 30, 31].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={cortesia}
                  onChange={(e) => setCortesia(e.target.checked)}
                  className="h-4 w-4 accent-purple-500"
                />
                Pase de cortesía
              </label>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-surface-elevated p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Qué ve en su portal
                </p>
                <div className="mt-2 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-secondary">Precio del plan</span>
                    <span className="text-text-primary">{money(primerCiclo)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-secondary">Período</span>
                    <span className="text-text-primary">
                      día {diaAlta} → día {diasMes} · {diasCobrados} días
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-border pt-1.5">
                    <span className="font-semibold text-text-secondary">Total mensual</span>
                    <span className="font-bold text-info-text dark:text-info">{money(primerCiclo)}</span>
                  </div>
                </div>
                <Pill
                  className={`mt-2 ${
                    cortesia
                      ? "bg-success-bg text-success-text dark:bg-success/15 dark:text-success"
                      : prorratea
                        ? "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning"
                        : "bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted"
                  }`}
                >
                  {cortesia
                    ? "Cortesía: nace pagado"
                    : prorratea
                      ? `Prorrateo ${diasCobrados}/${diasMes} días`
                      : "Mes completo"}
                </Pill>
              </div>

              <div className="rounded-lg border border-border bg-surface-elevated p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Qué se le cobra
                </p>
                <div className="mt-2 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-secondary">Primer ciclo</span>
                    <span className="font-semibold text-text-primary">{money(primerCiclo)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-secondary">Renovación (1° del mes siguiente)</span>
                    <span className="text-text-primary">{money(renovacion)}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  {cortesia
                    ? "Pase de cortesía: el ciclo nace con el plan base en $0 y ya pagado."
                    : prorratea
                      ? `Alta posterior al vencimiento: se sirven ${diasCobrados} de ${diasMes} días, así se prorratea.`
                      : `Alta hasta el día ${due}: se cobra el mes completo.`}
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="mt-3 rounded-lg bg-info-bg px-3 py-2 text-xs text-info-text dark:bg-info/15 dark:text-info">
          El staff no calcula nada al cobrar: el formulario registra ese saldo tal cual (PaymentForm →
          /subscriptions/member/&lt;id&gt;/outstanding). Actividades, PT mensual y salidas mensuales
          se prorratean igual; renovaciones, cambios de plan y recuperaciones nunca se prorratean.
        </p>
      </div>
    </Card>
  );
}

function SequenciaDias({ due, block }) {
  const segmentos = [
    { desde: 1, hasta: due, estado: "pending", label: "Puede pagar (al día)" },
    { desde: due + 1, hasta: block, estado: "overdue", label: "Vencido · sigue entrenando" },
    { desde: block, hasta: 31, estado: "blocked", label: "Acceso suspendido" },
  ];
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {segmentos.map((seg) => {
        const color = {
          pending: "bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted",
          overdue: "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning",
          blocked: "bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger",
        }[seg.estado];
        return (
          <div key={seg.label} className="flex flex-1 items-center gap-2">
            <div className={`flex-1 rounded-xl border border-border px-3 py-2 text-center text-sm font-medium ${color}`}>
              {seg.desde === seg.hasta ? `Día ${seg.desde}` : `Días ${seg.desde}–${seg.hasta}`}
              <span className="mt-0.5 block text-xs opacity-80">{seg.label}</span>
            </div>
            {seg !== segmentos[segmentos.length - 1] && (
              <ArrowRight size={18} className="shrink-0 text-text-secondary" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DiagramaCiclo({ due, block }) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <RotateCcw size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">El ciclo de cobro</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El recorrido completo de un socio por los pagos, de la inscripción a la recuperación.
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
                  <p className="mt-1 text-xs text-text-secondary">
                    {step.descripcion.replaceAll("{due}", due).replaceAll("{block}", block)}
                  </p>
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

function EstadosDetalle({ due, block }) {
  const [abierto, setAbierto] = useState(ESTADOS.pending.key);
  return (
    <Card>
      <div className="flex items-center gap-2">
        <ShieldAlert size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Estados de pago</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Tocá cada estado para ver su detalle. Los días {due} y {block} son configurables desde Configuración del gimnasio.
      </p>
      <SequenciaDias due={due} block={block} />
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
            <div key={s.key} className="rounded-xl border border-border overflow-hidden">
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
                <ArrowDown size={16} className={`shrink-0 text-text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-border px-4 py-3">
                  <p className="text-sm text-text-secondary">
                    {s.detalle.replace("{due}", due).replace("{block}", block)}
                  </p>
                  {s.acciones?.length > 0 && (
                    <>
                      <p className="mt-3 mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        Puede
                      </p>
                      <ul className="space-y-1">
                        {s.acciones.map((a) => (
                          <li key={a} className="flex items-start gap-2 text-sm text-text-secondary">
                            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {s.accionesBloqueadas?.length > 0 && (
                    <>
                      <p className="mt-3 mb-1.5 text-xs font-semibold uppercase tracking-wide text-danger-text dark:text-danger">
                        No puede
                      </p>
                      <ul className="space-y-1">
                        {s.accionesBloqueadas.map((a) => (
                          <li key={a} className="flex items-start gap-2 text-sm text-text-secondary">
                            <XCircle size={15} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {s.accionesPermitidas?.length > 0 && (
                    <>
                      <p className="mt-3 mb-1.5 text-xs font-semibold uppercase tracking-wide text-success-text">
                        Siempre puede
                      </p>
                      <ul className="space-y-1">
                        {s.accionesPermitidas.map((a) => (
                          <li key={a} className="flex items-start gap-2 text-sm text-text-secondary">
                            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                            {a}
                          </li>
                        ))}
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

function ComoSeCobra() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Coins size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Cómo se cobra</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El staff registra los pagos desde la pantalla Pagos o Recuperar socios. El socio no se paga solo: solo puede subir su comprobante.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CONCEPTOS.map((c) => {
          const Icon = c.icono;
          const color = {
            info: "bg-info-bg text-info-text dark:bg-info/15 dark:text-info",
            success: "bg-success-bg text-success-text dark:bg-success/15 dark:text-success",
            warning: "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning",
          }[c.color];
          return (
            <div key={c.nombre} className="rounded-xl border border-border bg-surface px-3 py-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
                  <Icon size={16} />
                </span>
                <p className="text-sm font-semibold text-text-primary">{c.nombre}</p>
              </div>
              <p className="mt-2 text-xs text-text-secondary">{c.detalle}</p>
              <Pill className={`mt-2 ${c.color === "success" ? "bg-success-bg text-success-text dark:bg-success/15 dark:text-success" : "bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted"}`}>
                {c.nota}
              </Pill>
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Métodos de pago
        </p>
        <div className="flex flex-wrap gap-2">
          {METODOS.map((m) => (
            <Pill key={m} className="bg-info-bg text-info-text dark:bg-info/15 dark:text-info">
              {m}
            </Pill>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Reglas al registrar un pago
        </p>
        <ul className="space-y-1.5">
          {REGLAS_COBRO.map((r) => (
            <li key={r} className="flex items-start gap-2 text-sm text-text-secondary">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          La cuenta del socio
        </p>
        <p className="text-sm text-text-secondary">
          La deuda total suma el saldo de las suscripciones <strong className="text-text-primary">+</strong> paquetes de sesiones{" "}
          <strong className="text-text-primary">+</strong> sellados pendientes. El <strong className="text-text-primary">saldo a favor</strong> se
          descuenta solo del próximo ciclo, topeado por su total, y no se reembolsa en efectivo.
        </p>
      </div>

      <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text dark:bg-info/15 dark:text-info">
        Para recuperar a un socio es condición indispensable que su deuda esté en cero. Con deuda, el sistema no procede.
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
        <ArrowDown size={16} className={`shrink-0 text-text-secondary transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && (
        <ul className="mt-4 space-y-1.5">
          {NO_HACE.map((n) => (
            <li key={n} className="flex items-start gap-2 text-sm text-text-secondary">
              <XCircle size={15} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              {n}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function PaymentsFlow() {
  const due = 10;
  const block = 16;

  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-5">
          <div className="flex items-center gap-2">
            <Pill className="bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger">
              Solo desarrollo · no visible en producción
            </Pill>
            <Pill className="bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
              Fuente: AUDITORIA-PAGOS.md
            </Pill>
          </div>
          <h1 className="mt-3 text-3xl font-bold">Flujo de pagos</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Cómo funciona el sistema de cobros hoy, en forma visual e interactiva. Cada sección
            resume una regla verificada del sistema real: días de vencimiento y bloqueo, qué puede
            (o no) hacer un socio según su estado, qué se cobra, y qué no existe.
          </p>
        </div>

        <Simulador />

        <EstadosDetalle due={due} block={block} />

        <DiagramaCiclo due={due} block={block} />

        <ComoSeCobra />

        <LoQueNoHace />

        <p className="pb-4 text-center text-xs text-text-secondary">
          Página de desarrollo: no se incluye en git y no existe en los builds de producción.
        </p>
      </div>
    </div>
  );
}