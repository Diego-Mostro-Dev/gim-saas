import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  Ban,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gift,
  GitBranch,
  IdCard,
  KeyRound,
  Link2,
  Mail,
  Package,
  Pencil,
  Percent,
  Phone,
  Power,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  Trash2,
  UserPlus,
  Wallet,
  XCircle,
} from "lucide-react";

const CAMPOS = [
  {
    key: "nombre",
    campo: "Nombre y apellido",
    icono: IdCard,
    color: "info",
    resumen: "Obligatorios.",
    detalle: "Son los datos base de la ficha. El nombre se usa en listados, pagos y comprobantes.",
  },
  {
    key: "telefono",
    campo: "Teléfono",
    icono: Phone,
    color: "warning",
    resumen: "Obligatorio y ÚNICO por gimnasio.",
    detalle:
      "No puede haber dos socios con el mismo teléfono en el mismo gimnasio. Se valida al alta, al editar y desde el portal.",
  },
  {
    key: "email",
    campo: "Email",
    icono: Mail,
    color: "muted",
    resumen: "Opcional, NO único.",
    detalle: "Puede repetirse entre socios. No hay login por email para el socio.",
  },
  {
    key: "documento",
    campo: "Nº de documento",
    icono: FileText,
    color: "muted",
    resumen: "Opcional, NO único.",
    detalle: "Se guarda como texto libre, sin validación contra padrón ni formato.",
  },
  {
    key: "obra_social",
    campo: "Obra social",
    icono: Stethoscope,
    color: "info",
    resumen: "Texto libre + enlace automático.",
    detalle:
      "Si el nombre coincide con una obra social configurada del gimnasio, se enlaza sola y toma su precio por sesión del coseguro.",
  },
  {
    key: "afiliado",
    campo: "Nº de afiliado",
    icono: IdCard,
    color: "muted",
    resumen: "Manual.",
    detalle: "El sistema no lo genera ni lo completa solo. No existe un código de socio automático.",
  },
  {
    key: "descuento",
    campo: "Descuento",
    icono: Percent,
    color: "success",
    resumen: "Opcional (FK).",
    detalle: "Descuento porcentual configurado por el gimnasio; se aplica sobre el total mensual.",
  },
  {
    key: "cortesia",
    campo: "Pase de cortesía",
    icono: Gift,
    color: "warning",
    resumen: "Socio de cortesía.",
    detalle:
      "No se le cobra membresía ni actividades y nunca se lo bloquea por pago. Solo el staff puede otorgarlo.",
  },
  {
    key: "foto",
    campo: "Foto",
    icono: Camera,
    color: "muted",
    resumen: "Opcional (Cloudinary).",
    detalle: "Se sube por su propio endpoint. El socio puede cambiarla desde su portal.",
  },
  {
    key: "activo",
    campo: "Activo",
    icono: Power,
    color: "muted",
    resumen: "Read-only en la API.",
    detalle:
      "El alta siempre arranca activo y el formulario de la ficha no lo cambia. No hay baja lógica: ver Eliminar.",
  },
];

const CAMINOS = [
  {
    key: "staff",
    titulo: "Alta por el staff",
    icono: ClipboardCheck,
    color: "success",
    quien: "El personal del gimnasio, desde Miembros.",
    puntos: [
      "Elige servicios (gimnasio y/o actividades), plan y horarios.",
      "Puede otorgar cortesía y descuento.",
      "Es el camino completo: los servicios se crean en una sola operación.",
    ],
  },
  {
    key: "publico",
    titulo: "Auto-registro público",
    icono: Link2,
    color: "info",
    quien: "La persona, con el link público del gimnasio.",
    puntos: [
      "Usa el mismo servicio de alta y las mismas reglas del staff.",
      "NO puede auto-darse cortesía ni descuento: se fuerzan a vacío.",
      "El staff los aplica después, si corresponde.",
    ],
  },
];

const CAMPOS_PORTAL = {
  editables: [
    "Nombre y apellido",
    "Teléfono",
    "WhatsApp",
    "Email",
    "Dirección",
    "Fecha de nacimiento",
    "Nº de documento",
  ],
  soloLectura: [
    "Modo de ingreso (entry_mode)",
    "Activo",
    "Foto (por la vía de datos)",
    "Cortesía y descuento",
  ],
};

