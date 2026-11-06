# Auditoría de Miembros — Cómo funciona hoy la ficha del socio

> Verificado contra: `f5b4b07`
> Fecha: 2026-10-30
> Alcance: alta, ficha, portal, adjuntos, baja lógica (soft delete), reactivación, filtros y validaciones de socios. No cubre cobros ni asistencias salvo cuando impactan en la ficha.
> Documentos relacionados: `AUDITORIA-PAGOS.md`, `AUDITORIA-SUSCRIPCIONES.md`,
> `AUDITORIA-USUARIOS-Y-ACCESOS.md`, `AUDITORIA-RECUPERACION.md`
> Código cubierto: `backend/members`, `frontend/src/pages/Members.jsx`,
> `frontend/src/pages/Register.jsx`, `frontend/src/pages/member/MemberData.jsx`
> Estado: verificado

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Está pensado para servir de base a un manual para gimnasios, por eso está escrito
> en lenguaje simple. Las referencias de código van aparte, en letra chica, para
> no ensuciar el texto.

---

## 1. Qué es un socio y las dos formas de alta

Un **socio** (miembro) es la ficha de una persona dentro de un gimnasio. Cada socio
pertenece a un gimnasio y tiene un estado comercial (plan, cuota, deuda) que se
administra desde las pantallas del staff.

Hay **dos caminos** para dar de alta a un socio:

1. **Alta por el staff.** El personal del gimnasio carga la ficha desde la pantalla
   de Miembros y elige los servicios (gimnasio y/o actividades), el plan y los
   horarios. Es el camino completo: puede otorgar cortesía y descuento.
2. **Auto-registro público.** El gimnasio comparte un **link público de inscripción**
   (armado con su `onboarding_code`) y la persona se anota sola. El sistema reutiliza
   exactamente las mismas reglas que el alta del staff (plan requerido, cupos,
   choques de horario), pero **no le permite auto-asignarse privilegios**: la
   cortesía (`is_comp`) se fuerza en `False` y cualquier descuento que venga en el
   formulario se descarta. Solo el staff puede otorgarlos después del alta.

En ambos casos, **quién elige los servicios define el "modo de ingreso" (`entry_mode`)**:

- **GYM** — la persona eligió gimnasio (horarios de sala). Exige un plan de
  membresía y al menos un horario de gimnasio.
- **ACTIVITY_ONLY** — solo eligió actividades, sin gimnasio.

### Referencia
- Servicio de alta: `backend/members/services.py · RegistrationService.register`.
- Alta staff: `backend/members/views.py · MemberViewSet.create`.
- Auto-registro público: `backend/members/public_views.py · PublicRegisterView`
  (link por `onboarding_code`).
- Privilegios forzados en el público:
  `backend/members/public_views.py · PublicRegisterView._onboarding_register`
  (`is_comp=False`, `discount_id` descartado).
- `entry_mode`: `backend/members/views.py · MemberViewSet.create` y
  `backend/members/public_views.py · PublicRegisterView._onboarding_register`
  (`GYM` / `ACTIVITY_ONLY`).
- Exige ≥1 horario de gimnasio:
  `backend/members/views.py · MemberViewSet.create` y
  `backend/members/public_views.py · PublicRegisterView._onboarding_register`.

---

## 2. Los datos de la ficha

Estos son los campos del socio y las reglas que arrastran:

- **Nombre y apellido** — obligatorios.
- **Teléfono** — obligatorio y **único dentro del gimnasio**: no puede haber dos
  socios con el mismo teléfono en el mismo gimnasio. Se valida tanto en el alta como
  al editar (y desde el portal del socio).
- **WhatsApp** — opcional, texto libre (puede ser distinto del teléfono).
- **Email** — opcional. **No es único**: pueden repetirse.
- **Nº de documento** — opcional. **No es único**: pueden repetirse.
- **Fecha de nacimiento** — opcional; no puede ser futura.
- **Obra social / seguro médico (`health_insurance`)** — texto libre. Además, el
  sistema puede **enlazar automáticamente** una obra social configurada del gimnasio
  cuando el nombre coincide (ignorando mayúsculas, acentos y espacios), para no
  depender de typos como "IaPOZ" vs "IAPOS". Si esa obra social tiene precio por
  sesión, ese precio se usa para el coseguro.
- **Nº de afiliado** — opcional, **manual**: el sistema no lo genera ni lo completa solo.
- **Dirección** — opcional.
- **Descuento** — opcional. Es un FK a un descuento configurado por el gimnasio; se
  aplica sobre el total mensual (plan + actividades).
- **Pase de cortesía (`is_comp`)** — socio de cortesía: no se le cobra la membresía,
  todo se factura en $0 y **nunca se lo bloquea por falta de pago**.
