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
    "staff.settings.closed_days_hint": "que el gimnasio está cerrado ese día.",
    "portal.contact": "Contacto del gimnasio",
    "portal.plan_changes_blocked": "El gimnasio no permite cambios de plan",
    "portal.initial_payment_pending": "Todavía no podés usar las funciones del portal: tu alta está pendiente del pago inicial con el gimnasio.",
    "portal.pay_with_gym": "Para volver a utilizar las funciones del portal, regularizá tu pago con el gimnasio.",
    "portal.renewal_skipped": "Tu suscripción del mes anterior quedó bloqueada por falta de pago y no se renovó. Regularizá tu saldo para recuperar tu plan.",
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
    "recovery.kind.training": "Gimnasio",
    "recovery.kind.activity": "Clase (actividad)",
    "staff.settings.google_seo": "Estos datos se usan para que tu gimnasio aparezca en Google al compartir tu link de registro. Completalos para mejorar tu posicionamiento local.",
    "staff.settings.email_placeholder": "Ej: info@gimnasio.com",
    "staff.settings.seo_title_placeholder": "Ej: Gimnasio Atlas | Musculación y CrossFit en Rosario",
    "staff.settings.seo_description_placeholder": "Ej: Sumate al mejor gimnasio de Rosario. Musculación, crossfit y clases guiadas con profesores certificados.",
    "staff.settings.keywords_placeholder": "Ej: gimnasio, musculación, crossfit, rosario",
    "staff.pt.clients_assignment": "Cuando el gimnasio te asigne clientes de entrenamiento personal, aparecerán acá.",
    "member.attachments.hint": "Mandale al gimnasio la orden de sesiones, el comprobante de pago o cualquier estudio que necesitemos ver (ej. electrocardiograma para natación).",
    "portal.pt_no_schedule": "Cuando el gimnasio te asigne un horario, aparecerá acá.",
    "portal.pt_pending_approval": "Esperando aprobación del gimnasio",
    "portal.pt_request_review": "El gimnasio revisará tu solicitud y confirmará el nuevo horario.",
    "portal.gym_closed_short": " · gym cerrado",
    "checkin.closed_today": "El gimnasio está cerrado hoy.",
    "features.activities_disabled": "Actividades no está habilitado para este gimnasio.",
    "features.pt_disabled": "Entrenamiento personal no está habilitado para este gimnasio.",
    "features.community_disabled": "Comunidad de descuentos no está habilitada para este gimnasio.",
    "features.salidas_disabled": "Running grupal no está habilitado para este gimnasio.",
    "errors.plan_changes_not_allowed": "El gimnasio no permite cambios de plan.",
    "errors.plan_not_in_gym": "El plan no pertenece a este gimnasio.",
    "errors.member_not_in_gym": "El socio no pertenece a este gimnasio.",
    "errors.activity_not_in_gym": "La actividad no pertenece a este gimnasio.",
    "errors.gym_closed_date": "El gimnasio está cerrado esa fecha.",
    "errors.gym_closed_date_swap": "El gimnasio está cerrado esa fecha. Elegí otro día de intercambio.",
    "errors.recovery_disabled": "El gimnasio no tiene habilitada la recuperación de clases.",
    "errors.slot_unavailable": "El horario seleccionado no está disponible: sin cupo, gimnasio cerrado o colisiona con una clase del socio.",
    "errors.swap_not_in_gym": "El intercambio no pertenece a este gimnasio.",
    "errors.schedule_not_in_gym": "El horario no pertenece a este gimnasio.",
    "errors.current_schedule_not_in_gym": "El horario actual no pertenece a este gimnasio.",
    "errors.requested_slot_not_in_gym": "El horario solicitado no pertenece a este gimnasio.",
    "errors.origin_schedule_not_in_gym": "El horario de origen no pertenece a este gimnasio.",
    "errors.destination_slot_not_in_gym": "El horario de destino no pertenece a este gimnasio.",
    "errors.perm_change_not_allowed": "El gimnasio no permite cambios permanentes de horario.",
    "errors.activity_schedule_not_same_gym": "El horario no pertenece al mismo gimnasio que la inscripción.",
    "errors.service_not_in_gym": "El servicio no pertenece a este gimnasio.",
    "errors.service_not_same_gym": "El servicio debe pertenecer al mismo gimnasio que el plan.",
    "errors.offer_not_in_gym": "La oferta no pertenece a este gimnasio.",
    "errors.trainer_not_in_gym": "El/la entrenador/a no pertenece a este gimnasio.",
    "errors.fixed_schedule_overlap": "El socio tiene un horario fijo del gimnasio que se superpone con el horario de esta actividad.",
    "errors.pt_fixed_schedule_overlap": "El socio tiene un horario fijo del gimnasio que se superpone con el horario del entrenamiento personal.",
    "errors.gym_schedule_overlap_detailed": "El horario del gimnasio {day} {time} se superpone con la actividad {activity} ({schedule}).",
    "errors.routine_template_not_in_gym": "La plantilla no pertenece a este gimnasio.",
    "errors.exercise_not_in_gym": "El ejercicio no pertenece a este gimnasio.",
    "errors.subscription_not_in_gym": "La suscripción no pertenece a este gimnasio.",
    "errors.enrollment_not_in_gym": "La inscripción no pertenece a este gimnasio.",
    "errors.pt_assignment_not_in_gym": "La asignación no pertenece a este gimnasio.",
    "errors.owner_only_settings": "Solo el dueño puede modificar la configuración.",
    "errors.owner_only_closed_dates": "Solo el dueño puede gestionar las fechas cerradas.",
    "errors.owner_only_staff": "Solo el dueño puede gestionar el staff.",
    "errors.owner_only_community": "Solo el dueño puede gestionar los locales adheridos.",
    "errors.cannot_remove_owner": "No se puede eliminar al dueño del gimnasio.",
    "staff.settings.closed_dates_desc": "Feriados o días puntuales en los que el gimnasio no abre. En esas fechas los socios no podrán registrar asistencia ni pedir intercambios, y el panel no mostrará actividad.",
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
    "staff.settings.closed_days_hint": "que ese día no hay entrenamiento.",
    "portal.contact": "Contacto con {gym}",
    "portal.plan_changes_blocked": "Por ahora no podés cambiar de plan",
    "portal.initial_payment_pending": "Todavía no podés usar las funciones del portal: tu alta está pendiente del pago inicial.",
    "portal.pay_with_gym": "Para volver a utilizar las funciones del portal, regularizá tu saldo pendiente.",
    "portal.renewal_skipped": "Tu suscripción del mes anterior quedó sin renovar por falta de pago. Regularizá tu saldo para recuperar tu entrenamiento.",
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
    "recovery.kind.training": "Entrenamiento",
    "recovery.kind.activity": "Clase (actividad)",
    "staff.settings.google_seo": "Estos datos se usan para que tu entrenamiento aparezca en Google al compartir tu link de registro. Completalos para mejorar tu posicionamiento local.",
    "staff.settings.email_placeholder": "Ej: info@entrenamiento.com",
    "staff.settings.seo_title_placeholder": "Ej: Entrenamiento Atlas | Musculación y CrossFit en Rosario",
    "staff.settings.seo_description_placeholder": "Ej: Sumate al mejor entrenamiento de Rosario. Musculación, crossfit y clases guiadas con profesores certificados.",
    "staff.settings.keywords_placeholder": "Ej: entrenamiento, musculación, crossfit, rosario",
    "staff.pt.clients_assignment": "Cuando el entrenamiento te asigne clientes de entrenamiento personal, aparecerán acá.",
    "member.attachments.hint": "Mandale al entrenamiento la orden de sesiones, el comprobante de pago o cualquier estudio que necesitemos ver (ej. electrocardiograma para natación).",
    "portal.pt_no_schedule": "Cuando el entrenamiento te asigne un horario, aparecerá acá.",
    "portal.pt_pending_approval": "Esperando aprobación del entrenamiento",
    "portal.pt_request_review": "El entrenamiento revisará tu solicitud y confirmará el nuevo horario.",
    "portal.gym_closed_short": " · sin entrenamiento",
    "checkin.closed_today": "Hoy no hay entrenamiento.",
    "features.activities_disabled": "Actividades no está habilitado para este entrenamiento.",
    "features.pt_disabled": "Entrenamiento personal no está habilitado para este entrenamiento.",
    "features.community_disabled": "Comunidad de descuentos no está habilitada para este entrenamiento.",
    "features.salidas_disabled": "Running grupal no está habilitado para este entrenamiento.",
    "errors.plan_changes_not_allowed": "El entrenamiento no permite cambios de plan.",
    "errors.plan_not_in_gym": "El plan no pertenece a este entrenamiento.",
    "errors.member_not_in_gym": "El socio no pertenece a este entrenamiento.",
    "errors.activity_not_in_gym": "La actividad no pertenece a este entrenamiento.",
    "errors.gym_closed_date": "Ese día no hay entrenamiento.",
    "errors.gym_closed_date_swap": "Ese día no hay entrenamiento. Elegí otro día de intercambio.",
    "errors.recovery_disabled": "El entrenamiento no tiene habilitada la recuperación de clases.",
    "errors.slot_unavailable": "El horario seleccionado no está disponible: sin cupo, sin entrenamiento o colisiona con una clase del socio.",
    "errors.swap_not_in_gym": "El intercambio no pertenece a este entrenamiento.",
    "errors.schedule_not_in_gym": "El horario no pertenece a este entrenamiento.",
    "errors.current_schedule_not_in_gym": "El horario actual no pertenece a este entrenamiento.",
    "errors.requested_slot_not_in_gym": "El horario solicitado no pertenece a este entrenamiento.",
    "errors.origin_schedule_not_in_gym": "El horario de origen no pertenece a este entrenamiento.",
    "errors.destination_slot_not_in_gym": "El horario de destino no pertenece a este entrenamiento.",
    "errors.perm_change_not_allowed": "El entrenamiento no permite cambios permanentes de horario.",
    "errors.activity_schedule_not_same_gym": "El horario no pertenece al mismo entrenamiento que la inscripción.",
    "errors.service_not_in_gym": "El servicio no pertenece a este entrenamiento.",
    "errors.service_not_same_gym": "El servicio debe pertenecer al mismo entrenamiento que el plan.",
    "errors.offer_not_in_gym": "La oferta no pertenece a este entrenamiento.",
    "errors.trainer_not_in_gym": "El/la entrenador/a no pertenece a este entrenamiento.",
    "errors.fixed_schedule_overlap": "El socio tiene un horario fijo del entrenamiento que se superpone con el horario de esta actividad.",
    "errors.pt_fixed_schedule_overlap": "El socio tiene un horario fijo del entrenamiento que se superpone con el horario del entrenamiento personal.",
    "errors.gym_schedule_overlap_detailed": "El horario del entrenamiento {day} {time} se superpone con la actividad {activity} ({schedule}).",
    "errors.routine_template_not_in_gym": "La plantilla no pertenece a este entrenamiento.",
    "errors.exercise_not_in_gym": "El ejercicio no pertenece a este entrenamiento.",
    "errors.subscription_not_in_gym": "La suscripción no pertenece a este entrenamiento.",
    "errors.enrollment_not_in_gym": "La inscripción no pertenece a este entrenamiento.",
    "errors.pt_assignment_not_in_gym": "La asignación no pertenece a este entrenamiento.",
    "errors.owner_only_settings": "Solo el dueño puede modificar la configuración.",
    "errors.owner_only_closed_dates": "Solo el dueño puede gestionar las fechas cerradas.",
    "errors.owner_only_staff": "Solo el dueño puede gestionar el staff.",
    "errors.owner_only_community": "Solo el dueño puede gestionar los locales adheridos.",
    "errors.cannot_remove_owner": "No se puede eliminar al dueño del entrenamiento.",
    "staff.settings.closed_dates_desc": "Feriados o días puntuales en los que no hay entrenamiento. En esas fechas los socios no podrán registrar asistencia ni pedir intercambios, y el panel no mostrará actividad.",
}


def _is_sinkro(gym):
    if gym is None:
        return False
    return (gym.slug or "").lower() in SINKRO_SLUGS or (
        gym.name or ""
    ).lower() in SINKRO_SLUGS


def get_gym_labels(gym):
    """Devuelve el diccionario completo de labels visibles para el gym."""
    labels = dict(DEFAULT_LABELS)
    if _is_sinkro(gym):
        labels.update(SINKRO_LABELS)
    return labels


def msg(gym, key):
    """Label para mensajes emitidos desde el backend (errores de API, etc.)."""
    if gym is None:
        return DEFAULT_LABELS.get(key, "")
    return get_gym_labels(gym).get(key, "")