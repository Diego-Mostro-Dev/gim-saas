# Plan completo — Actualización de auditorías contra el código

## 1. Objetivo

Dejar las auditorías descriptivas alineadas con el código actual, de modo que sirvan como **base confiable del estado real del sistema**: qué hace hoy, qué no hace, qué reglas aplica y dónde vive cada cosa.

Alcance:

- Actualizar **in-place** las 13 auditorías existentes.
- Crear **5 auditorías nuevas** para módulos sin cobertura.
- Crear un **índice general** de auditorías.
- No modificar código de producto.
- No convertir las auditorías en un registro de bugs: los bugs siguen en `BUGS.md`.

Baseline inicial: commit **`f5b4b07`** (29/10/2026), rama actual. Fecha de verificación: **30/10/2026**.

---

## 2. Estado inicial detectado

- 13 archivos `AUDITORIA-*.md`, ~3.588 líneas y ~630 referencias a código.
- La mayoría se escribió antes de las fases A–K; el código cambió después.
- Desfasajes concretos:
  - `AUDITORIA-MIEMBROS.md` afirma que no existe baja lógica ni reactivación; hoy existen `Member.deleted_at`, `deactivate` y `reactivate`.
  - `AUDITORIA-CONFIGURACION.md` salta de la sección 2 a la 19: está incompleta.
  - Pagos y suscripciones no reflejan prorrateo, crédito, invariantes de dinero ni la eliminación del fallback de precio.
  - Actividades, salidas y PT no reflejan auto-desactivación, solapes compartidos ni los cambios de no-show/recuperaciones.
  - Hay 2 rutas inexistentes y 3 referencias con líneas fuera de rango.
- Módulos sin auditoría: `accounts`, `profiles`, `admins`, `core`, `seed` y operaciones/despliegue.

---

## 3. Convenciones de las auditorías

### Cabecera obligatoria

Cada documento empieza con:

```text
Verificado contra: <commit>
Fecha: <fecha>
Alcance: <qué cubre y qué no>
Documentos relacionados: <enlaces>
```

### Referencias híbridas

Referencia canónica por archivo y símbolo:

```text
backend/members/services.py · RegistrationService.register
frontend/src/pages/Members.jsx · MemberList
```

Opcionalmente, snapshot de líneas al final del documento:

```text
backend/members/services.py:101-208 (al commit f5b4b07)
```

Reglas:

- El símbolo es la referencia principal.
- La línea exacta solo se usa como dato histórico.
- Si no hay símbolo estable, se referencia archivo + sección funcional.
- No se mezclan líneas antiguas con símbolos nuevos.

### Contenido

Cada auditoría mantiene estas secciones:

1. Qué es y para qué sirve.
2. Cómo funciona hoy, en lenguaje simple.
3. Reglas y casos borde.
4. Qué ve cada rol / pantalla.
5. Lo que el sistema NO hace hoy.
6. Problemas o decisiones de negocio vigentes.
7. Referencias técnicas.
8. Snapshot de referencias, si aplica.

### Límites

- `AUDITORIA-*.md`: describe comportamiento actual.
- `BUGS.md`: registra defectos, severidad y estado.
- `PLAN-bugs.md`: plan de corrección.
- Si una auditoría detecta un bug nuevo, se documenta como problema y se propone su alta en `BUGS.md`; no se arregla código en esta tarea.
- Las decisiones de negocio se marcan como tales, no como bugs.

---

## 4. Documentos incluidos

### Existentes a actualizar

| Documento | Código principal | Pantallas / flujos |
|---|---|---|
| `AUDITORIA-MIEMBROS.md` | `backend/members` | Members, Register, MemberData, MemberAttachments |
| `AUDITORIA-PLANES.md` | `backend/plans` | Plans, PlanForm, PlanChangeModal |
| `AUDITORIA-SUSCRIPCIONES.md` | `backend/subscriptions` | Subscriptions, MemberSubscriptionCard |
| `AUDITORIA-PAGOS.md` | `backend/payments`, `subscriptions` | Payments, MemberPayments |
| `AUDITORIA-RECUPERACION.md` | `subscriptions`, `attendance/recovery_service` | RecoverMembers |
| `AUDITORIA-ASISTENCIAS.md` | `backend/attendance` | Attendance, Checkin, AttendanceQR |
| `AUDITORIA-HORARIOS.md` | `attendance`, `gyms`, schedule requests | ScheduleChangeRequests, ScheduleSwapRequests |
| `AUDITORIA-ACTIVIDADES.md` | `backend/activities` | Activities, ActivitySchedules, MemberActivities |
| `AUDITORIA-SALIDAS.md` | `backend/outings` | Outings, OutingSchedules, OutingEnrollments |
| `AUDITORIA-PERSONAL-TRAINING.md` | `backend/personal_training` | PT Settings, Attendance, TrainerAgenda, MemberPT |
| `AUDITORIA-RUTINAS.md` | `backend/routines` | Routines, PublicRoutine, MemberWorkout |
| `AUDITORIA-COMUNIDAD.md` | `backend/community` | CommunityPanel, CommunityPublicPage, MemberCommunity |
| `AUDITORIA-CONFIGURACION.md` | `backend/gyms`, `config` | Settings, admin de gimnasio |

### Nuevas auditorías

| Documento | Código principal | Contenido |
|---|---|---|
| `AUDITORIA-USUARIOS-Y-ACCESOS.md` | `accounts`, `profiles`, `core/permissions` | Login, logout, refresh, tokens, contraseñas, onboarding de dueño, roles, permisos |
| `AUDITORIA-ADMIN-SAAS.md` | `admins` | Superusuario central, alta de gimnasios, features, configuración inicial, scoping |
| `AUDITORIA-NUCLEO-REGLAS.md` | `core` | Scoping por gym, permisos, solapes, horarios, emails, invariantes de dinero/sesiones, helpers de test |
| `AUDITORIA-SEED-DEMO.md` | `seed` | Datos demo, fases de seed, aislamiento, `force`, `preserve_plans`, invariantes |
| `AUDITORIA-OPERACIONES.md` | `config`, `.github`, `scripts` | Settings, entorno, CI, tareas programadas, backups/restore, monitoreo y despliegue |

### Documento de índice

| Documento | Contenido |
|---|---|
| `AUDITORIA-INDEX.md` | Tabla de las 18 auditorías, alcance, código cubierto, documentos relacionados, commit y fecha de verificación |

---

## 5. Fases de ejecución

### Fase 0 — Baseline, método e índice inicial

Objetivo: congelar el estado de referencia y dejar listo el andamiaje.

Tareas:

1. Registrar baseline: `f5b4b07`, fecha, rama y alcance.
2. Construir mapa `auditoría → app → endpoints → pantallas → tests`.
3. Crear la plantilla común de auditoría.
4. Definir el formato híbrido de referencias.
5. Crear el borrador de `AUDITORIA-INDEX.md`.
6. Diseñar el validador de referencias:
   - verifica que el archivo exista;
   - verifica que el símbolo aparezca;
   - verifica rangos de línea del snapshot;
   - falla ante referencias canónicas rotas y avisa sobre líneas desactualizadas.
7. Aplicar la plantilla a un documento piloto, preferentemente `AUDITORIA-MIEMBROS.md`.

Entregables:

- Plantilla aprobada.
- Mapa de cobertura.
- `AUDITORIA-INDEX.md` inicial.
- Validador de referencias.
- Documento piloto actualizado.

Criterio de cierre:

- El piloto pasa el validador.
- El índice lista las 18 auditorías.
- La plantilla no deja dudas sobre formato, alcance y referencias.

---

### Fase 1 — Identidad y administración

Documentos:

- `AUDITORIA-USUARIOS-Y-ACCESOS.md`
- `AUDITORIA-ADMIN-SAAS.md`

Tareas:

1. Documentar login, logout, refresh y `/me`.
2. Documentar expiración y rotación de token.
3. Documentar cambio de contraseña, reseteo con token y código de 6 dígitos, y reset administrativo.
4. Documentar onboarding de dueño y creación de gimnasio desde alta pública.
5. Documentar roles `owner`, `staff`, `professor`, `trainer`.
6. Documentar `must_change_password`, perfil, gimnasio y género del trainer.
7. Documentar permisos: superusuario, dueño, gestor de rutinas y scoping por gimnasio.
8. Documentar el panel central: listar/crear/editar gimnasios, features, servicios y planes iniciales.
9. Revisar frontend: Login, ForgotPassword, ResetPassword, ChangePassword, Staff, onboarding y páginas admin.
10. Cruzar con `accounts/tests.py`, `profiles/tests.py`, `admins/tests.py` y `core/tests_admin_scoping.py`.

Criterio de cierre:

- Ambos documentos completos y con referencias híbridas válidas.
- Tests `accounts`, `profiles`, `admins` y `core` verdes.

---

### Fase 2 — Núcleo, seed y operaciones

Documentos:

- `AUDITORIA-NUCLEO-REGLAS.md`
- `AUDITORIA-SEED-DEMO.md`
- `AUDITORIA-OPERACIONES.md`

Tareas:

1. Documentar `GymQuerysetMixin` y el filtrado automático por gimnasio.
2. Documentar `BillingPriceMixin` y las reglas de precio de ofertas.
3. Documentar `core/overlap.py`: solapes entre gimnasio, actividades, salidas y PT.
4. Documentar `core/times.py`: duración real de bloques y cálculo de fin.
5. Documentar `core/permissions.py`: superusuario, dueño y gestor de rutinas.
6. Documentar `core/email.py` y plantillas de reseteo.
7. Documentar invariantes de dinero y sesiones.
8. Documentar helpers de test y admin scoping.
9. Documentar seed: fases, datos demo, `needs_seeding`, `force`, `preserve_plans`, limpieza e aislamiento.
10. Documentar operaciones: settings, `.env`, URLs, middleware, throttles, tareas programadas, CI, backups, restore, monitor y despliegue.
11. Revisar tests de `core` y `seed`.