- **Foto** — opcional; se guarda en Cloudinary.
- **Activo (`active`)** — el alta siempre arranca activo. Está **protegido (read-only)
  en la API**: no se cambia desde el formulario de la ficha.
- **Nº de socio / ficha** — **no existe un generador de código de socio**. El
  `affiliate_number` es el único identificador afiliatorio y se carga a mano.

### Referencia
- Campos del modelo: `backend/members/models.py · Member` (incluye `phone`,
  `health_insurance`, `insurance`, `affiliate_number`, `discount`, `is_comp`,
  `photo`, `active`).
- Teléfono único por gimnasio:
  `backend/members/serializers.py · MemberSerializer.validate_phone` y la
  constraint `unique_member_phone_per_gym` en `backend/members/models.py · Member`.
- Sin unicidad en email/documento: no hay `unique=True` en el modelo.
- Enlace automático de obra social:
  `backend/members/serializers.py · MemberSerializer._autolink_insurance`.
- Fecha de nacimiento no futura:
  `backend/members/serializers.py · MemberSerializer.validate_date_of_birth`.
- `active` read-only en el staff:
  `backend/members/serializers.py · MemberSerializer.Meta`
  (`read_only_fields = ["gym", "active", "deleted_at"]`) y en el público
  `backend/members/serializers.py · PublicMemberSerializer.Meta`.

---

## 3. Qué pasa cuando se da de alta

Cuando se registra un socio, el sistema **crea varias cosas juntas, en una sola
operación indivisible (atómica)**. Si algo falla, no queda nada a medias: se deshace
todo.

Lo que crea el alta:

1. **La ficha** del socio.
2. **La suscripción y el plan** elegido (arranca hoy y termina el último día del mes).
3. **Las inscripciones a actividades** de los horarios elegidos (sin re-chequear el
   pago, porque es parte del alta).
4. **Los horarios de gimnasio** de la sala.

Casos especiales según qué se eligió:

- **Con gimnasio y plan:** se abre la suscripción del plan elegido. Si no se elige
  plan, el sistema lo rechaza (salvo cortesía).
- **Solo actividades (sin gimnasio):** se abre una suscripción con el **plan base**
  (sin cargo), y solo se crean las inscripciones a actividades.
- **Cortesía (`is_comp`):** se abre una suscripción con el **plan base**, **pagada y
  con renovación automática**, facturada en $0.
- **Solo gimnasio, sin pago:** si no hay plan, no se crea suscripción hasta que el
  staff elija uno.

Importante: el alta **NO crea entrenamiento personal ni inscripciones a salidas**.
Esos servicios se suman después, por sus propios flujos.

### Referencia
- Orquestación atómica: `backend/members/services.py · RegistrationService.register`
  (`transaction.atomic` y creación de ficha, suscripción, actividades y horarios).
- Regla "gimnasio exige plan":
  `backend/members/services.py · RegistrationService.register`.
- Suscripción del plan elegido:
  `backend/members/services.py · RegistrationService.register`.
- Cortesía → plan base pagado:
  `backend/members/services.py · RegistrationService.register`.
- Solo actividades → plan base:
  `backend/members/services.py · RegistrationService.register`.
- Inscripciones a actividades (saltean elegibilidad):
  `backend/members/services.py · RegistrationService.register`
  (`skip_eligibility_check=True`).
- Horarios de gimnasio:
  `backend/members/services.py · RegistrationService.register`.
- **No** crea PT ni salidas: no hay llamadas a esos servicios en `register`
  (`backend/members/services.py · RegistrationService.register`).
- Validación de plan (no puede ser el plan base):
  `backend/members/views.py · MemberViewSet.create`,
  `backend/members/public_views.py · PublicRegisterView._onboarding_register` y
  `backend/members/serializers.py · MemberSerializer.validate_plan_id`.

---

## 4. El portal del socio y su enlace mágico

Cada socio tiene un **enlace mágico** para entrar a su portal sin usuario ni
contraseña: es una URL con un **token** único. Con ese token el socio ve su rutina,
su estado de pago, sus adjuntos, sus actividades, etc.

- **El token se genera solo** al crear el socio.
- **Vence a los 30 días** (configurable con `MEMBER_ACCESS_TOKEN_TTL_DAYS`). Cuando
  vence, al leer sus datos el sistema **rota** el token: emite uno nuevo y devuelve
  el anterior como "token previo" por si había links ya compartidos.
- **La rotación conserva una generación**: el token anterior se sigue aceptando
  brevemente para no romper links ya impresos o enviados.
- Algunos endpoints del portal exigen el **token vigente** (adjuntos, foto,
  check-in): al rotar, el token anterior deja de servir para esos casos.

Qué puede hacer el socio en su portal:

- **Ver** su rutina, su estado (incluido el motivo del bloqueo y cuánto debe), sus
  pagos, su comunidad y sus adjuntos.
