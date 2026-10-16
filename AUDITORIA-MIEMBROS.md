# Auditoría de Miembros — Cómo funciona hoy la ficha del socio

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
- Servicio de alta: `backend/members/services.py:101-208` (`RegistrationService.register`).
- Alta staff: `backend/members/views.py:83-218` (`MemberViewSet.create`).
- Auto-registro público: `backend/members/public_views.py:31-212` (`PublicRegisterView`,
  link por `onboarding_code`).
- Privilegios forzados en el público: `backend/members/public_views.py:168-173`
  (`is_comp=False`, `discount_id` descartado).
- `entry_mode`: `backend/members/views.py:107` y `backend/members/public_views.py:82`
  (`GYM` / `ACTIVITY_ONLY`).
- Exige ≥1 horario de gimnasio: `backend/members/views.py:119-123` y
  `backend/members/public_views.py:95-99`.

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
- Campos del modelo: `backend/members/models.py:75-228` (incluye `phone:110-113`,
  `health_insurance:138-142`, `insurance:157-165`, `affiliate_number:144-148`,
  `discount:212-223`, `is_comp:203-210`, `photo:104-108`, `active:198-201`).
- Teléfono único por gimnasio: `backend/members/serializers.py:481-511` (`validate_phone`).
- Sin unicidad en email/documento: no hay `unique=True` en el modelo.
- Enlace automático de obra social: `backend/members/serializers.py:531-558`
  (`_autolink_insurance`).
- Fecha de nacimiento no futura: `backend/members/serializers.py:560-565`.
- `active` read-only en el staff: `backend/members/serializers.py:161`
  (`read_only_fields = ["gym", "active"]`) y en el público
  `backend/members/serializers.py:717`.

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
- Orquestación atómica: `backend/members/services.py:143` (`transaction.atomic`) y
  `:144-206` (creación de ficha, suscripción, actividades y horarios).
- Regla "gimnasio exige plan": `backend/members/services.py:137-141`.
- Suscripción del plan elegido: `backend/members/services.py:148-157`.
- Cortesía → plan base pagado: `backend/members/services.py:159-170`.
- Solo actividades → plan base: `backend/members/services.py:172-182`.
- Inscripciones a actividades (saltean elegibilidad): `backend/members/services.py:184-196`
  (`skip_eligibility_check=True`).
- Horarios de gimnasio: `backend/members/services.py:198-206`.
- **No** crea PT ni salidas: no hay llamadas a esos servicios en `register`
  (`backend/members/services.py:101-208`).
- Validación de plan (no puede ser el plan base): `backend/members/views.py:193-200`,
  `backend/members/public_views.py:181-188` y `backend/members/serializers.py:470-479`.

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
- Generación automática del token: `backend/members/models.py:234-243` (`save`).
- TTL: `backend/config/settings.py:103-105` (`MEMBER_ACCESS_TOKEN_TTL_DAYS`, default 30).
- Rotación conservando el previo: `backend/members/models.py:257-280`
  (`rotate_access_token`, `maybe_rotate_access_token`).
- Resolución del token (acepta el previo): `backend/members/models.py:289-306`
  (`resolve_public_portal_member`); endpoints de "token vigente" en el docstring.
- Datos del portal (GET/PATCH, 403 por pago): `backend/members/views.py:320-372`.
- Campos editables y read-only del portal: `backend/members/serializers.py:744-773`
  (`PublicMemberDataSerializer`, `read_only_fields` incluye `entry_mode`, `active`, `photo`).
