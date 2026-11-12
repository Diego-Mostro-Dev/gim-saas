import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  CreditCard,
  FileWarning,
  Info,
  LayoutDashboard,
  QrCode,
  Search,
  Settings,
  Shield,
  Sparkles,
  Store,
  Users,
  XCircle,
} from "lucide-react";

const SECCIONES = {
  anatomia: {
    key: "anatomia",
    nombre: "Anatomía de Configuración",
    icono: Settings,
    descripcion:
      "Qué entidades componen la configuración del gimnasio y cómo se relacionan.",
  },
  tabs: {
    key: "tabs",
    nombre: "Pestañas mapeadas",
    icono: LayoutDashboard,
    descripcion: "Qué controla cada pestaña de Settings.jsx.",
  },
  reglas: {
    key: "reglas",
    nombre: "Reglas clave",
    icono: Shield,
    descripcion:
      "Vencimiento vs bloqueo, límites de cambios, recuperación y validaciones.",
  },
  efectos: {
    key: "efectos",
    nombre: "Efectos cruzados",
    icono: ArrowRight,
    descripcion:
      "Cómo impacta Configuración en cambios de plan/horario, acceso, renovación.",
  },
  banderas: {
    key: "banderas",
    nombre: "Banderas y defaults",
    icono: Info,
    descripcion:
      "Defaults reales, features read-only, campos legacy y campos fuera de UI.",
  },
  api: {
    key: "api",
    nombre: "API, permisos y cache",
    icono: Sparkles,
    descripcion: "Endpoints reales, permisos, PWA y cache del gimnasio.",
  },
  noHace: {
    key: "noHace",
    nombre: "Lo que NO hace",
    icono: XCircle,
    descripcion: "Límites del scope de Configuración.",
  },
  bugs: {
    key: "bugs",
    nombre: "Problemas vigentes",
    icono: FileWarning,
    descripcion: "CFG-02, CFG-03, CFG-16, CFG-17 y el hueco de horarios.",
  },
};