- **Editar** sus propios datos: nombre, apellido, whatsapp, teléfono, email,
  dirección, fecha de nacimiento y nº de documento.
- **Subir su comprobante de pago** aunque esté suspendido (es la vía para destrabar
  el acceso).
- **Cambiar su foto.**

Qué NO puede hacer (campos protegidos / bloqueados):

- **Editar** `entry_mode`, `active` ni `photo` por la vía de "datos": esos campos
  quedan read-only (la foto tiene su propio endpoint).
- **Operar** si está bloqueado por falta de pago: cualquier acción devuelve
  **"Acceso suspendido por falta de pago."** (403). El bloqueo lo decide una única
  función de elegibilidad.
- La cortesía (`is_comp`) nunca se bloquea.

### Referencia
- Generación automática del token: `backend/members/models.py · Member.save`.
- TTL: `backend/config/settings.py` (`MEMBER_ACCESS_TOKEN_TTL_DAYS`, default 30).
- Rotación conservando el previo:
  `backend/members/models.py · Member.rotate_access_token` y
  `backend/members/models.py · Member.maybe_rotate_access_token`.
- Resolución del token (acepta el previo):
  `backend/members/models.py · resolve_public_portal_member`; endpoints de
  "token vigente" en el docstring.
- Datos del portal (GET/PATCH, 403 por pago):
  `backend/members/views.py · PublicMemberDataView`.
- Campos editables y read-only del portal:
  `backend/members/serializers.py · PublicMemberDataSerializer`
  (`read_only_fields` incluye `entry_mode`, `active`, `photo`).
- Foto: `backend/members/views.py · PublicMemberPhotoView`.
- Gate único de elegibilidad: `backend/members/eligibility.py · MemberEligibility`
  (`can_operate` / `block_reason`; `is_comp` exento).

---

## 5. Los adjuntos del socio

El socio puede **subir archivos** (fotos o PDFs) a su ficha. Sirven, por ejemplo, para
mandar una orden médica o un comprobante de transferencia.

- **Categorías:** Orden médica / sesiones, Comprobante de pago, Electrocardiograma /
  estudios, y Otro.
- **La subida y la lista NO se bloquean por falta de pago** — a propósito, porque
  subir el comprobante es justamente lo que permite destrabar el acceso.
- Cada adjunto tiene una **nota** opcional (ej. nombre del titular de la transferencia).
- **El staff lo revisa** y puede marcarlo como revisado.
- El socio puede **borrar** un adjunto **solo mientras no fue revisado**. Una vez
  revisado, ya no puede eliminarlo.
- Al borrar un adjunto, el archivo se limpia también de Cloudinary.

### Referencia
- Categorías: `backend/members/models.py · MemberAttachment.Category`.
- Listar/subir sin bloqueo por pago:
  `backend/members/public_views.py · PublicMemberAttachmentListView`.
- Borrar solo si no fue revisado:
  `backend/members/public_views.py · PublicMemberAttachmentDetailView`.
- Revisión del staff: `backend/members/views.py · MemberAttachmentViewSet.review`.
- Limpieza en Cloudinary: `backend/members/models.py · MemberAttachment` y señal
  `backend/members/models.py · _member_attachment_post_delete` (`post_delete`).

---

## 6. Editar a un socio

El staff puede **editar la ficha** (update/PATCH) desde la pantalla de Miembros. Al
guardar:

- Se actualizan los datos de la ficha (con las mismas validaciones del alta, como el
  teléfono único por gimnasio).
- Si se mandan **horarios de gimnasio**, el sistema los **sincroniza** con la
  suscripción vigente.
- **Convertir o quitar la cortesía** es una transición especial:
  - **Poner cortesía:** el dominio reescribe la membresía del socio como cortesía
    (todo en $0).
  - **Quitar cortesía:** hay que elegir un **plan de membresía pago**; si no se elige,
    el sistema rechaza el cambio (salvo socios "solo actividades", que vuelven al plan
    base sin cargo).
- Toda esta transición se hace de forma **atómica**.

### Referencia
- Update y transición de cortesía:
  `backend/members/serializers.py · MemberSerializer.update` (persiste `is_comp`
  antes de `mutate_membership`).
- Elección de plan al quitar cortesía:
  `backend/members/serializers.py · MemberSerializer._resolve_plan_for_comp_off`.
- Sincronización de horarios:
  `backend/members/serializers.py · MemberSerializer.update`.

---

## 7. Dar de baja vs. recuperar

Son dos cosas **completamente distintas**:

