"""Textos visibles del frontend configurados por gimnasio.

DEFAULT_LABELS conserva las cadenas actuales de la plataforma: cualquier
gimnasio sin overrides recibe exactamente el texto de hoy.

SINKRO_LABELS contiene las variantes que ese gimnasio pidió: evitar la palabra
"gimnasio" y usar "entrenamiento" (o reformular la frase cuando el sustantivo
no encaja). Los valores pueden usar placeholders {gym}, {fecha}, {fecha1} y
{fecha2}, que el frontend interpola.

get_gym_labels() devuelve siempre el diccionario completo mezclado.
"""

SINKRO_SLUGS = {"sinkro"}


DEFAULT_LABELS = {
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
    "staff.settings.closed_dates_desc": "Feriados o días puntuales en los que el gimnasio no abre. En esas fechas el registro de asistencia se deshabilita.",
    "staff.settings.closed_days_hint": "gimnasio cerrado ese día.",
    "portal.contact": "Contacto del gimnasio",
    "portal.plan_changes_blocked": "El gimnasio no permite cambios de plan",
    "portal.initial_payment_pending": "Todavía no podés usar las funciones del portal: tu alta está pendiente del pago inicial con el gimnasio.",
    "portal.pay_with_gym": "Para volver a utilizar las funciones del portal, regularizá tu pago con el gimnasio.",
    "portal.suspended_activity": "Esta actividad ha sido suspendida temporalmente por el gimnasio.",
    "portal.suspended_activity_hint": "Podés elegir otra actividad disponible o contactar al gimnasio",
    "portal.routine_cancelled": "Cancelado por el gimnasio",
    "portal.closed_today": "El gimnasio está cerrado hoy.",
    "portal.closed_today_tomorrow": "El gimnasio está cerrado hoy y mañana.",
    "portal.closed_today_until": "El gimnasio está cerrado hoy hasta el {fecha}.",
    "portal.closed_tomorrow": "El gimnasio estará cerrado mañana.",
    "portal.closed_single": "El gimnasio estará cerrado el {fecha}.",
    "portal.closed_range": "El gimnasio estará cerrado del {fecha1} al {fecha2}.",
    "checkin.regularize": "Regularizá el pago con el gimnasio para volver a utilizar esta función.",
    "attendance.closed_today": "El gimnasio está cerrado hoy. Hoy no se puede registrar asistencia.",
    "occupancy.closed_day": "Gimnasio cerrado este día",
    "install.banner_icon": "(verás el ícono del gimnasio).",
}

SINKRO_LABELS = {
    "register.title": "Registro al entrenamiento",
    "onboarding.step_label": "Entrenamiento",
    "onboarding.service_label": "Entrenamiento",
    "onboarding.service_desc": "Acceso al entrenamiento con plan y horarios propios",
    "onboarding.service_unavailable": "No disponible para este entrenamiento",
    "onboarding.plan_title": "Elegí tu plan de entrenamiento",
    "onboarding.schedule_hours": "Horarios de asistencia al entrenamiento",
    "onboarding.plan_label": "Plan de entrenamiento",
    "onboarding.activities_empty": "No hay actividades disponibles por ahora.",
    "member_form.entry_gym": "Entrenamiento",
    "staff.attendance.title": "Organización semanal",
    "staff.members.title": "Gestión de socios",
    "staff.payments.title": "Gestión de pagos",
    "staff.plans.title": "Gestión de planes",
    "staff.activities.title": "Gestión de actividades extra",
    "staff.activities.disabled": "El módulo de actividades extra no está habilitado.",
    "staff.activity_schedules.disabled": "Las actividades no están habilitadas.",
    "staff.staff.title": "Usuarios que pueden acceder al panel.",
    "staff.settings.basic_info": "Información básica.",
    "staff.settings.closed_dates_desc": "Feriados o días puntuales en los que no hay entrenamiento. En esas fechas el registro de asistencia se deshabilita.",
    "staff.settings.closed_days_hint": "sin entrenamiento ese día.",
    "portal.contact": "Contacto con {gym}",
    "portal.plan_changes_blocked": "Por ahora no podés cambiar de plan",
    "portal.initial_payment_pending": "Todavía no podés usar las funciones del portal: tu alta está pendiente del pago inicial.",
    "portal.pay_with_gym": "Para volver a utilizar las funciones del portal, regularizá tu saldo pendiente.",
    "portal.suspended_activity": "Esta actividad está suspendida temporalmente.",
    "portal.suspended_activity_hint": "Podés elegir otra actividad disponible.",
    "portal.routine_cancelled": "Cancelado",
    "portal.closed_today": "Hoy no hay entrenamiento.",
    "portal.closed_today_tomorrow": "Hoy y mañana no hay entrenamiento.",
    "portal.closed_today_until": "No hay entrenamiento hasta el {fecha}.",
    "portal.closed_tomorrow": "Mañana no hay entrenamiento.",
    "portal.closed_single": "El {fecha} no hay entrenamiento.",
    "portal.closed_range": "No hay entrenamiento del {fecha1} al {fecha2}.",
    "checkin.regularize": "Regularizá tu saldo pendiente para volver a utilizar esta función.",
    "attendance.closed_today": "Hoy no hay entrenamiento. No se puede registrar asistencia.",
    "occupancy.closed_day": "No hay entrenamiento este día",
    "install.banner_icon": "(verás el ícono).",
}


def _is_sinkro(gym):
    return (gym.slug or "").lower() in SINKRO_SLUGS or (
        gym.name or ""
    ).lower() in SINKRO_SLUGS


def get_gym_labels(gym):
    """Devuelve el diccionario completo de labels visibles para el gym."""
    labels = dict(DEFAULT_LABELS)
    if _is_sinkro(gym):
        labels.update(SINKRO_LABELS)
    return labels