import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  AlarmClock,
  Ban,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  DoorOpen,
  Info,
  QrCode,
  Repeat,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  UserRoundCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

const PASOS = [
  {
    titulo: "Socio activo",
    icono: UserRoundCheck,
    descripcion: "Debe existir y estar activo. El sistema bloquea la fila (lock) para evitar dobles lecturas.",
    fail: "Socio no encontrado (404)",
  },
  {
    titulo: "Pago al día",
    icono: Wallet,
    descripcion:
      "Suscripción vigente hoy y sin pago bloqueado ni pendiente inicial ('puede operar').",
    fail: "Acceso suspendido por falta de pago. (403)",
  },
  {
    titulo: "Gimnasio abierto hoy",
    icono: DoorOpen,
    descripcion: "El día no figura como cerrado (GymClosedDate).",
    fail: "El gimnasio está cerrado hoy. (403)",
  },
  {
    titulo: "Recuperación de hoy",
    icono: CalendarClock,
    descripcion:
      "Si hay una recuperación agendada, entra directo y SOLO dentro de la ventana de ese horario.",
    fail: "Tu recuperación era/recién es a las HH:MM. (403)",
  },
  {
    titulo: "Límite semanal del plan",
    icono: Ban,
    descripcion:
      "Cuenta las asistencias de la semana (excluye recuperaciones y días en que el gimnasio no opera).",
    fail: "Alcanzaste el límite de X visitas semanales de tu plan. (403)",
  },
  {
    titulo: "Intercambio aprobado hoy",
    icono: Repeat,
    descripcion:
      "Un swap aprobado para hoy y sin usar deja entrar por el horario intercambiado; el cupo excluye al socio.",
    fail: "Ya registraste asistencia para este intercambio hoy (200)",
  },
  {
    titulo: "¿Ya entró hoy?",
    icono: Clock,
    descripcion: "Una sola asistencia por socio y por día en el camino público.",
    fail: "Ya registraste asistencia hoy (200)",
  },
  {
    titulo: "Horario reservado hoy",
    icono: AlarmClock,
    descripcion: "Busca el horario activo del socio para el día de la semana. Sin horario no hay walk-in.",
    fail: "No tienes un horario reservado para hoy. (403)",
  },
  {
    titulo: "Cupo del horario",
    icono: Users,
    descripcion: "Ocupación efectiva del horario vs su capacidad.",
    fail: "El horario está completo. (400)",
  },
  {
    titulo: "Asistencia registrada",
    icono: CheckCircle2,
    descripcion:
      "Se crea el registro y el socio pasa a su portal. Si el check-in cae en la ventana de un paquete de actividad/outing, se descuenta 1 sesión.",
    fail: null,
  },
];

const RESPONSES = [
  {
    code: "404",
    color: "danger",
    titulo: "Socio no encontrado",
    descripcion: "El token no corresponde a un socio activo.",
  },
  {
    code: "403",
    color: "warning",
    titulo: "Acceso denegado",
    descripcion:
      "Varios motivos: pago bloqueado, gimnasio cerrado, recuperación fuera de ventana, límite semanal alcanzado, o sin horario reservado hoy.",
  },
  {
    code: "400",
    color: "warning",
    titulo: "El horario está completo.",
    descripcion: "La ocupación efectiva del horario alcanzó la capacidad.",
  },
  {
    code: "200 · success:false",
    color: "muted",
    titulo: "Ya entraste hoy",
    descripcion:
      "Duplicado (asistencia ya registrada, o intercambio ya usado). NO es un código de error: el socio ve el mensaje y el front lo redirige igual al portal.",
  },
  {
    code: "200 · success:true",
    color: "success",
    titulo: "Asistencia registrada",
    descripcion: "Normal, de recuperación o de intercambio. Pasa al portal del socio.",
  },
];