- **Dar de baja un socio** es una **baja lógica (soft delete)**: la ficha no se borra. `Member.soft_delete()` marca `deleted_at`, pone `active=False`, guarda y **apaga `auto_renew=True`** en las suscripciones vigentes del socio. El socio desaparece de los listados operativos por defecto (`AliveMemberManager` filtra `deleted_at__isnull=True`). Sus suscripciones, asistencias, inscripciones y adjuntos no se borran.
- **Reactivar un socio** vuelve a poner `deleted_at = NULL` y `active = True` vía `Member.reactivate()`. Antes de reactivar: (1) solo funciona si está dado de baja; (2) valida que no exista otro socio activo con el mismo teléfono en el gimnasio (400 si hay conflicto); (3) valida capacidades/horarios con `members.reactivation.validate_reactivation_capacity()` (revisa cupos en gimnasio/actividades/salidas/PT) y devuelve 400 con `conflicts` si hay problemas; (4) también se protege con `IntegrityError` por restricción única de teléfono. **No vuelve a encender `auto_renew`** automáticamente. No crea un ciclo de cobro nuevo.
- **Recuperar un socio/suscripción** es otro flujo: **no reactiva la ficha por sí solo**, es un flujo de cobros/recuperación de suscripción. Se explica en `AUDITORIA-RECUPERACION.md`.

### Referencia
- Baja lógica: `backend/members/views.py · MemberViewSet.deactivate`, `backend/members/models.py · Member.soft_delete`.
- Reactivación: `backend/members/views.py · MemberViewSet.reactivate`, `backend/members/models.py · Member.reactivate`.
- Validación reactivación: `backend/members/reactivation.py · validate_reactivation_capacity`.
- Filtro de socios vivos: `backend/members/models.py · AliveMemberManager`, `backend/members/models.py · MemberQuerySet.alive`.
- Admin: `backend/members/admin.py · deactivate_members`, `backend/members/admin.py · reactivate_members`.
- Tests: `backend/members/tests_phase_k6.py`.
- Advertencia en UI: `frontend/src/pages/Members.jsx · Members`.
- Pagos con socio en blanco: `backend/payments/models.py · Payment` (`member = SET_NULL`).

---

## 8. Lo que el sistema NO hace hoy (para no prometerlo en el manual)

- **No borra la ficha al dar de baja**: la baja es lógica (soft delete); la ficha queda archivada con `deleted_at` y se puede reactivar. La recuperación de la suscripción es otro flujo de cobros.
- **No genera un código/número de socio**: el `affiliate_number` se carga a mano.
- **No impide repetir email ni documento**: solo el teléfono es único por gimnasio.
- **No permite al socio auto-darse cortesía ni descuento** desde el link público.
- **No crea entrenamiento personal ni salidas en el alta**: se suman por sus flujos.
- **No envía el link mágico por email/WhatsApp**: el gimnasio lo comparte a mano.
- **No tiene login con usuario/contraseña para el socio**: solo el enlace con token.
- **No permite al socio editar** su modo de ingreso, su estado activo ni su foto por
  la vía de datos.
- **No bloquea la subida de adjuntos por falta de pago** (a propósito).
- **No avisa al socio** cuando el staff marca un adjunto como revisado.
- **No valida el documento** contra ningún padrón ni formato especial.

---

## 9. Problemas que pueden pasar

- **El link público fuerza `is_comp=False` y descarta el descuento**, pero si el
  formulario venía con esos campos no se avisa: el dato simplemente se ignora.
- **La rotación de token conserva solo una generación anterior**. Un link muy viejo
  (dos rotaciones atrás) deja de funcionar, y los endpoints de foto/adjuntos/check-in
  cortan apenas rota.
- **El teléfono único por gimnasio** puede frenar un alta legítima si dos personas
  comparten un mismo teléfono (ej. una familia).
- **La baja lógica no borra datos**: la ficha queda archivada con `deleted_at`/`active=False` y puede reactivarse; `auto_renew` se apaga al dar de baja y no se reactiva automáticamente. El borrado real ya no está expuesto desde la API del staff.
- **`is_recoverable` (lectura) no coincide del todo con `recover_member`** (acción):
  la lista puede mostrar un socio como recuperable y luego rechazar la recuperación.
- **Quitar la cortesía exige elegir un plan pago**: si el staff no lo elige, el cambio
  falla (salvo socios "solo actividades").
- **El enlace automático de obra social** depende de que el nombre coincida con una
  obra social configurada; si no coincide, queda como texto libre sin precio asociado.

---

### Notas de entorno para leer el código
- Zona horaria: `America/Argentina/Buenos_Aires` (`backend/config/settings.py`).
- Toda consulta del staff se filtra automáticamente por el gimnasio del usuario
  logueado (`backend/core/mixins.py · GymQuerysetMixin`).
- La lógica de "puede operar" vive en un solo lugar:
  `backend/members/eligibility.py · MemberEligibility`; toda operación del socio
  debería pasar por ahí.
- El flujo visual equivalente de este documento está en
  `frontend/src/dev/MembersFlow.jsx` (página solo-dev).