Criterio de cierre:

- Los 3 documentos completos.
- Referencias válidas.
- Tests `core` y `seed` verdes.
- `AUDITORIA-INDEX.md` actualizado con estas auditorías.

---

### Fase 3 — Dinero y socios

Documentos:

- `AUDITORIA-MIEMBROS.md`
- `AUDITORIA-PLANES.md`
- `AUDITORIA-SUSCRIPCIONES.md`
- `AUDITORIA-PAGOS.md`
- `AUDITORIA-RECUPERACION.md`

Tareas por documento:

**Miembros**
- Corregir la sección de eliminación: ya no es hard delete.
- Documentar baja lógica, `deleted_at`, `deactivate`, `reactivate` y filtros.
- Documentar teléfono único por gimnasio y validación al reactivar.
- Documentar obra social, autolink y obra sin match.
- Documentar alta staff y alta pública.
- Documentar portal, adjuntos, edición y diferencias entre baja y recuperación de suscripción.
- Actualizar “Lo que NO hace” y “Problemas”.

**Planes**
- Revisar catálogo, plan base oculto, ciclo de vida, elección en alta y cambios de plan.
- Documentar validaciones de precio y reglas de ofertas.
- Reflejar el estado actual del cambio de plan y del crédito.

**Suscripciones**
- Documentar origen de suscripciones, renovación automática, cortesía, descuentos y roles.
- Incorporar prorrateo del primer ciclo.
- Incorporar aplicación de crédito y conflictos de período.
- Actualizar problemas y decisiones de negocio.

**Pagos**
- Documentar ciclo de cobro, días de vencimiento/bloqueo, estados y capacidades del socio.
- Documentar medios de pago, deuda, saldo a favor y recuperación.
- Reflejar `initial_pending`, bloqueo y renovación.
- Revisar la relación con check-in con descuento.

**Recuperación**
- Documentar condiciones, deuda, caso B, badge “recuperable” y pantalla del staff.
- Marcar como decisión de negocio lo que corresponda: recuperación sin prorrateo, aplicación de saldo, orden de chequeos.
- Aclarar que no es recuperación de clases.

Criterio de cierre:

- Los 5 documentos reflejan K5/K6 y las fases F.
- Referencias válidas.
- Tests `members`, `plans`, `subscriptions` y `payments` verdes.

---

### Fase 4 — Acceso, asistencia y horarios

Documentos:

- `AUDITORIA-ASISTENCIAS.md`
- `AUDITORIA-HORARIOS.md`

Tareas:

1. Documentar las dos formas de registrar asistencia.
2. Documentar reglas de check-in: ventana, estado de pago, bloqueo, cupos y descuentos.
3. Documentar planilla del staff y diferencias con el check-in del socio.
4. Documentar recuperaciones, intercambios y sesiones de actividad.
5. Documentar permisos por rol.
6. Documentar no-show y faltas.
7. Documentar cambios de horario: permanentes e intercambios.
8. Documentar cooldown, anticipación, cupo, límite mensual y conteo combinado.
9. Documentar el camino del staff y la aprobación.
10. Documentar fechas cerradas y feriados.
11. Actualizar problemas y eliminar referencias a bugs ya cerrados.

Criterio de cierre:

- Ambos documentos reflejan K4 y los fixes ACC/CFG.
- Referencias válidas.
- Tests de `attendance` verdes.

---

### Fase 5 — Add-ons (dividida en subfases)

La fase original se divide para ejecutar cada bloque en una sesión separada y no agotar el contexto. Cada subfase lee **solo** sus secciones y su código, edita únicamente ese alcance y ejecuta el validador más los tests de su módulo.

#### Fase 5.1 — Actividades: definición, horarios, inscripción y cobro

Documento:

- `AUDITORIA-ACTIVIDADES.md`, secciones 1–4 (`:10-153`).

Tareas:

1. Documentar concepto, unicidad de nombre y pertenencia a servicio/gimnasio.
2. Documentar horarios, duración de bloques y validación de solapes compartida.
3. Documentar inscripción, bajas y reinscripciones sin huérfanos.
4. Documentar cobro mensual, origen del precio y relación con el servicio.
5. Revisar backend (`models`, `serializers`, `enrollment_service`, `overlap`, `views`, `public_views`) y frontend (`Activities`, `ActivitySchedules`).
6. Actualizar problemas y decisiones de negocio de las secciones 1–4.

Criterio de cierre:

- Secciones 1–4 reescritas con referencias híbridas válidas.
- Tests de `activities` verdes.

#### Fase 5.2 — Actividades: sesiones, no-show y ciclo de vida

Documento:

- `AUDITORIA-ACTIVIDADES.md`, secciones 5–8 (`:154-327`).

Tareas:

1. Documentar registro de sesiones, no-show y recuperaciones.
2. Incorporar auto-desactivación de horarios y activación/desactivación/reactivación.
3. Documentar consumo de sesiones y diferencias con PT.
4. Actualizar “Lo que NO hace”, problemas y decisiones de negocio.
5. Revisar `session_service`, `no_show_service`, tests de desactivación e invariantes, y frontend (`ScheduleEnrollments`, `MemberActivities`, `member/ActivityDashboard`).

Criterio de cierre:

- Documento completo con referencias válidas.
- Tests de `activities` verdes.

#### Fase 5.3 — Salidas: definición, horarios, inscripción, solicitudes y cobro

Documento:

- `AUDITORIA-SALIDAS.md`, secciones 1–5 (`:10-194`).
- Cabecera de `AUDITORIA-SALIDAS.md`: verificar contra `f5b4b07`, fecha
  `2026-11-05`, alcance de secciones 1–5 y estado parcial (“secciones 1–5
  verificadas; 6–9 pendientes de Fase 5.4”).
- `AUDITORIA-INDEX.md`, fila 14: actualizar a `Fase 5.3` y estado
  `En curso Fase 5.3`; pasará a `5.3–5.4` / `Verificado` al cerrar 5.4.

Decisiones tomadas:

- Actualizar el índice al terminar 5.3, dejando claro que el documento todavía
  no está completo.
- Incluir en las secciones 1–5 los hallazgos nuevos detectados durante la
  revisión, como comportamiento actual o limitación, sin corregir código.
- No ejecutar tests locales en la sesión de edición: la validación de
  `outings` queda para CI después de publicar los cambios.

Alcance y límites:

- Reescribir sólo las secciones 1–5; no tocar las secciones 6–9, que quedan
  para Fase 5.4.
- No modificar código de producto, tests, modelos ni comportamiento.
- No corregir bugs ni discrepancias de UI encontradas: sólo documentarlas.
- Mantener el lenguaje simple del manual y separar las referencias técnicas.
- Usar referencias híbridas por símbolo (`backend/... · Clase.metodo`), sin
  rangos de línea nuevos.
- Dejar constancia de que §8 y §9 pueden contradecir temporalmente el texto
  nuevo hasta que se actualicen en 5.4.

Tareas:

1. Documentar diferencia con actividades y trainer como usuario del sistema.
2. Documentar horarios, validación de solapes y duración de bloques.
3. Documentar inscripción, bajas y reinscripciones sin huérfanos.
4. Documentar el flujo de solicitudes del socio y su aprobación.
5. Documentar cobro mensual y origen del precio.
6. Revisar backend (`models`, `serializers`, `enrollment_service`, `enrollment_request_service`, `overlap`, `views`, `public_views`, `core/overlap`, `core/mixins`, `payments/services`, `subscriptions/services`) y frontend (`Outings`, `OutingSchedules`, `OutingEnrollments`, `components/outings`).
7. Actualizar problemas y decisiones de negocio de las secciones 1–5.

Detalle de cambios:

**§1 — Qué es una salida y cómo se paga**

- Documentar salida, gimnasio, servicio, feature `salidas` y nombre único por
  gimnasio.
- Aclarar que el trainer es un usuario del sistema:
  - el modelo acepta un `User`;
  - la API de staff limita las opciones a usuarios con rol `trainer` del mismo
    gimnasio;
  - no hay constraint de rol a nivel modelo.
- Documentar punto de encuentro, recorrido, distancia Haversine y duración.
- Explicar `BillingPriceMixin`:
  - modo `monthly`: precio mensual obligatorio y mayor a 0;
  - modo `sessions`: precio mensual forzado a 0;
  - en una salida por sesiones el staff puede inscribir en modalidad mensual o
    paquete;
  - la modalidad mensual dentro de una salida por sesiones no genera cuota
    mensual; sólo el paquete genera cobro por sesiones.
- Aclarar que “$0 mensual” no significa necesariamente salida gratis: en modo
  sesiones el cobro real está en el paquete.
- Documentar la discrepancia del formulario: la ayuda visual sugiere
  “0 = incluida en la membresía”, pero el backend rechaza precio mensual 0 en
  modo mensual. No corregir la UI.
- Referencias: `Outing`, `OutingSerializer`,
  `BillingPriceMixin.apply_billing_price_rules`,
  `Service.get_default_outings_service`, `FEATURE_OUTINGS`, `require_outings`.

**§2 — Horarios**

- Reemplazar la afirmación desactualizada de que “las salidas no validan
  solapes”.
- Documentar campos del horario, unicidad salida+día+inicio, `end > start` en
  API y base, filtro de activos y baja lógica.
