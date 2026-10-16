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
    nombre: "Banderas por defecto",
    icono: Info,
    descripcion: "Valores típicos desde modelo/migraciones.",
  },
  api: {
    key: "api",
    nombre: "API, permisos y cache",
    icono: Sparkles,
    descripcion: "Endpoints, owner-only, PWA manifests y cache gym.",
  },
  noHace: {
    key: "noHace",
    nombre: "Lo que NO hace",
    icono: XCircle,
    descripcion: "Límites del scope de Configuración.",
  },
  bugs: {
    key: "bugs",
    nombre: "Bugs/edge cases a vigilar",
    icono: FileWarning,
    descripcion: "Detalles prácticos para evitar confusiones.",
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
                    Config global por gimnasio: pagos (due/block day), cambios plan/horario,
                    recuperación, QR, SEO, features, branding/PWA.
                  </p>
                  <p className="mt-2 text-xs text-text-secondary">
                    backend/gyms/models.py:8-256
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-4">
                  <h3 className="mb-2 font-medium text-text-primary">Discount</h3>
                  <p className="text-sm text-text-secondary">
                    Descuentos porcentuales CRUD por gimnasio (owner).
                  </p>
                  <p className="mt-2 text-xs text-text-secondary">
                    backend/gyms/models.py:210-256 · views.py:70-140
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-4">
                  <h3 className="mb-2 font-medium text-text-primary">GymClosedDate</h3>
                  <p className="text-sm text-text-secondary">
                    Fechas cerradas + carga masiva feriados AR (solo futuros, sin duplicados).
                  </p>
                  <p className="mt-2 text-xs text-text-secondary">
                    backend/gyms/models.py:193-208 · views.py:175-250
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-4">
                  <h3 className="mb-2 font-medium text-text-primary">HealthInsurance</h3>
                  <p className="text-sm text-text-secondary">
                    Obras sociales: coseguro por sesión + sellado único (opcional), activo.
                  </p>
                  <p className="mt-2 text-xs text-text-secondary">
                    backend/members/models.py
                  </p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-center gap-4 text-sm text-text-secondary">
                <span>Settings.jsx</span>
                <ArrowRight className="h-4 w-4" />
                <span>gym.service.js (updateGym/getGym)</span>
                <ArrowRight className="h-4 w-4" />
                <span>PATCH /api/gyms/me/</span>
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
                    <p className="font-medium text-text-primary">Info / Básicos</p>
                    <p className="text-text-secondary">
                      Nombre, WhatsApp/teléfono/email, logo/ícono app, branding.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <CreditCard className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">Pagos</p>
                    <p className="text-text-secondary">
                      payment_due_day / access_block_day. Validación: access_block_day &gt; payment_due_day.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <CalendarDays className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">Planes &amp; Horarios</p>
                    <p className="text-text-secondary">
                      allow_plan_changes, allow_schedule_changes, cooldown (días/h), notice (días/h), max cambios/mes, allow_member_schedule_changes (legacy). Gestión de slots/capacidades.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <Users className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">Obras sociales</p>
                    <p className="text-text-secondary">
                      CRUD HealthInsurance: nombre, coseguro por sesión, sellado único.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <Shield className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">Staff / Comunidad / Características</p>
                    <p className="text-text-secondary">
                      Gestión staff, features (activities/PT/community/salidas), labels context.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <FileWarning className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">Cierres / Feriados</p>
                    <p className="text-text-secondary">
                      GymClosedDate CRUD + POST /me/closed-dates/holidays/ (AR).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <QrCode className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">QR</p>
                    <p className="text-text-secondary">
                      qr_attendance_message, qr_registration_message (carteles A4).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-input p-3">
                  <Search className="mt-0.5 h-4 w-4 text-text-secondary" />
                  <div>
                    <p className="font-medium text-text-primary">SEO</p>
                    <p className="text-text-secondary">
                      seo_title/description/keywords/city/address/hours + contexto manifests.
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
                  <p className="font-medium text-text-primary">Vencimiento vs Bloqueo</p>
                  <p className="mt-1 text-text-secondary">
                    payment_due_day (default 10) → hasta ahí pendiente pero <strong>puede entrenar</strong>.
                    access_block_day (default 16) → desde ahí <strong>bloqueado</strong>. Bloqueo <strong>solo por saldo de suscripción mensual</strong>. Cortesía nunca bloqueado por pago. initial_pending → bloqueado desde día 1.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Cambios de horario (permanentes + swaps)</p>
                  <p className="mt-1 text-text-secondary">
                    Requiere allow_schedule_changes. Respetan cooldown_hours, schedule_change_notice_hours. Límite <strong>mensual combinado</strong>: permanentes (pending/approved/executed) + swaps (pending/approved). Conteo por mes calendario.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Cambios de plan</p>
                  <p className="mt-1 text-text-secondary">
                    Gated por allow_plan_changes. Efecto: hoy si no hay ciclo vigente; else 1º mes siguiente.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Recuperación</p>
                  <p className="mt-1 text-text-secondary">
                    allow_session_recovery + max_session_recoveries_per_month.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Validaciones</p>
                  <p className="mt-1 text-text-secondary">
                    access_block_day &gt; payment_due_day. cooldown/notice/max &gt;= 0. Unicidades/consistencias según modelo.
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
                <div className="flex flex-col gap-2 md:flex-row">
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">Cambios de plan</div>
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">Cambios horario</div>
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">Acceso/Estado</div>
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">Renovación</div>
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">Recuperación</div>
                  <div className="rounded-xl border border-border bg-surface-input px-4 py-2">UI/Features</div>
                </div>
              </div>
              <p className="text-center text-xs text-text-secondary">
                allow_plan_changes / allow_schedule_changes + límites / payment_due_day-access_block_day / allow_session_recovery / features/labels
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
                Banderas por defecto (típicos)
              </h2>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Pagos</p>
                  <p className="text-text-secondary">payment_due_day=10, access_block_day=16</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Cambios plan</p>
                  <p className="text-text-secondary">allow_plan_changes = True (por defecto)</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Cambios horario</p>
                  <p className="text-text-secondary">allow_schedule_changes (según config). cooldown/notice/max según valores guardados (horas en backend).</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Recuperación</p>
                  <p className="text-text-secondary">allow_session_recovery (flag) + max_session_recoveries_per_month</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Features</p>
                  <p className="text-text-secondary">activities/personal_training/community/salidas (gestionados desde Settings + Admin)</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Legacy</p>
                  <p className="text-text-secondary">allow_member_schedule_changes (presente histórico)</p>
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
                    GET/PATCH /api/gyms/me/ (GymMeView). Descuentos: /api/gyms/me/discounts/ (router). Closed dates: /api/gyms/me/closed-dates/ (GET/POST), /api/gyms/me/closed-dates/&lt;id&gt;/ (DELETE), /api/gyms/me/closed-dates/holidays/ (POST). Manifests PWA: /api/pwa/manifest/member/&lt;token&gt;, /api/pwa/manifest/staff/&lt;slug&gt;.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Permisos</p>
                  <p className="mt-1 text-text-secondary">
                    GymMeView requiere auth (owner para mutaciones sensibles vía require_owner en views específicas: closed-dates/discounts según implementación). Front exige role === "owner" para acceder a Settings.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">Cache &amp; eventos</p>
                  <p className="mt-1 text-text-secondary">
                    updateGym refresca cache gym + dispatch "features:updated". useGym comparte in-flight request, TTL 10min + focus/visibility refresh vía FeatureProvider.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-input p-3">
                  <p className="font-medium text-text-primary">PWA manifests</p>
                  <p className="mt-1 text-text-secondary">
                    resolveManifestHref valida JSON OK antes de usar dynamic href; fallback a estático si falla.
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
                <li>• No gestiona actividades/salidas/PT agenda (módulos específicos)</li>
                <li>• No es configuración global app – es por gimnasio</li>
                <li>• No bloquea por sesiones/paquetes/sellados – solo por saldo de suscripción mensual</li>
                <li>• No crea suscripciones – solo flags/reglas que las afectan</li>
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
                Bugs/edge cases a vigilar
              </h2>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li>• <strong>Unidades mixtas:</strong> UI días vs backend horas (cooldown/notice). Ver mapeo Settings.jsx.</li>
                <li>• <strong>Legacy:</strong> allow_member_schedule_changes presente histórico – documentado tal cual.</li>
                <li>• <strong>initial_pending:</strong> bloqueado desde día 1 aunque ingrese después de payment_due_day.</li>
                <li>• <strong>Conteo combinado:</strong> permanentes+swaps comparten límite (usar count_schedule_changes_used_this_month).</li>
                <li>• <strong>Feriados:</strong> solo futuros, evita duplicados; falla API externa posible.</li>
                <li>• <strong>PWA:</strong> resolveManifestHref cae a fallback si no OK/JSON inválido.</li>
                <li>• <strong>Cache:</strong> tras PATCH se refresca gym + features:updated.</li>
                <li>• <strong>Validación:</strong> access_block_day &gt; payment_due_day debe mantenerse.</li>
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