const ADJUNTOS = [
  {
    key: "medical_order",
    titulo: "Orden médica / sesiones",
    color: "info",
  },
  { key: "payment_proof", titulo: "Comprobante de pago", color: "success" },
  { key: "electro", titulo: "Electrocardiograma / estudios", color: "warning" },
  { key: "other", titulo: "Otro", color: "muted" },
];

const NO_HACE = [
  "No tiene “dar de baja” ni “reactivar socio”: solo borrado real y, aparte, recuperación de la suscripción (cobros).",
  "No genera un código/número de socio: el nº de afiliado se carga a mano.",
  "No impide repetir email ni documento: solo el teléfono es único por gimnasio.",
  "No deja al socio auto-darse cortesía ni descuento desde el link público.",
  "No crea entrenamiento personal ni salidas en el alta.",
  "No envía el link mágico por email ni WhatsApp: lo comparte el gimnasio a mano.",
  "No tiene login con usuario/contraseña para el socio: solo el enlace con token.",
  "No permite al socio editar su modo de ingreso, su estado activo ni su foto por la vía de datos.",
  "No bloquea la subida de adjuntos por falta de pago (a propósito).",
  "No avisa al socio cuando el staff marca un adjunto como revisado.",
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

function AnatomiaSocio() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <IdCard size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Anatomía de la ficha del socio</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Qué es cada campo y qué regla arrastra.
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
        El “modo de ingreso” (<span className="font-medium">GYM</span> o{" "}
        <span className="font-medium">ACTIVITY_ONLY</span>) no es un dato más: define si el socio
        necesita plan y horarios de gimnasio o si solo paga actividades.
      </p>
    </Card>
  );
}