- Documentar solape interno de la misma salida al crear/editar horario.
- Documentar validación de agenda del socio al inscribir o solicitar:
  `backend/outings/overlap.py · validate_enrollment` y
  `backend/core/overlap.py · check_member_slot`, con conflictos contra
  gimnasio, actividades, otras salidas y entrenamiento personal.
- Aclarar que la validación de agenda ocurre en la inscripción/solicitud, no al
  crear el horario.
- Aclarar que `duration_minutes` es informativa; el bloque real usa
  `start_time` y `end_time`.
- Referencias: `OutingSchedule`, `OutingSchedule.Meta`,
  `OutingScheduleSerializer.validate`, `_validate_no_overlap`,
  `OutingScheduleViewSet.get_queryset`, `validate_enrollment`.

**§3 — Inscripción, bajas y reinscripciones**

- Documentar los dos caminos:
  - staff: exige salida y horario activos; valida feature, gimnasio,
    elegibilidad, modalidad, solape, cupo y duplicado; toma lock del horario con
    `select_for_update`; crea la línea mensual si corresponde;
  - portal: crea solicitud, valida elegibilidad, cupo, duplicado y solape; no
    toma lock ni reserva cupo; bloquea salidas por sesiones.
- Documentar que una solicitud pendiente no reserva cupo y que la aprobación
  vuelve a validar, por lo que puede fallar si el horario se llenó.
- Documentar que puede haber una solicitud pendiente de inscripción y una de
  baja al mismo tiempo: la unicidad es por socio+tipo, no global.
- Documentar bajas:
  - staff puede dar de baja sin chequeo de elegibilidad;
  - el portal exige elegibilidad para solicitar la baja;
  - se marca la inscripción inactiva y se corta la facturación.
- Documentar ADD-28:
  - el ítem es por oferta, no por horario;
  - si queda otro horario activo de la misma salida, el ítem no se cancela;
  - se cancela al dar de baja el último horario activo.
- Documentar reinscripciones:
  - se crea una nueva fila de inscripción;
  - si el ítem anterior fue cancelado, se crea uno nuevo al precio actual;
  - si el ítem sigue activo, se reutiliza.
- Verificar y documentar si el guard por oferta distingue modalidad cuando un
  socio mezcla mensual y paquete en la misma salida.
- Referencias: `OutingEnrollmentService.enroll_member`, `unenroll_member`,
  `_ensure_outing_item`, `_cancel_outing_items`,
  `ScheduleOutingEnrollmentViewSet.enroll`, `unenroll`, `OutingEnrollment.Meta`.

**§4 — Solicitudes y aprobación**

- Documentar tipos `enroll`/`unenroll` y estados `pending`, `approved`,
  `rejected`, `cancelled_by_member`, `cancelled_by_staff`.
- Documentar creación de solicitud de inscripción: sólo salidas mensuales;
  valida elegibilidad, cupo, duplicado y solape; no reserva cupo.
- Documentar creación de solicitud de baja: exige inscripción propia activa,
  elegibilidad y una pendiente por tipo.
- Documentar aprobación:
  - revalida estado activo de salida/horario;
  - revalida cupo, duplicado y solape;
  - saltea elegibilidad de pago;
  - responde 410 si la salida ya no está activa;
  - si falla, la solicitud queda pendiente.
- Documentar que la aprobación de baja opera sobre `request.schedule`, no
  directamente sobre `request.enrollment`; verificar el caso de una solicitud
  vieja que podría dar de baja una reinscripción posterior.
- Documentar rechazo y cancelación: rechazo/approve guardan revisor, fecha y
  notas; cancelación sólo cambia estado, sin revisor.
- Documentar portal: lista inscripciones activas, solicitudes y salidas
  disponibles; `available_outings` excluye salidas por sesiones, horarios ya
  inscriptos, horarios con solicitud pendiente y horarios llenos.
- Referencias: `OutingEnrollmentRequest`, `OutingEnrollmentRequest.Meta`,
  `OutingEnrollmentRequestService`, `PublicMemberOutingsView.get`,
  `PublicOutingEnrollmentRequestView.post/delete`, `_available_outings`.

**§5 — Cobro**

- Documentar salida mensual:
  - crea o reutiliza un `SubscriptionItem` tipo `outing`;
  - el precio nace de `outing.monthly_price`;
  - se prorratea si la suscripción nació prorrateada;
  - si el ítem activo ya existe, no se actualiza el precio salvo cortesía;
  - si no hay suscripción vigente, verificar y documentar que no se crea ítem.
- Documentar cortesía: línea mensual en $0, paquete con `session_price=0` y
  pagos de paquete rechazados.
- Documentar paquete:
  - sólo en salidas `billing_mode="sessions"`;
  - total de sesiones y precio por sesión definidos por staff;
  - precio por sesión 0 permitido también para socios sin cortesía;
  - pagos parciales con `Payment(concept="outing")`;
  - `amount_paid` se sincroniza desde pagos;
  - no se puede cobrar más que el total pendiente;
  - deuda del paquete se suma a deuda del socio y del gimnasio.
- Documentar baja:
  - cancela ítems activos de la salida en suscripciones no vencidas;
  - no toca períodos históricos;
  - respeta ADD-28.
- Documentar frontend: panel muestra “Por sesiones” y puede mostrar “Gratis”
  cuando el precio mensual es 0; el modal permite mensual o paquete en salidas
  por sesiones; la lista distingue mensual/paquete y muestra precio por sesión.
- Referencias: `_ensure_outing_item`, `record_package_payment`,
  `outing_sessions_paid`, `sync_outing_paid`, `member_outing_package_debt`,
  `gym_outing_package_debt`, `_copy_outing_items`, `cancel_addon_items`.

Problemas y decisiones de negocio a dejar explícitos:

- Incorporar como notas “Importante” o “Decisión” dentro de 1–5, sin crear
  secciones nuevas:
  1. En modo sesiones la cuota mensual se fuerza a 0; el cobro real es el
     paquete. La modalidad mensual dentro de una salida por sesiones no cobra
     cuota.
  2. En modo mensual el precio debe ser mayor a 0; para $0 hay que usar
     cortesía. El formulario sugiere otra cosa.
  3. Una solicitud pendiente no reserva cupo; la aprobación puede fallar
     después.
  4. El ítem de facturación es por oferta, no por horario.
  5. La baja directa del staff no exige elegibilidad; la solicitud del portal
     sí.
  6. La aprobación saltea elegibilidad porque el staff ya la evaluó, pero no
     saltea cupo, duplicado ni solape.
- Verificar y documentar como comportamiento o limitación, sin corregir:
  - mezcla de modalidades en la misma salida;
  - solicitud de baja vieja que apunta al horario y no a la inscripción
    original;
  - inscripción mensual sin suscripción vigente;
  - posible conteo de `available_spots` con socios eliminados.

Verificación:

1. Validar referencias:
   `python3 scripts/check_audit_refs.py AUDITORIA-SALIDAS.md`.
2. Confirmar que no queden referencias `backend/...:numero` en secciones 1–5.
3. Confirmar con `git diff` que las secciones 6–9 no cambiaron.
4. Publicar los cambios y dejar que CI ejecute los tests de `outings`; no
   correrlos localmente en la sesión de edición.
5. Revisar que cabecera e índice sean coherentes con el estado parcial.

Criterio de cierre:

- Secciones 1–5 reescritas con referencias híbridas válidas.
- Secciones 6–9 intactas.
- Cabecera e índice actualizados al estado parcial.
- Tests de `outings` verdes en CI.
- Sin cambios de código ni de tests.

#### Fase 5.4 — Salidas: sesiones sin faltas y ciclo de vida

Documento:

- `AUDITORIA-SALIDAS.md`, secciones 6–9 (`:388-537`) y
  `### Notas de entorno` (`:538-553`).

Alcance:

- Reescribir sólo §6–§9 y las notas finales.
- No tocar §1–§5, código, tests ni commits.
- Convertir las referencias numéricas restantes a referencias híbridas por
  símbolo (`backend/... · Clase.metodo`).
- No ejecutar tests localmente: validar con CI, igual que en Fase 5.3.

Decisión de ejecución: dividir la fase en dos pasadas para evitar una edición
masiva y facilitar la validación.

##### 5.4a — Sesiones y ciclo de vida (§6–§7)

Tareas:

1. Reescribir §6 con el comportamiento actual:
   - las sesiones sólo aplican a inscripciones de modalidad `package`;
   - carga manual por staff y automática por check-in;
   - registro idempotente por `(inscripción, fecha, horario)`;
   - el registro automático se traga los errores y no impide el ingreso;
   - el staff puede quitar una sesión y renovar el paquete;
   - la renovación con saldo impago se rechaza por defecto, pero existe el
     override explícito `allow_unpaid`;
   - regla ACC-08: con una sola inscripción de paquete ese día se descuenta
     aunque el check-in caiga fuera de la ventana; con varias, sólo se
     descuentan las que caen en ventana; sin candidatos, no se descuenta;
   - no existe job de no-asistencia ni recuperaciones para salidas.
2. Reescribir §7 con el comportamiento actual:
   - desactivar la salida apaga los horarios activos, los marca como
     `auto_deactivated`, desactiva las inscripciones y corta la facturación;
   - reactivar restaura sólo los horarios `auto_deactivated`; los apagados a
     mano siguen apagados;
   - `restore_schedules=false` permite reactivar sin restaurar horarios;
   - crear un horario activo en una salida inactiva la activa;
   - no se puede desactivar el último horario activo de una salida activa;
   - no se puede guardar una salida activa sin horarios activos;
   - documentar el flujo visual “Restaurar horarios anteriores” vs “Crear
     nuevos horarios” y el estado de reactivación pendiente.