const PROBLEMAS = [
  {
    titulo: "El cupo cuenta al propio socio",
    icono: Users,
    impacto:
      "En el camino normal la ocupación incluye al socio que entra: un horario con capacidad igual a sus inscriptos queda 'completo' para ellos. El intercambio, en cambio, sí lo excluye.",
    origen: "compute_effective_occupancy cuenta los horarios activos del slot, que incluyen al socio.",
    evidencia: "backend/attendance/serializers.py:281 · public_views.py:315 vs :231-246 · utils.py:71-77",
  },
  {
    titulo: "Sin ventana horaria",
    icono: AlarmClock,
    impacto:
      "Solo la recuperación valida la hora. Un socio puede hacer check-in a cualquier hora (ej. 03:00) y el staff marcar asistencias de un horario del mediodía de madrugada.",
    origen: "El camino normal no consulta el reloj; la ventana existe solo en la recuperación.",
    evidencia: "backend/attendance/public_views.py:149-194 vs :287-342 · serializers.py:219-306",
  },
  {
    titulo: "El staff puede marcar un día de cierre",
    icono: DoorOpen,
    impacto: "El socio es rechazado si el gimnasio figura cerrado; la planilla del staff no lo verifica.",
    origen: "El serializer staff no chequea GymClosedDate.",
    evidencia: "backend/attendance/public_views.py:140-147 vs serializers.py:219-306",
  },
  {
    titulo: "'Ya entró hoy' no es un error HTTP",
    icono: Clock,
    impacto:
      "El socio que se escanea dos veces recibe 200 con success:false (no un 404/403/400): el front lo muestra como mensaje y redirige igual al portal.",
    origen: "Las respuestas de duplicado omiten el status y caen en 200 por defecto.",
    evidencia: "backend/attendance/public_views.py:221-227, 279-285 · frontend/src/pages/Checkin.jsx:62-91",
  },
  {
    titulo: "Doble registro del staff → error 500",
    icono: XCircle,
    impacto:
      "Dos clicks o dos usuarios a la vez superan el chequeo 'ya registrado' y chocan contra la restricción única de la base: IntegrityError sin capturar → 500.",
    origen: "El staff no usa lock de fila (el público sí, select_for_update).",
    evidencia: "backend/attendance/serializers.py:264-274 vs public_views.py:110-117 · models.py:154",
  },
  {
    titulo: "30 pedidos/hora por IP (público)",
    icono: ShieldAlert,
    impacto:
      "Varios socios detrás de una misma IP (router del gym, pantalla compartida, datos del celular) agotan rápido el límite y todos reciben 429. El staff no tiene límite.",
    origen: "Throttle anónimo por IP de 30/h en el check-in público.",
    evidencia: "backend/config/api/throttles.py:27-29 · public_views.py:107",
  },
  {
    titulo: "Dos horarios el mismo día → entra una sola vez por QR",
    icono: Repeat,
    impacto:
      "El camino público valida una asistencia por (socio, fecha); la base limita por (gimnasio, horario, fecha). Con dos horarios el mismo día el QR rechaza la segunda entrada, pero el staff podría marcarlo dos veces.",
    origen: "Validación del público vs constraint de base y serializer staff.",
    evidencia: "backend/attendance/public_views.py:270-277 vs models.py:154 · serializers.py:264-274",
  },
  {
    titulo: "Sesión de paquete solo dentro de la ventana",
    icono: Sparkles,
    impacto:
      "Si el socio entra fuera del horario de la actividad/salida tipo paquete, su sesión no se descuenta (silencioso): entró al gimnasio pero el paquete quedó igual.",
    origen: "El auto-conteo ignora el resultado si no cae en la ventana.",
    evidencia: "backend/attendance/public_views.py:54-77, 80-100, 332-335",
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

function SimuladorCheckin() {
  const [socioActivo, setSocioActivo] = useState(true);
  const [pagoAlDia, setPagoAlDia] = useState(true);
  const [gymAbierto, setGymAbierto] = useState(true);
  const [tieneRecuperacion, setTieneRecuperacion] = useState(false);
  const [recuperacionEnVentana, setRecuperacionEnVentana] = useState(true);
  const [usadasSemana, setUsadasSemana] = useState(2);
  const [limiteSemanal, setLimiteSemanal] = useState(4);
  const [swapAprobado, setSwapAprobado] = useState(false);
  const [swapYaUsado, setSwapYaUsado] = useState(false);
  const [yaRegistrado, setYaRegistrado] = useState(false);
  const [tieneHorarioHoy, setTieneHorarioHoy] = useState(true);
  const [ocupacion, setOcupacion] = useState(4);
  const [capacidad, setCapacidad] = useState(6);

  const suponiendoSwap = swapAprobado && !swapYaUsado;
  const cupoOk = ocupacion < capacidad;
  const limiteOk = usadasSemana < limiteSemanal;

  const chequeos = [
    {
      titulo: "¿Existe el socio y está activo?",
      ok: socioActivo,
      msg: socioActivo ? "Activo" : "Socio no encontrado (404)",
    },
    {
      titulo: "¿Está al día con el pago?",
      ok: pagoAlDia,
      msg: pagoAlDia ? "Puede operar" : "Acceso suspendido por falta de pago. (403)",
    },
    {
      titulo: "¿El gimnasio está abierto hoy?",
      ok: gymAbierto,
      msg: gymAbierto ? "Abierto" : "El gimnasio está cerrado hoy. (403)",
    },
    {
      titulo: "¿Recuperación agendada hoy?",
      ok: !tieneRecuperacion || recuperacionEnVentana,
      msg: !tieneRecuperacion
        ? "No hay"
        : recuperacionEnVentana
          ? "Dentro de la ventana → Asistencia (recuperación)"
          : "Fuera de ventana: 'era/recién es a las HH:MM'. (403)",
    },
    {
      titulo: "¿Respetó el límite semanal?",
      ok: limiteOk,
      msg: limiteOk
        ? `${usadasSemana}/${limiteSemanal} visitas usadas`
        : `Alcanzaste el límite de ${limiteSemanal} visitas semanales de tu plan. (403)`,
    },
    {
      titulo: "¿Intercambio aprobado hoy y sin usar?",
      ok: !swapAprobado || !swapYaUsado,
      msg: suponiendoSwap
        ? "Entra por el horario intercambiado (cupo excluye al socio)"
        : swapAprobado && swapYaUsado
          ? "Ya registraste asistencia para este intercambio hoy (200)"
          : "No hay",
    },
    {
      titulo: "¿Ya entró hoy?",
      ok: !yaRegistrado || suponiendoSwap,
      msg: yaRegistrado && !suponiendoSwap ? "Ya registraste asistencia hoy (200)" : "Aún no",
    },
    {
      titulo: "¿Tiene horario reservado hoy?",
      ok: tieneHorarioHoy || suponiendoSwap,
      msg:
        suponiendoSwap || tieneHorarioHoy
          ? suponiendoSwap
            ? "Entra por el swap"
            : "Tiene horario"
          : "No tienes un horario reservado para hoy. (403)",
    },
    {
      titulo: "¿Hay cupo en el horario?",
      ok: cupoOk,
      msg: cupoOk
        ? `${ocupacion}/${capacidad} ocupado`
        : "El horario está completo. (400)",
    },
  ];

  const primerosOk = chequeos[0].ok && chequeos[1].ok && chequeos[2].ok;

  let resultado;
  if (primerosOk && tieneRecuperacion && recuperacionEnVentana) {
    resultado = {
      ok: true,
      titulo: "Recuperación",
      msg: "✓ Asistencia registrada (recuperación)",
      code: "200",
      nota: "Entra por la ventana de su recuperación: NO consume cupo ni cuota semanal.",
    };
  } else if (primerosOk && tieneRecuperacion) {
    resultado = {
      ok: false,
      titulo: "Recuperación fuera de ventana",
      msg: "Tu recuperación de hoy era a las HH:MM — ese horario ya pasó. / Tu recuperación de hoy recién es a las HH:MM.",
      code: "403",
      nota: "La recuperación es la única asistencia con ventana horaria estricta.",
    };
  } else {
    const falla = chequeos.find((c) => !c.ok);
    resultado = falla
      ? {
          ok: false,
          titulo: "No puede entrar",
          msg: falla.msg,
          code: falla.msg.match(/\((\d+)\)/)?.[1] ?? "—",
          nota: "Corta en la primera regla que falla, como hace el backend.",
        }
      : {
          ok: true,
          titulo: suponiendoSwap ? "Intercambio" : "Asistencia normal",
          msg: suponiendoSwap ? "✓ Asistencia registrada (intercambio)" : "✓ Asistencia registrada",
          code: "200",
          nota: suponiendoSwap
            ? "El cupo del horario destino se calcula excluyendo al socio (ya reservado por el swap)."
            : "Entra al gimnasio. Si el check-in cae en la ventana de un paquete de actividad/outing, se descuenta 1 sesión.",
        };
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <QrCode size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Simulador: ¿el socio puede entrar hoy?</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Ajustá las condiciones y mirá si un check-in por QR pasaría las validaciones (en el orden real del backend) y qué
        mensaje vería el socio.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-primary">Socio activo</span>
            <input
              type="checkbox"
              checked={socioActivo}
              onChange={(e) => setSocioActivo(e.target.checked)}
              className="size-4 accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-primary">Pago al día (suscripción vigente)</span>
            <input
              type="checkbox"
              checked={pagoAlDia}
              onChange={(e) => setPagoAlDia(e.target.checked)}
              className="size-4 accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-primary">Gimnasio abierto hoy</span>
            <input
              type="checkbox"
              checked={gymAbierto}
              onChange={(e) => setGymAbierto(e.target.checked)}
              className="size-4 accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-primary">Tiene recuperación agendada hoy</span>
            <input
              type="checkbox"
              checked={tieneRecuperacion}
              onChange={(e) => setTieneRecuperacion(e.target.checked)}
              className="size-4 accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-primary">Está dentro de la ventana de su recuperación</span>
            <input
              type="checkbox"
              checked={recuperacionEnVentana}
              disabled={!tieneRecuperacion}
              onChange={(e) => setRecuperacionEnVentana(e.target.checked)}
              className="size-4 accent-blue-500 disabled:opacity-40"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-primary">Tiene un intercambio aprobado para hoy</span>
            <input
              type="checkbox"
              checked={swapAprobado}
              onChange={(e) => setSwapAprobado(e.target.checked)}
              className="size-4 accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-primary">El intercambio ya lo usó</span>
            <input
              type="checkbox"
              checked={swapYaUsado}
              disabled={!swapAprobado}
              onChange={(e) => setSwapYaUsado(e.target.checked)}
              className="size-4 accent-blue-500 disabled:opacity-40"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-primary">¿Ya entró hoy?</span>
            <input
              type="checkbox"
              checked={yaRegistrado}
              onChange={(e) => setYaRegistrado(e.target.checked)}
              className="size-4 accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-primary">Tiene horario reservado hoy</span>
            <input
              type="checkbox"
              checked={tieneHorarioHoy}
              onChange={(e) => setTieneHorarioHoy(e.target.checked)}
              className="size-4 accent-blue-500"
            />
          </label>

          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text-primary">Visitas usadas esta semana</span>
              <span className="font-semibold text-info-text dark:text-info">{usadasSemana}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={usadasSemana}
              onChange={(e) => setUsadasSemana(Number(e.target.value))}
              className="mt-2 w-full accent-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text-primary">Límite semanal del plan</span>
              <span className="font-semibold text-info-text dark:text-info">{limiteSemanal}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={limiteSemanal}
              onChange={(e) => setLimiteSemanal(Number(e.target.value))}
              className="mt-2 w-full accent-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text-primary">Ocupación del horario (incluye al socio)</span>
              <span className="font-semibold text-info-text dark:text-info">{ocupacion}</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              value={ocupacion}
              onChange={(e) => setOcupacion(Number(e.target.value))}
              className="mt-2 w-full accent-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text-primary">Capacidad del horario</span>
              <span className="font-semibold text-info-text dark:text-info">{capacidad}</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              value={capacidad}
              onChange={(e) => setCapacidad(Number(e.target.value))}
              className="mt-2 w-full accent-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div
            className={`rounded-xl border p-4 text-sm ${
              resultado.ok
                ? "border-success/40 bg-success-bg dark:bg-success/10"
                : "border-danger/40 bg-danger-bg dark:bg-danger/10"
            }`}
          >
            <p className="font-semibold text-text-primary">
              {resultado.titulo} — {resultado.ok ? "Entra al gimnasio" : "No puede entrar"}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              El socio vería: <span className="font-mono font-medium text-text-primary">«{resultado.msg}»</span>{" "}
              <Pill className={resultado.ok ? "bg-success-bg text-success-text dark:bg-success/15 dark:text-success" : "bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger"}>
                {resultado.code}
              </Pill>
            </p>
            <p className="mt-2 text-xs text-text-secondary">{resultado.nota}</p>
          </div>

          <ul className="space-y-2">
            {chequeos.map((c) => (
              <li key={c.titulo} className="flex items-start gap-2 text-sm text-text-secondary">
                {c.ok ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
                ) : (
                  <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
                )}
                <span>
                  <span className="font-medium text-text-primary">{c.titulo}: </span>
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

function DiagramaCheckin() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <RotateCcw size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">El orden del check-in</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Los pasos en el orden real del backend. Cada paso corta la entrada con el código que se muestra.
      </p>

      <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-stretch">
        {PASOS.map((paso, i) => {
          const Icon = paso.icono;
          return (
            <div key={paso.titulo} className="flex flex-1 items-center gap-3 xl:flex-col xl:text-center">
              <div className="flex flex-1 items-center gap-3 xl:flex-col">
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full ${
                    paso.fail
                      ? "bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
                      : "bg-success-bg text-success-text dark:bg-success/15 dark:text-success"
                  }`}
                >
                  <Icon size={22} />
                </div>
                <div className="flex-1 xl:text-center">
                  <p className="text-sm font-semibold text-text-primary">{paso.titulo}</p>
                  <p className="mt-1 text-xs text-text-secondary">{paso.descripcion}</p>
                  {paso.fail && (
                    <p className="mt-1 font-mono text-[10px] text-warning-text dark:text-warning">{paso.fail}</p>
                  )}
                </div>
              </div>
              {i < PASOS.length - 1 && <ArrowDown size={18} className="shrink-0 text-text-secondary xl:hidden" />}
              {i < PASOS.length - 1 && <ArrowRight size={18} className="hidden shrink-0 text-text-secondary xl:block" />}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function RespuestasApi() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Info size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Respuestas del check-in</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Las respuestas HTTP reales que puede devolver el endpoint público y qué significa cada una.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RESPONSES.map((r) => (
          <div key={r.code} className="rounded-xl border border-border bg-surface p-4">
            <Pill
              className={
                {
                  success: "bg-success-bg text-success-text dark:bg-success/15 dark:text-success",
                  warning: "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning",
                  danger: "bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger",
                  muted: "bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted",
                }[r.color]
              }
            >
              {r.code}
            </Pill>
            <p className="mt-2 text-sm font-semibold text-text-primary">{r.titulo}</p>
            <p className="mt-1 text-xs text-text-secondary">{r.descripcion}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Caminos() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <UserRoundCheck size={18} className="text-info-text dark:text-info" />
        <h2 className="text-lg font-bold text-text-primary">Socio por QR vs planilla del staff</h2>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <QrCode size={16} className="text-info-text dark:text-info" />
            Check-in del socio (QR / enlace)
          </p>
          <ul className="mt-3 space-y-2 text-xs text-text-secondary">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              URL pública con el token del socio, sin sesión
            </li>
            <li className="flex items-start gap-2">
              <XCircle size={14} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              Solo 1 vez por día, y solo si tiene horario reservado hoy
            </li>
            <li className="flex items-start gap-2">
              <XCircle size={14} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              Límite 30/h por IP + 600/h por token
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Valida cierre del gym y usa lock de fila
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <ClipboardCheck size={16} className="text-info-text dark:text-info" />
            Planilla del staff
          </p>
          <ul className="mt-3 space-y-2 text-xs text-text-secondary">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Autenticado (cualquier usuario del gym, sin rol en el backend)
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success-text dark:text-success" />
              Puede marcar a quien no tiene horario (elige horario manual)
            </li>
            <li className="flex items-start gap-2">
              <XCircle size={14} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              NO valida cierre del gym ni hora del día
            </li>
            <li className="flex items-start gap-2">
              <XCircle size={14} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
              Sin lock de fila: doble marca → posible 500
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
        Comportamientos reales del sistema actual que conviene tener en cuenta (ver AUDITORIA-ASISTENCIAS.md).
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
          No marca ausencias: no hay "no vino" ni "llegó tarde" ni tarea automática
        </li>
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          No valida la hora en el camino normal (solo recuperaciones)
        </li>
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          El staff no verifica que el gimnasio esté abierto el día que marca
        </li>
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          No hay walk-in por QR sin horario reservado (el staff sí puede marcarlo)
        </li>
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          No blinda el doble registro del staff (puede terminar en 500)
        </li>
        <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text dark:text-danger" />
          No informa "ya entraste" como error: devuelve 200 y redirige igual al portal
        </li>
      </ul>
    </Card>
  );
}

export default function AttendanceFlow() {
  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-5">
          <div className="flex items-center gap-2">
            <Pill className="bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger">
              Solo desarrollo · no visible en producción
            </Pill>
            <Pill className="bg-muted-bg text-muted-text dark:bg-muted/15 dark:text-muted">
              Fuente: AUDITORIA-ASISTENCIAS.md
            </Pill>
          </div>
          <h1 className="mt-3 text-3xl font-bold">Asistencias</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Cómo funciona el check-in y el registro de asistencia hoy, en forma visual e interactiva: qué reglas se
            aplican antes de entrar, quién puede registrar, y qué problemas pueden aparecer.
          </p>
        </div>

        <SimuladorCheckin />

        <DiagramaCheckin />

        <RespuestasApi />

        <Caminos />

        <ProblemasPosibles />

        <LoQueNohace />

        <p className="pb-4 text-center text-xs text-text-secondary">
          Página de desarrollo: no se incluye en git y no existe en los builds de producción.
        </p>
      </div>
    </div>
  );
}