function DosCaminosDeAlta() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <UserPlus size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Los dos caminos de alta</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        El staff y el link público usan el mismo motor, pero no los mismos permisos.
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {CAMINOS.map((c) => {
          const Icon = c.icono;
          return (
            <div key={c.key} className="flex flex-col rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${COLOR_CLASSES[c.color]}`}>
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{c.titulo}</p>
                  <p className="text-xs text-text-secondary">{c.quien}</p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {c.puntos.map((p) => (
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

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-text dark:bg-warning/15 dark:text-warning">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <span>
          En el link público, la cortesía se fuerza a <span className="font-medium">False</span> y el
          descuento se descarta en silencio: el socio no puede regalarse una membresía.
        </span>
      </div>
    </Card>
  );
}

const QUE_CREA = [
  {
    titulo: "La ficha",
    icono: IdCard,
    color: "info",
    detalle: "El socio, siempre.",
  },
  {
    titulo: "Suscripción + plan",
    icono: Wallet,
    color: "success",
    detalle: "El plan elegido, o el plan base si es cortesía / solo actividades.",
  },
  {
    titulo: "Actividades",
    icono: Package,
    color: "info",
    detalle: "Inscripciones a los horarios elegidos (sin re-chequear el pago).",
  },
  {
    titulo: "Horarios de gimnasio",
    icono: CalendarDays,
    color: "info",
    detalle: "Los de sala que se hayan seleccionado.",
  },
];

function QueCreaElAlta() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <GitBranch size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Qué crea el alta</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Todo junto, en una sola operación indivisible (atómica). Si algo falla, no queda nada a medias.
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">Cortesía: </span>
          abre el plan base, pagado y con renovación automática, todo en $0.
        </div>
        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">Solo actividades: </span>
          sin gimnasio, abre el plan base (sin cargo) y crea las inscripciones.
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-text dark:bg-danger/15 dark:text-danger">
        <Ban size={16} className="mt-0.5 shrink-0" />
        <span>
          El alta <span className="font-medium">NO</span> crea entrenamiento personal ni salidas. Esos
          servicios se suman por sus propios flujos.
        </span>
      </div>
    </Card>
  );
}

function SimuladorAlta() {
  const [opts, setOpts] = useState({
    has_gym: true,
    has_activities: false,
    is_comp: false,
    plan_selected: false,
    gym_schedule: true,
  });

  const entry_mode = opts.has_gym ? "GYM" : "ACTIVITY_ONLY";

  const blockReasons = [];
  if (opts.has_gym && !opts.plan_selected && !opts.is_comp) {
    blockReasons.push("Debés seleccionar un plan de membresía para los horarios de gym.");
  }
  if (opts.has_gym && !opts.gym_schedule) {
    blockReasons.push("Debés seleccionar al menos un horario de gimnasio.");
  }

  const crea = [];
  crea.push("La ficha del socio");
  if (opts.plan_selected && !opts.is_comp) {
    crea.push("Suscripción con el plan elegido (hoy → fin de mes)");
  }
  if (opts.is_comp) {
    crea.push("Suscripción con plan base, pagada y con renovación automática ($0)");
  }
  if (opts.has_activities && !opts.has_gym && !opts.is_comp) {
    crea.push("Suscripción con plan base (sin cargo)");
  }
  if (opts.has_activities) {
    crea.push("Inscripciones a las actividades elegidas");
  }
  if (opts.has_gym) {
    crea.push("Horarios de gimnasio de sala");
  }

  const toggles = [
    { key: "has_gym", label: "Eligió gimnasio (horarios de sala)" },
    { key: "has_activities", label: "Eligió actividades" },
    { key: "is_comp", label: "Es socio de cortesía" },
    { key: "plan_selected", label: "Seleccionó un plan de membresía" },
    { key: "gym_schedule", label: "Cargó ≥1 horario de gimnasio" },
  ];

  return (
    <Card className="col-span-full">
      <div className="flex items-center gap-2">
        <GitBranch size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Simulador: ¿cómo queda el alta?</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Activá cada situación para ver el modo de ingreso, qué exige el sistema y qué se crea.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          {toggles.map((t) => (
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
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Modo de ingreso
            </p>
            <Pill className={`mt-2 ${COLOR_CLASSES[entry_mode === "GYM" ? "info" : "warning"]}`}>
              <Building2 size={13} />
              {entry_mode === "GYM" ? "GYM — con gimnasio" : "ACTIVITY_ONLY — solo actividades"}
            </Pill>
          </div>

          <div
            className={`rounded-xl border p-4 ${
              blockReasons.length > 0
                ? "border-danger/30 bg-danger-bg dark:bg-danger/10"
                : "border-success/30 bg-success-bg dark:bg-success/10"
            }`}
          >
            {blockReasons.length > 0 ? (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold text-danger-text dark:text-danger">
                  <XCircle size={16} />
                  El alta se rechaza
                </p>
                <ul className="mt-2 space-y-1.5">
                  {blockReasons.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-xs text-danger-text dark:text-danger">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold text-success-text dark:text-success">
                  <CheckCircle2 size={16} />
                  El alta procede
                </p>
                <ul className="mt-2 space-y-1.5">
                  {crea.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-xs text-success-text dark:text-success">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ElPortalDelSocio() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <QrCode size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">El portal del socio (enlace mágico)</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Sin usuario ni contraseña: una URL con token único. Vence a los 30 días y rota.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <KeyRound size={18} className="text-info-text dark:text-info" />
          <p className="mt-2 text-sm font-semibold text-text-primary">Se genera solo</p>
          <p className="mt-1 text-xs text-text-secondary">Al crear el socio, sin intervención.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <CalendarDays size={18} className="text-warning-text dark:text-warning" />
          <p className="mt-2 text-sm font-semibold text-text-primary">Vence a los 30 días</p>
          <p className="mt-1 text-xs text-text-secondary">Configurable por variable de entorno.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <RefreshCw size={18} className="text-success-text dark:text-success" />
          <p className="mt-2 text-sm font-semibold text-text-primary">Rota conservando el previo</p>
          <p className="mt-1 text-xs text-text-secondary">Una generación atrás sigue sirviendo.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-success-text dark:text-success">
            El socio SÍ puede editar
          </p>
          <ul className="mt-3 space-y-1.5">
            {CAMPOS_PORTAL.editables.map((c) => (
              <li key={c} className="flex items-start gap-2 text-xs text-text-secondary">
                <Pencil size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-danger-text dark:text-danger">
            El socio NO puede editar
          </p>
          <ul className="mt-3 space-y-1.5">
            {CAMPOS_PORTAL.soloLectura.map((c) => (
              <li key={c} className="flex items-start gap-2 text-xs text-text-secondary">
                <Ban size={13} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-text dark:bg-danger/15 dark:text-danger">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <span>
          Si está bloqueado por falta de pago, el portal devuelve{" "}
          <span className="font-medium">“Acceso suspendido por falta de pago.”</span> (403). La
          cortesía nunca se bloquea.
        </span>
      </div>
    </Card>
  );
}

function AdjuntosDelSocio() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <FileText size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Los adjuntos del socio</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Fotos o PDFs que el socio sube a su ficha, con revisión del staff.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ADJUNTOS.map((a) => (
          <Pill key={a.key} className={COLOR_CLASSES[a.color]}>
            <FileText size={13} />
            {a.titulo}
          </Pill>
        ))}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">Subir no se bloquea</p>
          <p className="mt-1 text-xs text-text-secondary">
            Aunque esté suspendido, puede subir el comprobante: es la vía para destrabar el acceso.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">El staff revisa</p>
          <p className="mt-1 text-xs text-text-secondary">
            Marca el adjunto como revisado. Cada uno puede llevar una nota.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">Borrar solo si no fue revisado</p>
          <p className="mt-1 text-xs text-text-secondary">
            Una vez revisado, el socio no puede eliminarlo. Al borrar se limpia Cloudinary.
          </p>
        </div>
      </div>
    </Card>
  );
}

function EditarYBorrar() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Pencil size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Editar, cortesía y eliminar</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Editar la ficha es simple; dos cosas tienen letra chica: la cortesía y el borrado.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Pencil size={16} className="text-info-text dark:text-info" />
            <p className="text-sm font-semibold text-text-primary">Editar</p>
          </div>
          <ul className="mt-3 space-y-2">
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Actualiza la ficha con las mismas validaciones del alta (teléfono único).
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Sincroniza horarios si se mandan.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Gift size={16} className="text-warning-text dark:text-warning" />
            <p className="text-sm font-semibold text-text-primary">Cortesía</p>
          </div>
          <ul className="mt-3 space-y-2">
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Poner cortesía: reescribe la membresía a $0.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warning-text dark:text-warning" />
              Quitarla exige elegir un plan pago (salvo socios solo-actividades).
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Trash2 size={16} className="text-danger-text dark:text-danger" />
            <p className="text-sm font-semibold text-text-primary">Eliminar</p>
          </div>
          <ul className="mt-3 space-y-2">
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <XCircle size={13} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              Borrado real, sin vuelta atrás. La UI avisa “no se puede deshacer”.
            </li>
            <li className="flex items-start gap-2 text-xs text-text-secondary">
              <XCircle size={13} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              Arrastra suscripciones, asistencias, inscripciones y adjuntos. Los pagos quedan sin socio.
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function RecuperarSocio() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <RefreshCw size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Recuperar (no es reactivar la ficha)</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Recuperar es un flujo de cobros: reabre la suscripción, no la ficha.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">Requisito</p>
          <p className="mt-1 text-xs text-text-secondary">
            El socio no puede tener ninguna deuda pendiente (suscripciones, sesiones ni sellados).
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">Qué hace</p>
          <p className="mt-1 text-xs text-text-secondary">
            Abre un ciclo nuevo desde hoy hasta fin de mes, pendiente de pago hasta que se cobre.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-text dark:bg-warning/15 dark:text-warning">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>
          Ojo: la marca “es recuperable” de la lista y la acción real no siempre coinciden. Detalle
          completo en <span className="font-medium">AUDITORIA-PAGOS.md §6</span>.
        </span>
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

export default function MembersFlow() {
  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill className="bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger">
              Solo desarrollo · no visible en producción
            </Pill>
            <Pill className="bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
              Fuente: AUDITORIA-MIEMBROS.md
            </Pill>
          </div>
          <h1 className="mt-3 text-3xl font-bold">Flujo de miembros</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Cómo funcionan hoy los socios, en forma visual e interactiva: la ficha, las dos formas de
            alta, qué crea el alta, el portal con enlace mágico, los adjuntos, editar/cortesía,
            eliminar vs. recuperar y qué no hace el sistema.
          </p>
        </div>

        <AnatomiaSocio />

        <DosCaminosDeAlta />

        <QueCreaElAlta />

        <SimuladorAlta />

        <ElPortalDelSocio />

        <AdjuntosDelSocio />

        <EditarYBorrar />

        <RecuperarSocio />

        <LoQueNoHace />

        <p className="pb-4 text-center text-xs text-text-secondary">
          Página de desarrollo: no se incluye en git y no existe en los builds de producción.
        </p>
      </div>
    </div>
  );
}