3. Revisar `backend/outings/session_service.py`,
   `backend/outings/models.py`, `backend/outings/views.py`,
   `backend/attendance/checkin_discount.py`,
   `backend/outings/serializers.py`, `backend/outings/public_views.py`,
   `frontend/src/pages/Outings.jsx`,
   `frontend/src/pages/OutingEnrollments.jsx`,
   `frontend/src/pages/member/MemberOutings.jsx` y
   `frontend/src/dev/OutingsFlow.jsx`.
4. Revisar los tests de `tests_deactivation.py` y `tests_phase_k2.py`
   (ADD-09, ADD-10, ADD-14, ADD-15, ADD-16, ADD-28).

Cierre parcial:

- §6–§7 reescritas con referencias por símbolo.
- Validador sin errores.
- §1–§5 y §8–§9 intactas.

##### 5.4b — Límites, problemas y cierre (§8–§9)

Tareas:

1. Corregir afirmaciones desactualizadas de §8 y §9:
   - §8 ya **sí valida solapes** al inscribir o solicitar, mediante
     `backend/outings/overlap.py · validate_enrollment` y
     `backend/core/overlap.py · check_member_slot`; no valida al crear
     horarios;
   - desactivar una salida **sí corta la facturación** y desactiva las
     inscripciones (`backend/outings/models.py · Outing.save`,
     `backend/outings/enrollment_service.py · cut_outing_billing`);
   - el portal **ya oculta** inscripciones a horarios desactivados (ADD-10);
   - el auto-conteo depende de ACC-08, no sólo de la ventana horaria;
   - la renovación bloqueada por saldo impago es el comportamiento por defecto,
     con override desde la UI;
   - reactivar ya no revive todos los horarios: sólo los `auto_deactivated`.
2. Conservar y verificar los límites que sigan vigentes: sin lista de espera,
   sin inscripción en onboarding, sin autoinscripción de paquetes, sin no-show,
   sin recuperaciones, sin cobro anticipado, sin versionado o actualización de
   precios, sin notificaciones, sin distinción de roles en el backend y sin cupo
   de gimnasio.
3. Actualizar las notas de entorno y convertir sus referencias numéricas.
4. Dejar explícitas las decisiones de negocio como notas “Importante” o
   “Decisión” dentro de §6–§9, sin crear secciones nuevas.
5. Mantener como riesgos actuales, si siguen vigentes:
   - desincronización del saldo del paquete si se cobra por fuera del flujo;
   - mezcla de modalidades y guard de ADD-28;
   - solicitud de baja vieja que apunta al horario y no a la inscripción;
   - conteo de cupos disponible sin filtrar socios eliminados.
6. Actualizar la cabecera a documento completo y la fila 14 de
   `AUDITORIA-INDEX.md` a `5.3–5.4` / `Verificado`, sólo con CI verde; si CI
   sigue pendiente, dejar `En curso Fase 5.4`.

Verificación:

1. Validar referencias:
   `python3 scripts/check_audit_refs.py AUDITORIA-SALIDAS.md`.
2. Confirmar que no queden referencias `backend/...:numero` en §6–§9 ni en las
   notas de entorno.
3. Confirmar con `git diff` que §1–§5 no cambiaron.
4. Publicar los cambios y dejar que CI ejecute los tests de `outings`; no
   correrlos localmente en la sesión de edición.
5. Revisar que cabecera e índice sean coherentes con el estado final.

Criterio de cierre:

- Documento completo, con §6–§9 y notas reescritas con referencias válidas.
- §1–§5 intactas.
- Cabecera e índice actualizados.
- Tests de `outings` verdes en CI.
- Sin cambios de código ni de tests.

#### Fase 5.5 — Personal Training: oferta, trainers y asignaciones

Documento:

- `AUDITORIA-PERSONAL-TRAINING.md`, secciones 1–5 (`:10-152`).

Tareas:

1. Documentar la feature `personal_training` y su activación.
2. Documentar la oferta, los trainers y la asignación 1:1.
3. Documentar quién carga cada dato y la validación de solapes.
4. Revisar backend (`models`, `serializers`, `availability`, `assignment_service`, `overlap`, `views`) y frontend (`PersonalTrainingSettings`, parte de oferta/trainers/asignaciones).
5. Actualizar problemas y decisiones de negocio de las secciones 1–5.

Criterio de cierre:

- Secciones 1–5 reescritas con referencias híbridas válidas.
- Tests de `personal_training` verdes.

#### Fase 5.6 — Personal Training: cobro, paquetes y sesiones

Documento:

- `AUDITORIA-PERSONAL-TRAINING.md`, secciones 6–7 (`:153-255`).

Tareas:

1. Documentar cobro mensual vs paquete de sesiones y origen del precio.
2. Documentar sellado, renovación, deuda y dónde se cobra.
3. Documentar uso de sesiones, faltas y recuperaciones.
4. Revisar `session_service`, servicios de cobro/paquetes y su cruce con `subscriptions`/`payments`, y frontend (`PersonalTrainingAttendance` y parte de precios de `PersonalTrainingSettings`).
5. Actualizar problemas y decisiones de negocio de las secciones 6–7.

Criterio de cierre:

- Secciones 6–7 reescritas con referencias híbridas válidas.
- Tests de sesiones y paquetes verdes.

#### Fase 5.7 — Personal Training: flujos, agenda y cierre del documento

Documento:

- `AUDITORIA-PERSONAL-TRAINING.md`, secciones 8–13 y `### Notas de entorno`
  (usar nombres de sección, no rangos de línea: el `:256-446` original quedó
  desactualizado).

Alcance:

- Reescribir sólo §8–§13 y las notas finales.
- No tocar §1–§7, código de producto ni tests.
- Convertir todas las referencias numéricas del tramo a referencias híbridas
  (`backend/... · Símbolo`).
- No ejecutar tests localmente: validar con CI, igual que en las fases 5.3–5.6.

Decisión de ejecución: dividir la fase en dos pasadas para evitar una edición
masiva y facilitar la validación: **5.7a** (§8–§11) y **5.7b** (§12–§13, notas y
cierre).

Contexto detectado antes de empezar (commit `3c4b680`, cierre de 5.6):

- §8–§13 todavía usan referencias `archivo:línea`; §1–§7 ya usan el formato
  híbrido.
- Cabecera e índice siguen en estado parcial: el documento dice que §8–§13 están
  pendientes y la fila 15 de `AUDITORIA-INDEX.md` dice `En curso Fase 5.6`.
- Hay contradicciones internas que la 5.7 debe resolver:
  - §12 dice que PT **no tiene recuperaciones** y §13 (punto 4) dice que no hay
    forma de compensar faltas; §7 ya documenta recuperaciones tipo `pt` (ADD-27)
    y `backend/personal_training/tests_phase_k3.py` las cubre.
  - §13 (punto 3) dice que `record_payment` **no se usa**; §6 dice que **sí está
    en uso** desde `frontend/src/pages/RecoverMembers.jsx`.
  - §11 dice que renovar **resetea el sellado**; §6 y
    `backend/personal_training/session_service.py · SessionService.renew_package`
    (DIN-18, cubierto por `tests_deactivation.py`) dicen que el sellado **no se
    vuelve a cobrar**.
  - §13 (punto 1) afirma que el botón “Renovar” está duplicado; hoy se renderiza
    una sola vez.
  - §13 (punto 2) afirma que editar trainer/horario no está en la UI; hoy existe
    el botón “Editar” y usa `updatePersonalTrainingAssignment` (ADD-19/K7).
- El documento no tiene la cabecera canónica (`Verificado contra`, `Fecha`,
  `Alcance`, `Documentos relacionados`, `Código cubierto`); al cerrar hay que
  normalizarla como en `AUDITORIA-ACTIVIDADES.md` y `AUDITORIA-SALIDAS.md`.

##### 5.7a — Solicitudes, agenda, asistencia y ciclo de vida (§8–§11)

Tareas:

1. Reescribir §8 (solicitudes de cambio de horario):
   - quién inicia: sólo el socio desde el portal, sobre una asignación activa;
   - qué pide y qué se valida: día válido, fin posterior al inicio, horario
     distinto al actual, una sola solicitud pendiente por asignación, y solape
     con horario fijo del socio, actividades, salidas, otros PT del socio y PT
     del trainer (`validate_assignment` / `check_member_slot`);
   - estados: `pending`, `executed`, `rejected`, `cancelled_by_member`,
     `cancelled_by_staff`; aclarar que `approved` existe en el modelo pero está
     muerto;
   - staff: aprobar revalida el solape y actualiza el horario recurrente vía
     `AssignmentService.update_assignment`; rechazar guarda revisor, fecha y
     notas; cancelar desde staff; el `DELETE` exige cancelar antes de borrar;
   - portal: crear y cancelar una solicitud propia; bloqueo por falta de pago
     (`MemberEligibility.can_operate`); endpoint de franjas libres
     (`PublicMemberAvailableSlotsView`) con `assignment_id` y
     `duration_minutes`, y reconciliación de la franja en la UI.
   - Referencias: `ChangeRequestService.create_request`, `approve_request`,
     `reject_request`, `cancel_request`; `PersonalTrainingChangeRequest`;
     `PersonalTrainingChangeRequestViewSet`; `PublicMemberChangeRequestView`,
     `PublicMemberAvailableSlotsView`; `validate_assignment`.