const SettingsFlow = () => {
  const [seccionActiva, setSeccionActiva] = useState("anatomia");

  const renderContenido = () => {
    switch (seccionActiva) {
      case "anatomia":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Settings className="h-5 w-5 text-primary" />
                Entidades principales
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface-input p-4">
                  <h3 className="mb-2 font-medium text-text-primary">Gym</h3>
                  <p className="text-sm text-text-secondary">
                    Configuración global del gimnasio: identidad, pagos, cambios de
                    plan y horario, recuperación, cupos, QR, SEO, features, labels y PWA.{" "}
                    <strong>GymSerializer.features es read-only</strong>: el gimnasio
                    no activa módulos desde Settings.
                  </p>
                  <p className="mt-2 text-xs text-text-secondary">
                    backend/gyms/models.py · Gym
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-4">
                  <h3 className="mb-2 font-medium text-text-primary">Discount</h3>
                  <p className="text-sm text-text-secondary">
                    Porcentaje 1–100 por gimnasio. La UI es owner-only, pero el
                    backend sólo exige autenticación (CFG-16).
                  </p>
                  <p className="mt-2 text-xs text-text-secondary">
                    backend/gyms/models.py · Discount
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-4">
                  <h3 className="mb-2 font-medium text-text-primary">GymClosedDate</h3>
                  <p className="text-sm text-text-secondary">
                    Una fecha por gimnasio; feriados AR futuros sin duplicados. Si
                    falla la API externa, responde 502 y no crea nada.
                  </p>
                  <p className="mt-2 text-xs text-text-secondary">
                    backend/gyms/models.py · GymClosedDate
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-4">
                  <h3 className="mb-2 font-medium text-text-primary">HealthInsurance</h3>
                  <p className="text-sm text-text-secondary">
                    Obra social: coseguro por sesión y sellado opcional. UI
                    owner-only; backend sin gate de rol (CFG-16).
                  </p>
                  <p className="mt-2 text-xs text-text-secondary">
                    backend/members/models.py · HealthInsurance
                  </p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-center gap-4 text-sm text-text-secondary">
                <span>Settings.jsx</span>
                <ArrowRight className="h-4 w-4" />
                <span>gym.service.js (updateGym/getGym)</span>
                <ArrowRight className="h-4 w-4" />
                <span>PATCH /api/gyms/me/ (owner)</span>
              </div>
            </div>
          </div>
        );
      case "tabs":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <LayoutDashboard className="h-5 w-5 text-primary" />
                Mapeo por pestañas
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <Info className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">Información</p>
                    <p className="text-text-secondary">
                      Nombre, WhatsApp/teléfono/email, logo e ícono de app, y la
                      capacidad por defecto de slots. slug y active no se muestran.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <CreditCard className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">Pagos</p>
                    <p className="text-text-secondary">
                      payment_due_day (10) y access_block_day (16), con
                      access_block_day &gt; payment_due_day. Incluye el catálogo de
                      descuentos.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <CalendarDays className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">Planes &amp; Horarios</p>
                    <p className="text-text-secondary">
                      allow_plan_changes y allow_schedule_changes; cooldown de 168 h,
                      aviso de 24 h y máximo 4 cambios/mes. CRUD de slots con su
                      capacidad.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <Users className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">Obras sociales</p>
                    <p className="text-text-secondary">
                      CRUD de HealthInsurance: nombre, coseguro por sesión
                      (session_price) y sellado (sellado_amount).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <Shield className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">Staff</p>
                    <p className="text-text-secondary">
                      Alta, cambio de rol y baja de staff, profesor y entrenador. El
                      owner no se elimina ni se le cambia el rol.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <FileWarning className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">Fechas cerradas</p>
                    <p className="text-text-secondary">
                      CRUD de fechas únicas por gimnasio y carga masiva de feriados AR
                      (sólo futuras, sin duplicados).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <QrCode className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">QR</p>
                    <p className="text-text-secondary">
                      qr_attendance_message y qr_registration_message de los carteles
                      imprimibles.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <Store className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">Comunidad (condicional)</p>
                    <p className="text-text-secondary">
                      Sólo aparece si gym.features.community está activa. CRUD de locales
                      adheridos; si se apaga, ?tab=comunidad vuelve a Información.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <Search className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">SEO</p>
                    <p className="text-text-secondary">
                      seo_title/description/keywords/city/address/hours; alimentan la
                      vista previa y el HTML indexable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "reglas":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Shield className="h-5 w-5 text-primary" />
                Reglas clave
              </h2>
              <div className="space-y-3 text-sm">
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Vencimiento vs bloqueo</p>
                  <p className="mt-1 text-text-secondary">
                    payment_due_day (10) → hasta ahí el socio sigue pendiente pero{" "}
                    <strong>puede entrenar</strong>. access_block_day (16) → desde ahí
                    queda <strong>bloqueado</strong>. Se valida en modelo, serializer,
                    admin y pantalla. El bloqueo es <strong>sólo por saldo de suscripción
                    mensual</strong>; la cortesía no se bloquea por pago.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Cambios de horario (permanentes + swaps)</p>
                  <p className="mt-1 text-text-secondary">
                    Requiere allow_schedule_changes. Cooldown de 168 h, aviso previo de
                    24 h y máximo de 4 cambios/mes. El límite es{" "}
                    <strong>mensual combinado</strong>: permanentes (pending/approved/executed)
                    + swaps (pending/approved), por mes calendario. Aplica igual al socio y
                    al staff. El campo allow_member_schedule_changes es legacy y no
                    gobierna ninguna regla (CFG-02).
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Cambios de plan</p>
                  <p className="mt-1 text-text-secondary">
                    Gated por allow_plan_changes (true por defecto). Efecto: inmediato si
                    no hay ciclo vigente; si hay, rige desde el 1º del mes siguiente.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Recuperación</p>
                  <p className="mt-1 text-text-secondary">
                    allow_session_recovery (false por defecto) y
                    max_session_recoveries_per_month (2). Consume cupo del horario destino
                    y no puede caer en una fecha cerrada.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Reglas de plataforma (fuera de la UI)</p>
                  <p className="mt-1 text-text-secondary">
                    allow_activity_without_membership (true): control de plataforma que
                    renueva socios solo-actividad; se gestiona desde el admin central.
                    checkin_window_minutes (0): ventana de check-in, 0–1440 minutos; sólo
                    se edita por API/admin.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Validaciones</p>
                  <p className="mt-1 text-text-secondary">
                    access_block_day &gt; payment_due_day, ambos 1–31. Cooldown, aviso y
                    máximo por mes son enteros ≥ 0. checkin_window_minutes entre 0 y 1440.
                    La capacidad por defecto admite vacío; cada slot conserva su propio
                    cupo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      case "efectos":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <ArrowRight className="h-5 w-5 text-primary" />
                Efectos cruzados
              </h2>
              <div className="flex flex-col items-center gap-3 py-4 text-sm md:flex-row md:justify-center">
                <div className="rounded-xl border border-border bg-surface-input px-4 py-2">Configuración (Gym)</div>
                <ArrowDown className="h-4 w-4 rotate-90 md:rotate-0" />
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">Pagos y suscripciones</div>
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">Cambios de plan</div>
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">Cambios de horario</div>
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">Acceso y renovación</div>
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">Recuperación</div>
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">Asistencias y cierres</div>
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">Descuentos y obras sociales</div>
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">Features y labels</div>
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">SEO y PWA</div>
                </div>
              </div>
              <p className="text-center text-xs text-text-secondary">
                payment_due_day/access_block_day · allow_plan_changes · allow_schedule_changes + límites · allow_session_recovery · GymClosedDate · Discount · HealthInsurance · features/labels · seo_* · logo/app_icon/name · qr_*_message
              </p>
            </div>
          </div>
        );
      case "banderas":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Info className="h-5 w-5 text-primary" />
                Defaults verificados y campos especiales
              </h2>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Pagos</p>
                  <p className="text-text-secondary">payment_due_day = 10, access_block_day = 16</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Cambios</p>
                  <p className="text-text-secondary">
                    allow_plan_changes = true, allow_schedule_changes = true, cooldown =
                    168 h, aviso = 24 h, máximo = 4/mes
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Recuperación</p>
                  <p className="text-text-secondary">
                    allow_session_recovery = false, máximo = 2/mes
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Capacidad</p>
                  <p className="text-text-secondary">
                    default_schedule_capacity vacío (null). Cada slot conserva su cupo;
                    la duración por defecto es 60 minutos.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Features (read-only)</p>
                  <p className="text-text-secondary">
                    activities / personal_training / community / salidas, todas false.
                    Sólo el admin central las activa; el gimnasio no puede hacerlo desde
                    Settings ni por API.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Legacy (CFG-02)</p>
                  <p className="text-text-secondary">
                    allow_member_schedule_changes = false. Sigue en modelo/API pero no
                    gobierna ninguna regla ni aparece en la UI.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Fuera de la UI</p>
                  <p className="text-text-secondary">
                    allow_activity_without_membership = true (plataforma) y
                    checkin_window_minutes = 0 (API/admin). active y slug no se muestran,
                    pero son escribibles por API (CFG-17).
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Labels</p>
                  <p className="text-text-secondary">
                    DEFAULT_LABELS + SINKRO_LABELS calculados por gimnasio; no se editan
                    desde Settings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      case "api":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="h-5 w-5 text-primary" />
                API, permisos y cache
              </h2>
              <div className="space-y-3 text-sm">
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Endpoints</p>
                  <p className="mt-1 text-text-secondary">
                    GET/PATCH /api/gyms/me/ (GymMeView). Descuentos: /api/gyms/me/discounts/.
                    Obras sociales: /api/health-insurances/. Fechas cerradas:
                    /api/gyms/me/closed-dates/ (GET/POST), /api/gyms/me/closed-dates/&lt;id&gt;/
                    (DELETE) y /api/gyms/me/closed-dates/holidays/ (POST). Staff:
                    /api/gyms/staff/ (GET/POST) y /api/gyms/staff/&lt;id&gt;/ (PATCH/DELETE).
                    SEO público: /api/gyms/public/seo/&lt;onboarding_code&gt;/. PWA: el frontend
                    usa /api/pwa/manifest/member/&lt;token&gt; y /api/pwa/manifest/staff/&lt;slug&gt;;
                    el proxy los reenvía a /api/gyms/pwa/member/&lt;token&gt;/ y
                    /api/gyms/pwa/staff/&lt;slug&gt;/.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Permisos</p>
                  <p className="mt-1 text-text-secondary">
                    GymMeView.get: cualquier autenticado del gimnasio; GymMeView.patch:
                    owner. Fechas cerradas y staff: owner en escritura. Descuentos y obras
                    sociales: sólo autenticación, sin require_owner (CFG-16). Slots: sólo
                    autenticación (AUDITORIA-HORARIOS.md §4). SEO y PWA: públicos. El front
                    exige role === "owner" para abrir Settings.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Cache &amp; eventos</p>
                  <p className="mt-1 text-text-secondary">
                    updateGym refresca el cache gym y dispara "features:updated". useGym
                    comparte el request en vuelo, con TTL de 10 minutos y refresco por
                    focus/visibility a través de FeatureProvider.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">PWA manifests</p>
                  <p className="mt-1 text-text-secondary">
                    resolveManifestHref valida que la respuesta sea 2xx y JSON antes de
                    usar el href dinámico; si falla, cae a /member-manifest.json o
                    /manifest.json. El manifiesto de socio no declara start_url; el de
                    staff usa "/".
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      case "noHace":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <XCircle className="h-5 w-5 text-primary" />
                Lo que NO hace
              </h2>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li>• No gestiona planes/precios (módulo Planes)</li>
                <li>• No gestiona suscripciones/cobros (Pagos/Suscripciones)</li>
                <li>• No gestiona asistencia/check-in (Asistencias)</li>
                <li>• No crea socios (Miembros/Registro)</li>
                <li>• No gestiona actividades/salidas/PT (módulos específicos)</li>
                <li>• No es configuración global de plataforma: las features sólo las activa el admin central y los labels no se editan</li>
                <li>• No bloquea por sesiones/paquetes/sellados – sólo por saldo de suscripción mensual</li>
                <li>• No crea suscripciones – sólo define reglas que las afectan</li>
                <li>• Descuentos y obras sociales son owner-only sólo en la UI; el backend no valida el rol (CFG-16)</li>
                <li>• active y slug no se editan desde Settings, pero siguen siendo escribibles por API (CFG-17)</li>
              </ul>
            </div>
          </div>
        );
      case "bugs":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <FileWarning className="h-5 w-5 text-primary" />
                Problemas vigentes
              </h2>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li>• <strong>CFG-02 (Decisión):</strong> allow_member_schedule_changes es legacy y no gobierna ninguna regla.</li>
                <li>• <strong>CFG-03 (Decisión):</strong> initial_pending bloquea desde el día 1 aunque el socio pague después del vencimiento.</li>
                <li>• <strong>CFG-16 (MEDIO, abierto):</strong> descuentos y obras sociales no validan rol en el backend; la UI es owner-only.</li>
                <li>• <strong>CFG-17 (BAJO, abierto):</strong> active y slug son escribibles por API; pueden romper las URLs públicas y el manifiesto PWA de staff.</li>
                <li>• <strong>Horarios:</strong> los endpoints de slots sólo exigen autenticación; ver AUDITORIA-HORARIOS.md §4.</li>
              </ul>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-surface px-4 pb-12 pt-8 text-text-primary">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Flujo de Configuración</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Visualización DEV-only del funcionamiento actual de Configuración del gimnasio.
            Basado en AUDITORIA-CONFIGURACION.md
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
          <div className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Secciones
            </h2>
            <nav className="space-y-1">
              {Object.values(SECCIONES).map((sec) => {
                const Icon = sec.icono;
                const activa = seccionActiva === sec.key;
                return (
                  <button
                    key={sec.key}
                    onClick={() => setSeccionActiva(sec.key)}
                    className={`group flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition ${
                      activa
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-surface-input"
                    }`}
                  >
                    <Icon className="mt-0.5 h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">{sec.nombre}</p>
                      <p className="text-xs text-text-secondary">
                        {sec.descripcion}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          <div>{renderContenido()}</div>
        </div>
      </div>
    </div>
  );
};

export default SettingsFlow;
