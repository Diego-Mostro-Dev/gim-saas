const DEFAULT_LABELS = {
  "register.title": "Registro al gimnasio",
  "onboarding.step_label": "Gimnasio",
  "onboarding.service_label": "Gimnasio",
  "onboarding.service_desc": "Acceso al gimnasio con plan y horarios propios",
  "onboarding.service_unavailable": "No disponible para este gimnasio",
  "onboarding.plan_title": "Elegí tu plan de gimnasio",
  "onboarding.schedule_hours": "Horarios de asistencia al gimnasio",
  "onboarding.plan_label": "Plan de gimnasio",
  "onboarding.activities_empty": "No hay actividades disponibles para este gimnasio.",
  "member_form.entry_gym": "Gimnasio",
  "staff.attendance.title": "Organización semanal del gimnasio",
  "staff.members.title": "Gestión de miembros del gimnasio",
  "staff.payments.title": "Gestión de pagos del gimnasio",
  "staff.plans.title": "Gestión de planes del gimnasio",
  "staff.activities.title": "Gestión de actividades extra del gimnasio",
  "staff.activities.disabled": "El módulo de actividades extra no está habilitado para este gimnasio.",
  "staff.activity_schedules.disabled": "Las actividades no están habilitadas para este gimnasio.",
  "staff.staff.title": "Usuarios que pueden acceder al panel del gimnasio.",
  "staff.settings.basic_info": "Información básica del gimnasio.",
  "staff.settings.closed_dates_desc":
    "Feriados o días puntuales en los que el gimnasio no abre. En esas fechas el registro de asistencia se deshabilita.",
  "staff.settings.closed_days_hint": "gimnasio cerrado ese día.",
  "portal.contact": "Contacto del gimnasio",
  "portal.plan_changes_blocked": "El gimnasio no permite cambios de plan",
  "portal.initial_payment_pending":
    "Todavía no podés usar las funciones del portal: tu alta está pendiente del pago inicial con el gimnasio.",
  "portal.pay_with_gym":
    "Para volver a utilizar las funciones del portal, regularizá tu pago con el gimnasio.",
  "portal.suspended_activity":
    "Esta actividad ha sido suspendida temporalmente por el gimnasio.",
  "portal.suspended_activity_hint":
    "Podés elegir otra actividad disponible o contactar al gimnasio",
  "portal.routine_cancelled": "Cancelado por el gimnasio",
  "portal.closed_today": "El gimnasio está cerrado hoy.",
  "portal.closed_today_tomorrow": "El gimnasio está cerrado hoy y mañana.",
  "portal.closed_today_until": "El gimnasio está cerrado hoy hasta el {fecha}.",
  "portal.closed_tomorrow": "El gimnasio estará cerrado mañana.",
  "portal.closed_single": "El gimnasio estará cerrado el {fecha}.",
  "portal.closed_range":
    "El gimnasio estará cerrado del {fecha1} al {fecha2}.",
  "checkin.regularize":
    "Regularizá el pago con el gimnasio para volver a utilizar esta función.",
  "attendance.closed_today":
    "El gimnasio está cerrado hoy. Hoy no se puede registrar asistencia.",
  "occupancy.closed_day": "Gimnasio cerrado este día",
  "install.banner_icon": "(verás el ícono del gimnasio).",
};

function interpolate(text, vars = {}) {
  return text.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match
  );
}

export function getGymLabels(gym) {
  return gym?.labels || DEFAULT_LABELS;
}

export function txt(gym, key, vars = undefined) {
  const labels = getGymLabels(gym);
  const text = labels[key] ?? DEFAULT_LABELS[key] ?? "";
  return vars ? interpolate(text, vars) : text;
}

export default txt;