2. Reescribir §9 (agenda del trainer y portal del socio):
   - agenda `/trainer-agenda`: sólo lectura, agrupada por día, con contacto del
     socio y saldo de sesiones; sin acciones de registro ni cobro;
   - portal: asignaciones activas, oferta, trainer y su contacto, día y horario,
     dirección, progreso del paquete, sellado y cuánto pagó; pedir cambio, ver
     franjas disponibles y cancelar una solicitud propia;
   - verificar la ruta real en `frontend/src/App.jsx` y que la agenda no tenga
     mutaciones.
   - Referencias: `TrainerAgenda`, `MemberPersonalTraining`,
     `PublicMemberPersonalTrainingView`, `PublicAssignmentSerializer`,
     `PublicChangeRequestSerializer`.

3. Reescribir §10 (asistencia y métricas):
   - resumen por rango: sesiones programadas, asistidas, no asistidas, pendientes
     y tasa de asistencia;
   - desglose por trainer, con asignación, socio y estado por fecha esperada;
   - sólo los paquetes tienen seguimiento; las asignaciones mensuales van con
     `attendance: null`;
   - fechas esperadas: desde el alta de la asignación o el inicio del rango, lo
     que sea posterior, salteando días cerrados; si el paquete está agotado, sólo
     se listan las fechas con registro;
   - aclarar que la pantalla es de consulta y está embebida como pestaña en la
     asistencia del gimnasio.
   - Referencias: `PersonalTrainingAttendanceView`, `_expected_dates`,
     `_load_records`, `_member_payload`; `PersonalTrainingAttendance`; servicio
     `personalTraining.service`.

4. Reescribir §11 (desvincular, reactivar y renovar) y corregir la contradicción
   del sellado:
   - desvincular: baja lógica (`active = False`); cancela ítems de PT sólo si no
     queda otra asignación activa de la misma oferta; sólo suscripciones no
     vencidas; resincroniza el saldo;
   - desactivar/reactivar oferta: desactivar da de baja las asignaciones activas y
     corta el cobro; reactivar sólo republica y **no** reactiva asignaciones ni
     ítems (referir a §2);
   - renovar: suma sesiones, reactiva la asignación y **no** vuelve a cobrar ni
     resetea el sellado (DIN-18); el saldo impago bloquea salvo `allow_unpaid`;
     no hay tope máximo; no cobra automáticamente.
   - Referencias: `AssignmentService.unassign_member`, `_cancel_pt_items`,
     `cut_service_billing`; `PersonalTrainingServiceViewSet.reactivate`;
     `SessionService.renew_package`; `PersonalTrainingAssignmentViewSet.renew`;
     `tests_deactivation.py`.

5. Validar el tramo:
   `python3 scripts/check_audit_refs.py AUDITORIA-PERSONAL-TRAINING.md` y
   confirmar que no queden referencias `backend/...:número` ni
   `frontend/...:número`.

Criterio de cierre de 5.7a:

- §8–§11 reescritas con referencias híbridas válidas.
- §1–§7 y §12–§13 intactas.
- Cabecera e índice en estado parcial (`En curso Fase 5.7`).

##### 5.7b — Cierre del documento (§12–§13, notas, cabecera e índice)

Tareas:

1. Reescribir §12 (“Lo que NO hace”) contra el código actual:
   - quitar “No tiene recuperaciones” e incorporar el comportamiento real
     (ver §7): PT usa el mismo motor que actividades con tipo `pt`; una
     recuperación perdona exactamente una falta; respeta las recuperaciones en
     vuelo; si no se usa, vence;
   - revalidar uno por uno: autoasignación/onboarding, lista de espera y cupos,
     check-in por QR, cobro anticipado, versionado y actualización de precios,
     distinción de roles en backend, avisos por email/WhatsApp y validación de la
     duración real;
   - marcar las decisiones de negocio como “Decisión” y las limitaciones como
     “Limitación”, sin crear secciones nuevas.
2. Reescribir §13 (“Problemas que pueden pasar”):
   - eliminar los problemas ya corregidos y verificarlo con código y tests:
     - botón “Renovar” duplicado (hoy hay uno solo; REF-05/ADD-19);
     - edición directa de trainer/horario ausente en la UI (hoy existe “Editar” y
       PATCH desde la pantalla; ADD-19/K7);
     - `record_payment` sin uso (hoy lo usa `RecoverMembers`);
     - “faltar agota el paquete sin compensación” (ADD-27/K3 y ADD-29);
   - conservar y ajustar los que sigan vigentes: bloqueo por saldo, cancelación
     sólo en períodos no vencidos, reconciliación de franjas, estado `approved`
     muerto y solape del trainer validado sólo dentro del mismo día;
   - agregar cualquier problema nuevo detectado en la revisión, sin tocar código.
3. Convertir a híbridas las referencias numéricas de §12–§13 y de
   `### Notas de entorno`; actualizar zona horaria, guard de la feature, motores
   compartidos y flujo visual.
4. Revisar `frontend/src/dev/PersonalTrainingFlow.jsx` y alinearlo con el texto
   final si afirma algo que cambió (sólo contenido, sin lógica).
5. Cerrar cabecera e índice:
   - reemplazar el bloque “Estado” por la cabecera canónica (`Verificado contra`,
     `Fecha`, `Alcance`, `Documentos relacionados`, `Código cubierto`) como en
     `AUDITORIA-ACTIVIDADES.md` y `AUDITORIA-SALIDAS.md`;
   - actualizar `AUDITORIA-INDEX.md`, fila 15: fase `5.5–5.7`, estado
     `Verificado`, alcance con agenda, solicitudes y cierre.
6. No modificar código de producto ni tests.

Verificación:

1. `python3 scripts/check_audit_refs.py AUDITORIA-PERSONAL-TRAINING.md`.
2. Confirmar que no queden referencias `backend/...:número` ni
   `frontend/...:número` en §8–§13 ni en las notas.
3. `git diff` para confirmar que §1–§7 no cambiaron (salvo la cabecera) y que no
   hay cambios de código ni tests.
4. Publicar y dejar que CI ejecute `backend/personal_training` (incluye
   `tests_phase_k2`, `tests_phase_k3`, `tests_phase_k7` y `tests_deactivation`);
   no correrlos localmente.
5. Revisar coherencia entre cabecera, índice y estado final.

Criterio de cierre:

- Documento completo, sin afirmaciones desactualizadas ni contradicciones
  internas, con referencias híbridas válidas.
- §1–§7 intactas.
- Cabecera canónica e índice actualizados a `5.5–5.7` / `Verificado`.
- Tests de `personal_training` verdes en CI.
- Sin cambios de código ni de tests.

#### Fase 5.8 — Integración y cierre de Add-ons

Documentos:

- Los 3 documentos de la fase: `AUDITORIA-ACTIVIDADES.md`,
  `AUDITORIA-SALIDAS.md` y `AUDITORIA-PERSONAL-TRAINING.md`.
- `AUDITORIA-INDEX.md` (fila 13 y cabecera).
- `AUDITORIA-MAPA-COBERTURA.md` (sólo verificación de las filas de add-ons).

Alcance:

- Fase de **coherencia entre documentos**: no se reescriben secciones enteras;
  se corrigen divergencias puntuales detectadas al contrastar los tres.
- No tocar código de producto ni tests; los dev flows sólo contenido, sin
  lógica.
- No ejecutar tests localmente: validar con CI, igual que en 5.3–5.7 (esto
  reemplaza el comando `manage.py test` del borrador original de esta fase).
- Los bugs nuevos que aparezcan al contrastar se documentan como problema y se
  propone su alta en `BUGS.md`; no se arregla código.

Decisión de ejecución: dividir en dos pasadas, como en 5.7: **5.8a**
(contraste y correcciones por documento) y **5.8b** (cierre global: cabeceras,
índice, mapa y validación).

Contexto detectado antes de empezar (commit `12313e3`, cierre de 5.7):

- Las tres auditorías están cerradas y `Verificado` (índice, filas 13–15); el
  trabajo de 5.8 es de consistencia, no de revalidación masiva.
- El código sigue en `f5b4b07`: los commits posteriores son sólo de docs.
- **Cabeceras divergen de la plantilla**: `AUDITORIA-PLANTILLA.md` exige seis
  campos; PT no tiene `Tests:` ni `Estado: verificado` (ACTIVIDADES y SALIDAS
  sí).