- Foto: `backend/members/views.py:375-405` (`PublicMemberPhotoView`).
- Gate único de elegibilidad: `backend/members/eligibility.py:31-77`
  (`can_operate` / `block_reason`; `is_comp` exento en `:65-66`).

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
- Categorías: `backend/members/models.py:309-314` (`MemberAttachment.Category`).
- Listar/subir sin bloqueo por pago: `backend/members/public_views.py:269-316`.
- Borrar solo si no fue revisado: `backend/members/public_views.py:333-349`.
- Revisión del staff: `backend/members/views.py:436-455` (acción `review`).
- Limpieza en Cloudinary: `backend/members/models.py:364-379` y señal
  `:381-383` (`post_delete`).

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
- Update y transición de cortesía: `backend/members/serializers.py:609-652`
  (`MemberSerializer.update`); persistir `is_comp` antes de `mutate_membership`
  en `:627-641`.
- Elección de plan al quitar cortesía: `backend/members/serializers.py:684-710`
  (`_resolve_plan_for_comp_off`).
- Sincronización de horarios: `backend/members/serializers.py:643-651`.

---

## 7. Eliminar vs. recuperar

Son dos cosas **completamente distintas**:

- **Eliminar un socio** es un **borrado real (hard delete)**, sin vuelta atrás. No
  existe "dar de baja" ni "archivar": el botón Eliminar borra la ficha y, en cascada,
  sus suscripciones, asistencias, inscripciones a actividades y adjuntos (limpiando
  Cloudinary). Los pagos que tenía **no se borran**: quedan con el socio en blanco
  (`SET_NULL`). La UI lo advierte con "Esta acción no se puede deshacer".
- **Recuperar un socio** es otra cosa: **no reactiva la ficha**, sino que **reabre su
  suscripción**. Es un flujo de cobros (no de miembros) y se explica en la Auditoría
  de Pagos, §6. Solo aplica si el socio **no tiene deuda pendiente**; abre un ciclo
  nuevo desde hoy hasta fin de mes, pendiente de pago.

**No existe un endpoint de "reactivar socio"** ni una baja lógica de la ficha.

### Referencia
- Borrado real: `MemberViewSet` no sobreescribe `destroy`
  (`backend/members/views.py:83-455`), por lo que el DELETE de `ModelViewSet` borra en
  cascada. Advertencia en UI: `frontend/src/pages/Members.jsx:960-964`.
- Pagos con socio en blanco: `backend/payments/models.py` (`member = SET_NULL`).
- Recuperar suscripción: `backend/subscriptions/services.py:1333-1410` (`recover_member`).
- "Es recuperable" en la lista de socios: `backend/members/serializers.py:258-410`
  (`is_recoverable`) — ojo, tiene un desajuste conocido con `recover_member`,
  ya señalado en el flujo de suscripciones.
- Detalle del flujo de recuperación: `AUDITORIA-PAGOS.md` §6.

---

## 8. Lo que el sistema NO hace hoy (para no prometerlo en el manual)

- **No tiene "dar de baja" ni "reactivar socio"**: solo existe borrado real y, aparte,
  la recuperación de la suscripción (que es de cobros).
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
- **El borrado es real y en cascada**: eliminar una ficha se lleva suscripciones,
  asistencias, inscripciones y adjuntos, sin papelera.
- **`is_recoverable` (lectura) no coincide del todo con `recover_member`** (acción):
  la lista puede mostrar un socio como recuperable y luego rechazar la recuperación.
- **Quitar la cortesía exige elegir un plan pago**: si el staff no lo elige, el cambio
  falla (salvo socios "solo actividades").
- **El enlace automático de obra social** depende de que el nombre coincida con una
  obra social configurada; si no coincide, queda como texto libre sin precio asociado.

---

### Notas de entorno para leer el código
- Zona horaria: `America/Argentina/Buenos_Aires` (`backend/config/settings.py:461`).
- Toda consulta del staff se filtra automáticamente por el gimnasio del usuario
  logueado (`backend/core/mixins.py:4-19`).
- La lógica de "puede operar" vive en un solo lugar:
  `backend/members/eligibility.py:31-77`; toda operación del socio debería pasar por ahí.
- El flujo visual equivalente de este documento está en
  `frontend/src/dev/MembersFlow.jsx` (página solo-dev).