- **Marcado de decisiones**: PT §12–§13 marca **Decisión**/**Limitación**;
  ACTIVIDADES no marca nada (§7–§8) y SALIDAS tiene 4 “Limitación” dispersas y
  en otro formato.
- **Enlaces cruzados**: sólo en “Documentos relacionados” de la cabecera; los
  cuerpos no se referencian entre sí.
- **Terminología de la baja**: actividades “dar de baja”, salidas “bajas”,
  PT “desvincular”. Decisión: mantener el vocabulario propio de cada módulo,
  pero explicitar la equivalencia donde se comparan.
- La fila 13 del índice dice “no-show” (inglés) mientras el cuerpo de
  ACTIVIDADES usa “faltas”/“no asistió”.
- PT no lista `AUDITORIA-HORARIOS.md` en “Documentos relacionados”, aunque
  valida solape contra el horario fijo del socio (`ScheduleSlot`).
- SALIDAS no menciona los días cerrados (`GymClosedDate`) en todo el documento.

##### 5.8a — Contraste y correcciones por documento

Ejes de contraste (aplicar a los tres documentos):

1. **Faltas**: actividades y PT descuentan con el job diario (motor compartido,
   watermark ADD-29, perdón por recuperación ADD-27); salidas no. Cada documento
   debe nombrar la divergencia y enlazar a los otros dos.
2. **Recuperaciones**: actividades (`kind=activity`) y PT (`kind=pt`, sin botón
   en la UI, hallazgo de 5.7) las tienen; salidas no. Enlaces al motor en
   `AUDITORIA-RECUPERACION.md`.
3. **Solicitudes del socio**: en salidas es un pedido de inscripción/cambio que
   el staff aprueba; en PT es un cambio de horario; en actividades no hay
   solicitudes (baja inmediata). Dejar explícito que la palabra significa cosas
   distintas por módulo.
4. **Cobro compartido**: mismos `Payment` con conceptos distintos
   (`activity`/`outing`/`personal_training`); mensual con precio congelado en
   el ítem; paquete con `amount_paid` resincronizado; sellado sólo PT; cobro
   desde Pagos/Recuperar socios; períodos vencidos inmutables.
5. **Ciclo de vida de la oferta**: activar/desactivar/reactivar con corte de
   cobro (Fase D) en los tres; reactivar nunca restaura asignaciones ni ítems.
6. **Solape y cupos**: motor compartido `backend/core/overlap.py`; actividades
   valida cupo y solape del socio; salidas cupo del horario; PT 1:1 con solape
   del trainer.
7. **Portal público con token** y bloqueo por deuda (`MemberEligibility`).
8. **Días cerrados** (`GymClosedDate`): salteados al descontar faltas y en las
   fechas esperadas (actividades y PT); verificar qué hace salidas al registrar
   sesiones en días cerrados y documentarlo si aplica.

Tareas:

1. Leer los tres documentos completos contra estos ejes y anotar divergencias
   (afirmación que contradice a otro documento, o silencio donde el lector
   compararía).
2. Corregir en `AUDITORIA-ACTIVIDADES.md`:
   - §5 (sesiones y faltas): nombrar que PT comparte el motor y que las salidas
     no descuentan (enlaces cruzados);
   - §3 (inscripción): aclarar que no hay solicitudes, a diferencia de salidas;
   - §7–§8: marcar **Decisión**/**Limitación** en el formato de PT §12–§13,
     sin reestructurar las listas.
3. Corregir en `AUDITORIA-SALIDAS.md`:
   - §6.4 (por qué no hay faltas): enlazar a actividades y PT;
   - §4 (solicitudes): aclarar la diferencia con PT y con actividades;
   - §8–§9: marcar **Decisión**/**Limitación** como en PT; unificar el formato
     de las 4 “Limitación” ya existentes si difiere.
4. Corregir en `AUDITORIA-PERSONAL-TRAINING.md`:
   - §7 (faltas): enlace cruzado a `AUDITORIA-ACTIVIDADES.md` §5 (comparte el
     motor con actividades);
   - §8 (solicitudes): aclarar la diferencia con las de salidas;
   - verificar el marcado existente; ajustes puntuales sólo si el contraste lo
     pide.
5. Revisar los tres dev flows (`ActivitiesFlow.jsx`, `OutingsFlow.jsx`,
   `PersonalTrainingFlow.jsx`) y alinear contenido si algo quedó contradictorio
   tras el contraste (sólo contenido, sin lógica).

##### 5.8b — Cierre global (cabeceras, índice, mapa y validación)

Tareas:

1. Normalizar la cabecera de PT según `AUDITORIA-PLANTILLA.md`: agregar
   `Tests:` (`backend/personal_training/tests.py`, `tests_deactivation.py`,
   `tests_phase_k2.py`, `tests_phase_k3.py`, `tests_phase_k7.py`) y
   `Estado: verificado`; agregar `AUDITORIA-HORARIOS.md` a documentos
   relacionados. No tocar las fechas de ACTIVIDADES/SALIDAS (son sus fechas de
   verificación reales).
2. `AUDITORIA-INDEX.md`:
   - fila 13: reemplazar “no-show” por “faltas” (terminología del cuerpo);
   - confirmar filas 13–15: fase y estado finales ya cargados por 5.2/5.4/5.7;
   - actualizar `Fecha:` de la cabecera del índice a la fecha de cierre de 5.8
     (el `Verificado contra: f5b4b07` sigue vigente: el código no cambió).
3. `AUDITORIA-MAPA-COBERTURA.md`: verificar las filas de los tres add-ons
   (apps, endpoints, pantallas y tests) contra el estado final; editar sólo si
   algo quedó desactualizado.
4. Validación global:
   - `python3 scripts/check_audit_refs.py AUDITORIA-ACTIVIDADES.md
     AUDITORIA-SALIDAS.md AUDITORIA-PERSONAL-TRAINING.md AUDITORIA-INDEX.md`;
   - confirmar que no quedan referencias `archivo:línea` en los tres
     documentos;
   - `git diff` para confirmar que no hay cambios de código ni tests.
5. Commit único `docs(auditorias): cerrar add-ons y validar coherencia
   (fase 5.8)` con cuerpo detallado; push a `development`.

Verificación:

1. Validador global de referencias (comando arriba).
2. Sin referencias numéricas en los tres documentos.
3. `git diff` acotado a los documentos de la fase (más índice/mapa si se
   tocaron).
4. CI ejecuta `backend-tests.yml` (incluye `activities`, `outings` y
   `personal_training`), `pnpm lint` y `pnpm build`; no correr tests
   localmente.
5. Lectura final de los tres documentos para confirmar que las divergencias
   anotadas en 5.8a quedaron resueltas.

Criterio de cierre:

- Los tres documentos cuentan lo mismo sobre los motores compartidos (faltas,
  recuperaciones, cobro, solape, ciclo de vida) y nombran sus divergencias con
  enlaces cruzados.
- Decisiones de negocio y limitaciones marcadas en los tres, con el mismo
  formato.
- Cabecera de PT completa según la plantilla.
- Índice y mapa actualizados; referencias válidas.
- Tests de `activities`, `outings` y `personal_training` verdes en CI.
- Sin cambios de código ni de tests.

---

### Fase 6 — Rutinas y comunidad (dividida en subfases)

Como la fase 5, se divide para ejecutar cada bloque en una sesión separada y
no agotar el contexto. Las 8 tareas del borrador original quedan cubiertas:
la 1–4 en 6.1–6.2, la 5–6 en 6.3, la 7 es el contexto de abajo (incorporado a
cada subfase) y la 8 en 6.2–6.3.

Documentos:

- `AUDITORIA-RUTINAS.md`
- `AUDITORIA-COMUNIDAD.md`
- `frontend/src/dev/RoutinesFlow.jsx` (sólo contenido, en 6.4).
- `AUDITORIA-INDEX.md` (filas 16–17, en 6.5).
- `AUDITORIA-MAPA-COBERTURA.md` (verificación de las filas 46–47, en 6.5).

Alcance:

- Dos módulos independientes: no comparten motor entre sí (a diferencia de
  los add-ons de 5.8), así que la fase es la suma de dos revalidaciones, no
  un contraste entre documentos.
- No tocar código de producto ni tests; el dev flow sólo contenido, sin
  lógica.
- No ejecutar tests localmente: validar con CI, igual que en 5.3–5.8.
- Los bugs nuevos que aparezcan se documentan como problema y se propone su
  alta en `BUGS.md`; no se arregla código.

Contexto detectado antes de empezar (commit `86d6735`, cierre de 5.8):

- El código sigue en `f5b4b07`: todos los commits posteriores son de docs.
- Los dos documentos están en estados muy distintos y la fase es asimétrica:
  no conviene tratarlos igual.
- **`AUDITORIA-RUTINAS.md` quedó desfasada de su propio código.** No se toca
  desde `d8a6612` (16/10) y cuatro días después `bd09935` (Fase H, 20/10)
  cerró 6 de sus 10 hallazgos; el documento los sigue reportando como bugs
  vigentes:
  - §4 dice que no hay unicidad de rutina activa y que el alta no es atómica:
    la Fase H agregó `uniq_active_routine_per_member` (índice único parcial
    `(gym, member) WHERE active=True`, migración 0010) y envolvió el
    `bulk-assign` en `transaction.atomic()`.
  - §7/§8.1 dicen que no hay control de rol: `require_routine_manager`
    (dueño/staff/profesor; trainer recibe 403) gatea los ViewSets y el
    `bulk-assign`.
  - §8.2 dice que la asignación tiene DELETE duro: ahora es soft delete
    (`active=False`) y el ViewSet no expone DELETE (405).
  - §8.4 dice que un ejercicio desactivado sigue saliendo en la rutina:
    `MemberRoutineSerializer.get_exercises` filtra `is_active=True`.
  - §7/§8.9 dicen que `/routines` no tiene guard: existe `RoutineManagerRoute`
    (trainer redirigido a su agenda).
  - §8.7/§9 dicen que la app no tiene tests: existe
    `backend/routines/tests_phase_h.py` (16 tests).
- Cambios posteriores al 20/10 que tampoco cubre (tarea 7 del borrador):
  - **ACC-20** (`1b38fd8`, 25/10): los listados de rutinas filtran socios
    eliminados (`member__deleted_at__isnull=True`) y `Member.objects` pasó a
    ser `AliveMemberManager`, así que el token de un socio eliminado da 404
    en los endpoints públicos.
  - **ACC-18** (`5a87ad3`, 20/10): todos los endpoints del portal resuelven el
    token con `portal_member_or_404`, que acepta también
    `access_token_previous` (gracia de una generación). Aplica a
    `public/<token>/` y `public/<token>/progress/`, y el documento de rutinas
    no lo menciona (el de comunidad sí).
  - **REF-08** (`c54c1f6`, 20/10): el admin Django de rutinas y comunidad
    quedó recortado por gimnasio (`GymScopedAdminMixin`).
- **Permisos: el gate de rol es sólo de gestión, no de lectura.** Fase H puso
  `RoutineManagerMixin`/`require_routine_manager` en los cuatro ViewSets y en
  `bulk-assign`, pero `member/<id>/`, `active/` y `member/<id>/whatsapp/`
  sólo exigen `IsAuthenticated`. Un trainer puede leer la rutina de un socio,
  listar todas las asignaciones activas y obtener el WhatsApp con su teléfono.
  La auditoría y el dev flow deben distinguir "gestión con rol" de "lectura
  autenticada" y marcar el acceso del trainer al WhatsApp como limitación (o
  decisión), no como si el 403 cubriera todo.
- **`Exercise` no es único por gimnasio.** `AUDITORIA-RUTINAS.md` §1 lo afirma,
  pero `Exercise` no tiene `unique_together`/`UniqueConstraint`,
  `ExerciseSerializer` no valida duplicados y la migración 0008 no agrega la
  restricción. Lo mismo pasa con el nombre de `RoutineTemplate`. Corregir la
  afirmación y documentarlo como limitación.
- **El alta directa de asignaciones no maneja el `IntegrityError`.** El
  `bulk-assign` responde 400 al pisar `uniq_active_routine_per_member`, pero
  `POST /api/routines/assignments/` (y un PATCH que reactive) no captura la
  excepción: `api_exception_handler` sólo enriquece errores de features, así
  que el cliente recibe **500**. Debe quedar como problema vigente en §8.
- **El `bulk-assign` descarta socios inválidos en silencio.** Filtra con
  `Member.objects.filter(gym=gym, id__in=member_ids)` (socios vivos) y
  responde 200 con `assigned_members` contando sólo los encontrados. Un ID de
  otro gimnasio, inexistente o de un socio eliminado (ACC-20) no se avisa; el
  test `test_bulk_assign_leaves_no_partial_state` fija ese comportamiento.
- Sin documentar también: el endpoint `member/<id>/whatsapp/` (mensaje de
  bienvenida que copia el staff desde `Members.jsx`) y que las migraciones
  llegan a 0010 (el documento dice "0001…0009").
- Convenciones: sin cabecera canónica (le faltan `Tests:`, `Estado:` y el
  formato de 6 campos), referencias numéricas inline (`:28-82`) en vez de
  símbolos, y §8/§9 sin el marcado de decisiones que estandarizó la fase 5.
- **`AUDITORIA-COMUNIDAD.md` está vigente contra su Fase I** (`68896f0`,
  20/10, actualizada en el mismo commit): ya documenta el soft delete
  (COM-04), la unicidad (COM-03), el rol owner-only, los throttles, la gracia
  de un token viejo y el socio inactivo (COM-01). Le falta: cabecera canónica,
  refs por símbolo, el 404 del socio eliminado (ACC-20), el admin gym-scoped
  (REF-08) y las secciones "Lo que NO hace"/"Problemas" con marcado.
- `RoutinesFlow.jsx` (830 líneas) arrastra el mismo desfase pre-Fase H en sus
  bloques `PERMISOS`, `BUGS` y `NO_HACE`, y además en el aviso del bloque
  "Cómo se asigna" (`AsignarRutina`, alrededor de la línea 293), que todavía
  dice que la unicidad es "convención de la interfaz" y que el alta no es
  atómica.
- **`BUGS.md` enlaza a `AUDITORIA-COMUNIDAD.md §4.2`** (ficha COM-05, línea
  1032). Por eso la reescritura de comunidad debe conservar la sección 4.2
  (tarjeta pública) o actualizar ese enlace en el mismo commit.
- `check_audit_refs.py` pasa hoy sobre ambos (108 referencias, 0 errores); el
  cambio a símbolos es por convención (§3), no para reparar errores.

#### Fase 6.1 — Rutinas: qué es, catálogo, armado, asignación y ejecución

Documento:

- `AUDITORIA-RUTINAS.md`, secciones 1–5.

Tareas:

1. Recorrer `backend/routines` (models → serializers → views → urls) y el
   frontend (`Routines.jsx`, `components/routines/*`,
   `member/MemberWorkout.jsx`).
2. §1 "Qué es una rutina (y qué no)": mantener la tabla de cinco piezas
   (`Exercise`, `RoutineTemplate`, `RoutineExercise`, `RoutineAssignment`,
   `WorkoutSet`) y las desambiguaciones (PT, recuperación, trampa
   `PublicRoutine.jsx` vs `MemberWorkout.jsx`). **Corregir** la afirmación
   "el ejercicio es único por gimnasio": hoy no hay restricción de unicidad
   sobre `Exercise.name` ni sobre `RoutineTemplate.name`.
3. §2–§3 (catálogo y armado): revalidar campos, categorías, `reps`/`weight`
   texto libre y modos de descanso; verificar RUT-05 (`RoutineExercise` sin
   campo `gym`, "no se reproduce"); documentar la falta de unicidad de
   nombres como **Limitación**.
4. §4 "Cómo se asigna" (reescritura de fondo): el `bulk-assign` con
   `require_routine_manager`, `transaction.atomic()` y unicidad **en la
   base** (ya no "convención de la interfaz"); la baja como
   `PATCH active=false` (soft delete, sin DELETE); el filtrado de socios
   eliminados (ACC-20); que el `bulk-assign` **descarta en silencio** los IDs
   inválidos, ajenos o eliminados y responde 200 con el conteo de encontrados;
   y que el alta directa `POST /api/routines/assignments/` (o un PATCH que
   reactive) **no captura el `IntegrityError` y devuelve 500**.
5. §5 "Qué hace el socio" (ejecución): revalidar portal por token, toggles de
   series, temporizadores, barra de progreso y bloqueo por deuda; agregar el
   armado del mensaje de WhatsApp desde la ficha de socios
   (`Members.jsx` → `member/<id>/whatsapp/`); documentar la gracia de un token
   anterior (ACC-18) y que el token de un socio eliminado da 404 (ACC-20).

Criterio de cierre:

- Secciones 1–5 reescritas con referencias híbridas válidas y sin afirmaciones
  pre-Fase H.
- Sin cambios de código ni de tests.

#### Fase 6.2 — Rutinas: progreso, permisos y cierre del documento

Documento:

- `AUDITORIA-RUTINAS.md`, secciones 6–10 y cabecera.

Tareas:

1. §6 "Progreso y registro": revalidar `WorkoutSet`, la unicidad
   `(asignación, ejercicio, serie, fecha)` y la regla "sólo se registra hoy"
   como **Decisión** (RUT-08).
2. §7 "Permisos y accesos" (reescritura): distinguir **cuatro** niveles
   post-Fase H — (a) gestión con rol (`require_routine_manager` en los cuatro
   ViewSets y en `bulk-assign`; dueño/staff/profesor, trainer 403);
   (b) **lectura autenticada sin rol** (`member/<id>/`, `active/` y
   `member/<id>/whatsapp/` sólo piden `IsAuthenticated`, así que un trainer
   lee la rutina, las asignaciones activas y el teléfono del socio);
   (c) frontend con `RoutineManagerRoute`; (d) público por token (confirmar el
   payload actual de `public/<token>/`; su amplitud es **Decisión**, RUT-06),
   más el admin Django gym-scoped (REF-08), la gracia de un token anterior
   (ACC-18) y el 404 del token de un socio eliminado (ACC-20). El acceso del
   trainer al WhatsApp se marca como **Limitación** (no se arregla acá).
3. §8 "Posibles bugs / desajustes" → renombrar "Problemas que pueden pasar"
   con títulos numerados en negrita; dejar sólo los vigentes (los cerrados
   por Fase H salen del documento; quedan en `BUGS.md`) y agregar el **500 del
   alta directa de asignaciones** y el **descarte silencioso del
   `bulk-assign`**.
4. §9 → "Lo que el sistema NO hace hoy (para no prometerlo en el manual)"
   con marcado **Decisión:**/**Limitación:** (RUT-06, RUT-08, la falta de
   unicidad de nombres y la lectura sin rol del trainer, entre otras).
5. §10 "Notas de entorno": migraciones 0001–0010, `tests_phase_h.py`, admin
   scoped, seed de ejercicios/rutinas y ausencia de `services.py`/
   `permissions.py` propios (el gate vive en `backend/core/permissions.py`).
6. Cabecera canónica de 6 campos más
   `Tests: backend/routines/tests_phase_h.py` y `Estado: verificado`;
   `Verificado contra: f5b4b07`. Fijar `Documentos relacionados`
   (miembros, recuperación, pagos, suscripciones, núcleo y comunidad) y
   `Código cubierto` (app, permisos, portal y dev flow).

Criterio de cierre:

- Documento completo: marcado de decisiones, sin afirmaciones de bugs ya
  cerrados, cabecera canónica.
- Sin cambios de código ni de tests.

#### Fase 6.3 — Comunidad: pase completo

Documento:

- `AUDITORIA-COMUNIDAD.md`, completo.

Tareas:

1. Recorrer `backend/community` y las pantallas (`CommunityPanel.jsx`,
   `member/MemberCommunity.jsx`, `member/CommunityPublicPage.jsx` y la pestaña
   "Comunidad" de `Settings.jsx`).
2. Normalizar la cabecera (6 campos más
   `Tests: backend/community/tests.py` y `Estado: verificado`) y reemplazar
   refs numéricas por símbolos.
3. §4.2/§6: distinguir socio **inactivo** (sigue viendo la tarjeta, COM-01)
   de socio **eliminado** (token → 404 tras ACC-20). Conservar la sección
   **4.2** "Tarjeta pública": `BUGS.md` (ficha COM-05) enlaza a
   `AUDITORIA-COMUNIDAD.md §4.2`; si se renombra, actualizar ese enlace en el
   mismo commit.
4. §5: documentar el admin Django gym-scoped (REF-08).
5. Agregar "Lo que el sistema NO hace hoy" con COM-01/COM-02 marcadas como
   **Decisión:** (sin cupones ni códigos; `discount` informativo) y
   **Limitación:** (el `discount` es texto libre, el QR viejo caduca tras una
   rotación) y "Problemas que pueden pasar" corto con lo vigente.
6. Mantener el "Resumen en una frase" como cierre del documento (puede pasar
   a §9 si las secciones nuevas se numeran antes) y fijar en la cabecera
   `Documentos relacionados` (núcleo, miembros, usuarios y accesos, rutinas) y
   `Código cubierto` (app, pantallas y admin).
7. Agregar notas de entorno equivalentes a rutinas §10: migraciones 0001–0002,
   `tests.py`, admin gym-scoped y dependencia del feature flag.

Criterio de cierre:

- Documento completo con referencias híbridas válidas y cabecera canónica.
- Sin cambios de código ni de tests.

#### Fase 6.4 — Dev flow de rutinas

Documento:

- `frontend/src/dev/RoutinesFlow.jsx` (sólo contenido, sin lógica).

Tareas:

1. Bloque `PERMISOS`: reescribir "Staff sin filtro de rol" como rol de gestor
   de rutinas (dueño/staff/profesor; trainer 403 para gestionar) y el "gating
   visual" como `RoutineManagerRoute`; agregar que la **lectura** de
   `member/<id>/`, `active/` y `whatsapp/` sólo pide login y que un trainer
   puede leer la rutina y el teléfono del socio.
2. Bloque `BUGS`: recortar a los problemas vigentes de la §8 nueva (500 del
   alta directa, descarte silencioso del `bulk-assign` y lo que quede).
3. Bloque `NO_HACE`: quitar "no exige rol", "no garantiza unicidad en la
   base" y "no tiene tests"; agregar la lectura sin rol y la falta de unicidad
   de nombres.
4. Bloque "Cómo se asigna" (`AsignarRutina`): reemplazar el aviso de
   "convención de la interfaz"/"alta no atómica" por la regla real (índice
   único parcial + `transaction.atomic()`), y mencionar que el `bulk-assign`
   ignora IDs inválidos sin avisar.
5. Pase completo de las 830 líneas contra el documento reescrito.

Criterio de cierre:

- Flow coherente con la auditoría reescrita, sin cambios de lógica.

#### Fase 6.5 — Cierre global (índice, mapa y validación)

Tareas:

1. `AUDITORIA-INDEX.md`: filas 16–17 → `Verificado` con resúmenes ajustados a
   la terminología de los cuerpos; actualizar `Fecha:` de la cabecera a la
   fecha de cierre de la fase (el `Verificado contra: f5b4b07` sigue vigente).
2. `AUDITORIA-MAPA-COBERTURA.md`: verificar las filas 46–47 contra el estado
   real; en rutinas faltan endpoints (`routine-exercises/`, `active/`,
   `bulk-assign/`, `member/<id>/whatsapp/`, `public/<token>/progress/`);
   confirmar pantallas y tests; editar sólo lo desactualizado.
3. Validación:
   - `python3 scripts/check_audit_refs.py AUDITORIA-RUTINAS.md
     AUDITORIA-COMUNIDAD.md AUDITORIA-INDEX.md`;
   - confirmar que no quedan referencias `archivo:línea` en los dos cuerpos;
   - confirmar que `BUGS.md` (ficha COM-05) sigue resolviendo a
     `AUDITORIA-COMUNIDAD.md §4.2` o que el enlace se actualizó;
   - `git diff` para confirmar que no hay cambios de código ni tests.
4. Commits por subfase (6.4 y 6.5 pueden ir juntos si quedan chicos), estilo
   `docs(auditorias): … (fase 6.N)`, con push a `development`.

Verificación:

1. Validador global de referencias (comando arriba).
2. Sin referencias numéricas en los dos documentos.
3. `git diff` acotado a los documentos de la fase (más índice, mapa y dev
   flow).
4. CI ejecuta `backend-tests.yml` (incluye `routines` y `community`),
   `pnpm lint` y `pnpm build`; no correr tests localmente.
5. Lectura final de los dos documentos contra el listado de afirmaciones
   pre-Fase H del contexto, para confirmar que ninguna quedó viva.

Criterio de cierre:

- Ambos documentos revalidados contra `f5b4b07`: sin afirmaciones de bugs ya
  cerrados por Fase H/I, con ACC-18, ACC-20 y REF-08 cubiertos.
- La distinción gestión-con-rol / lectura-autenticada queda explícita, y el
  500 del alta directa y el descarte silencioso del `bulk-assign` quedan como
  problemas vigentes.
- Corregida la afirmación de unicidad de `Exercise`/`RoutineTemplate`.
- `BUGS.md` sigue enlazando a una sección existente de comunidad (§4.2) o el
  enlace se actualizó en el mismo commit.
- Decisiones de negocio y limitaciones marcadas con el formato de la fase 5.
- Cabeceras canónicas completas; índice filas 16–17 `Verificado`.
- Referencias válidas.
- Tests de `routines` y `community` verdes en CI.
- Sin cambios de código ni de tests.

---

### Fase 7 — Configuración e integración

Documento:

- `AUDITORIA-CONFIGURACION.md`

Tareas:

1. Reescribir el documento completo, corrigiendo el salto de secciones.
2. Documentar datos básicos, pagos, planes y horarios, recuperación de clases, descuentos, obras sociales, fechas cerradas, horarios del gimnasio, QR, SEO, features y PWA.
3. Documentar qué configura el dueño/staff y qué impacto tiene cada valor.
4. Actualizar efectos cruzados entre módulos.
5. Eliminar referencias a bugs ya cerrados y marcar decisiones de negocio.
6. Revisar coherencia con las fases 1–6.
7. Verificar enlaces cruzados entre todas las auditorías.

Criterio de cierre:

- Documento completo y sin contradicciones.
- Referencias válidas.
- Tests de `gyms` y `config` verdes.

---

### Fase 8 — Cierre y publicación

Documentos:

- Todos.
- `AUDITORIA-INDEX.md`.

Tareas:

1. Ejecutar el validador de referencias sobre las 18 auditorías.
2. Revisar que cada documento tenga cabecera, alcance y fecha.
3. Revisar que no queden afirmaciones obsoletas de bugs ya cerrados.
4. Revisar que las decisiones de negocio estén marcadas como tales.
5. Revisar enlaces entre documentos.
6. Revisar terminología y tono.
7. Actualizar el índice con estado final.
8. Ejecutar la suite completa del backend y el lint/build del frontend.
9. Registrar el commit final de verificación en todas las cabeceras.

Comandos de verificación:

```bash
python scripts/check_audit_refs.py AUDITORIA-*.md
cd backend && python manage.py test subscriptions members attendance payments plans config activities outings gyms admins accounts personal_training routines community profiles seed core
cd backend && python manage.py makemigrations --check --dry-run
cd frontend && pnpm lint
cd frontend && pnpm build
```

Criterio de cierre:

- 0 rutas inexistentes.
- 0 símbolos canónicos no encontrados.
- 0 líneas de snapshot fuera de rango.
- Suite backend verde.
- Lint y build de frontend verdes.
- Índice completo y actualizado.

---

## 6. Flujo de trabajo por documento

1. Leer el documento actual completo.
2. Extraer afirmaciones, reglas, pantallas y referencias.
3. Identificar qué cambió desde la última verificación.
4. Recorrer `models → serializers → services → views → frontend`.
5. Cruzar con tests y con `BUGS.md`/`PLAN-bugs.md`.
6. Reescribir el texto descriptivo.
7. Reemplazar referencias por el formato híbrido.
8. Actualizar “Lo que NO hace” y “Problemas”.
9. Agregar snapshot de referencias si aporta precisión.
10. Validar referencias y ejecutar los tests del módulo.
11. Marcar el documento como verificado en el índice.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Las auditorías vuelven a quedar obsoletas | Cabecera con commit/fecha, índice y validador de referencias |
| Las líneas se desfasan | Referencias por símbolo; líneas solo como snapshot |
| Se descubre un bug y se mezcla con la auditoría | Se documenta como problema y se propone alta en `BUGS.md`; no se arregla código |
| Contradicciones entre documentos | Fase 7 de integración y revisión cruzada final |
| Se documenta solo el backend y no la UI | Revisión obligatoria de pantallas y servicios del frontend |
| El branch avanza durante la ejecución | Congelar baseline y actualizar cabeceras al commit final |
| Se confunde decisión de negocio con bug | Marcarlas explícitamente y linkear `BUGS.md` |

---

## 8. Definition of Done

- Las 13 auditorías existentes están actualizadas in-place.
- Las 5 auditorías nuevas están creadas.
- `AUDITORIA-INDEX.md` está completo.
- Todas las auditorías tienen cabecera de verificación.
- Todas las referencias canónicas resuelven a archivo y símbolo existentes.
- No quedan afirmaciones obsoletas de funcionalidades ya cambiadas.
- “Lo que NO hace” y “Problemas” reflejan el estado actual.
- Las decisiones de negocio están marcadas y vinculadas.
- El validador de referencias pasa sin errores.
- La suite completa del backend pasa.
- `pnpm lint` y `pnpm build` pasan.
- No se modificó código de producto.
- No se hicieron commits sin pedido explícito.

---

## 9. Supuestos

- Se actualiza in-place.
- Se usa referencia híbrida por símbolo + snapshot opcional de líneas.
- Se incluyen las 5 auditorías nuevas y el índice.
- El alcance es descriptivo: no se corrigen bugs en esta tarea.
- Los hallazgos nuevos se documentan y, si corresponde, se propone su alta en `BUGS.md`.
- Cada fase se cierra antes de empezar la siguiente.
