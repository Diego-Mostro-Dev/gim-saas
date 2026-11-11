# Auditoría de Rutinas — Cómo funciona hoy la creación, asignación y ejecución de rutinas

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Escrito en lenguaje simple para servir de base a un manual de gimnasios. Las
> referencias de código van aparte, en letra chica, para no ensuciar el texto.
>
> Verificado contra: `f5b4b07`
> Fecha: 2026-11-11
> Alcance: catálogo de ejercicios, armado de plantillas, asignación a socios,
> ejecución desde el portal y registro de progreso. También cubre permisos,
> accesos públicos, límites y problemas conocidos. No cubre entrenamiento
> personal ni recuperación de clases/sesiones, salvo para desambiguar.
> Documentos relacionados: `AUDITORIA-MIEMBROS.md`, `AUDITORIA-NUCLEO-REGLAS.md`,
> `AUDITORIA-RECUPERACION.md`, `AUDITORIA-PAGOS.md`,
> `AUDITORIA-SUSCRIPCIONES.md`, `AUDITORIA-COMUNIDAD.md`
> Código cubierto: `backend/routines`, `backend/core/permissions.py`,
> `backend/core/mixins.py`, `backend/core/viewsets.py`,
> `backend/members/models.py`, `backend/members/eligibility.py`,
> `backend/gyms/features.py`, `backend/config/api/exception_handler.py`,
> `frontend/src/pages/Routines.jsx`, `frontend/src/pages/Members.jsx`,
> `frontend/src/pages/member/MemberWorkout.jsx`,
> `frontend/src/pages/member/MemberPortalLayout.jsx`,
> `frontend/src/components/routines`, `frontend/src/dev/RoutinesFlow.jsx`
> Tests: `backend/routines/tests_phase_h.py`
> Estado: verificado

---

## 1. Qué es una rutina (y qué no)

Una **rutina** es el plan de entrenamiento que el gimnasio le asigna a un socio.
Se arma con cinco piezas, siempre en este orden:

| Pieza | Qué es |
|-------|--------|
| **Ejercicio** (`Exercise`) | El movimiento del catálogo ("Press banca", "Sentadilla"). |
| **Plantilla de rutina** (`RoutineTemplate`) | Un plan con nombre ("Full body 3 días"). Agrupa una lista ordenada de ejercicios. |
| **Ejercicio de rutina** (`RoutineExercise`) | Una fila del plan: qué ejercicio, en qué orden, cuántas series y repeticiones, cuánto descanso. |
| **Asignación** (`RoutineAssignment`) | El enganche entre una plantilla y un socio. Es lo que hace que el socio "tenga" esa rutina. |
| **Registro** (`WorkoutSet`) | Cada serie que el socio marca como hecha mientras entrena. |

El catálogo es **de cada gimnasio**, pero **el nombre no es único**: hoy se pueden
cargar dos ejercicios con el mismo nombre en el mismo gimnasio, y dos plantillas
con el mismo nombre. No hay restricción en la base ni validación en el
serializer. Es una **Limitación** del sistema actual (§9), no una regla de
negocio.

Lo que **NO** es una rutina:

- **No es entrenamiento personal (PT).** El PT (clases 1 a 1 con un profesor,
  con su propio paquete de sesiones y su facturación) es una app aparte
  (`backend/personal_training/`). Acá no hay profesor ni sesión agendada: es un
  plan que el socio sigue por su cuenta.
- **No es "recuperar" clases o sesiones.** Eso es `SessionRecovery`
  (`backend/attendance/recovery_service.py`).
- Ojo con los nombres: `frontend/src/pages/PublicRoutine.jsx` **no** es el workout,
  es la página de **horarios** del portal. El entrenamiento real es
  `frontend/src/pages/member/MemberWorkout.jsx`.

### Referencia
- Modelos: `backend/routines/models.py · Exercise`,
  `backend/routines/models.py · RoutineTemplate`,
  `backend/routines/models.py · RoutineExercise`,
  `backend/routines/models.py · RoutineAssignment`,
  `backend/routines/models.py · WorkoutSet`.
- Registro del módulo: `backend/config/settings.py`, `backend/config/urls.py`.
- Rutas del portal: `frontend/src/App.jsx`.
- Página de horarios: `frontend/src/pages/PublicRoutine.jsx`.

---

## 2. El catálogo de ejercicios

El **catálogo** es la lista de movimientos disponibles del gimnasio. Cada
`Exercise` tiene:

- **Nombre** (obligatorio, hasta 100 caracteres). No es único (§9).
- **Descripción** (opcional).
- **Categoría** (opcional): una de estas nueve — pecho, espalda, piernas, hombros,
  bíceps, tríceps, core, cardio, movilidad.
- **Activo** (`is_active`): el borrado es **lógico**.

El borrado es "lógico" (soft delete): al eliminar un ejercicio **no se borra la
fila**, sólo se marca `is_active = False`. El sistema tiene dos "vistas" del
catálogo: `objects` (que oculta los inactivos, el que usa la pantalla) y
`all_objects` (que los ve todos). Además, borrar un ejercicio **también
desactiva todas sus filas de rutina** en todas las plantillas.

### Referencia
- Modelo: `backend/routines/models.py · Exercise`.
- Soft delete: `backend/routines/models.py · SoftDeleteQuerySet`,
  `backend/routines/models.py · SoftDeleteManager`,
  `backend/routines/models.py · AllObjectsManager`.
- Serializer: `backend/routines/serializers.py · ExerciseSerializer`.
- ViewSet: `backend/routines/views.py · ExerciseViewSet`.
- Pantalla: `frontend/src/components/routines/ExerciseForm.jsx`,
  `frontend/src/components/routines/ExerciseList.jsx`.

---

## 3. Cómo se arma una rutina

Una **plantilla de rutina** (`RoutineTemplate`) es sólo un nombre. Lo que le da
contenido son sus filas (`RoutineExercise`), que van en orden. Cada fila guarda:

| Campo | Para qué |
|-------|----------|
| `order` | Posición del ejercicio dentro de la rutina. |
| `sets` | Cantidad de series. |
| `reps` | Repeticiones. Es **texto libre** (permite "12", "10-12", "al fallo"). |
| `weight` | Peso. También es **texto libre**. |
| `notes` | Notas para el socio. |
| `rest_seconds` | Cuántos segundos descansar. |
| `rest_mode` | Cuándo descansar: `between_sets` (entre series), `after_exercise` (al finalizar el ejercicio) o `none` (sin descanso). |
| `next_exercise_rest_seconds` | Descanso extra antes del próximo ejercicio. |
| `exercise_type` | Tipo: `strength` (fuerza), `bodyweight` (peso corporal) o `cardio`. Cambia cómo se muestra en el portal. |

Reordenar es cambiar el `order`. Renombrar la rutina es editar la plantilla.
Borrar una fila de rutina es borrado lógico (queda inactiva). Borrar la
plantilla **también** desactiva sus filas y sus asignaciones.

`RoutineExercise` **no tiene campo `gym`**: el gimnasio se deduce de la
plantilla (`routine_template.gym`). Por eso su ViewSet no usa
`GymModelViewSet`; el filtrado y la validación de pertenencia se hacen por la
plantilla y por el serializer. El hallazgo RUT-05 no se reproduce: no es un
desajuste.

Tampoco hay unicidad de `order` dentro de una plantilla: dos filas pueden
compartir el mismo número de orden. La pantalla ordena por `order`, así que el
resultado queda estable pero no necesariamente con la intención del usuario.

### Referencia
- Modelo: `backend/routines/models.py · RoutineExercise`,
  `backend/routines/models.py · RoutineTemplate`.
- Serializer: `backend/routines/serializers.py · RoutineExerciseSerializer`.
- ViewSets: `backend/routines/views.py · RoutineTemplateViewSet`,
  `backend/routines/views.py · RoutineExerciseViewSet`.
- Pantalla: `frontend/src/components/routines/RoutineBuilder.jsx`,
  `frontend/src/components/routines/RoutineTemplateForm.jsx`,
  `frontend/src/components/routines/RoutineTemplateList.jsx`.

---

## 4. Cómo se asigna a un socio

La asignación se hace **en lote** desde la pestaña "Asignaciones": el staff elige
una plantilla y uno o varios socios, y confirma. El endpoint
`POST /api/routines/bulk-assign/` recibe `{ member_ids, routine_template }` y,
**por cada socio encontrado**:

1. **Desactiva** cualquier asignación activa previa del socio.
2. **Crea** una asignación nueva (`active = True`) con la plantilla elegida.

Todo el lote corre dentro de `transaction.atomic()`: si falla un alta, no queda
un estado intermedio (unos socios con la rutina nueva y otros no). La regla "una
sola rutina activa por socio" **sí está en la base**: hay un índice único parcial
`(gym, member) WHERE active=True` (`uniq_active_routine_per_member`). Las
asignaciones inactivas pueden repetirse sin límite.

La respuesta es `200` con `assigned_members` (cuántos socios se asignaron) y el
nombre de la rutina. Pero el endpoint **no avisa de los IDs que descartó**:

- Busca los socios con `Member.objects.filter(gym=gym, id__in=member_ids)`.
- `Member.objects` es el manager de socios **vivos**, así que un socio eliminado
  (ACC-20) no aparece.
- Un ID inexistente o de otro gimnasio tampoco aparece.
- `assigned_members` cuenta sólo los encontrados y el cliente recibe `200`.

Es decir: pedir 10 socios y asignar 7 devuelve `200` con `assigned_members: 7`,
sin detalle de los 3 que quedaron afuera. Es el comportamiento que fija el test
`test_bulk_assign_leaves_no_partial_state`.

También se puede desactivar una asignación suelta con un `PATCH active=false`.
El ViewSet **no expone `DELETE`** (responde `405`): la baja es lógica
(`active=False`) y la fila se conserva. La desactivación implícita del
`bulk-assign` usa el mismo criterio.

El alta directa de una asignación (`POST /api/routines/assignments/`) o un
`PATCH` que reactive una asignación **no** manejan el `IntegrityError` del
índice único. El serializer sólo valida que socio y plantilla sean del gimnasio;
el ViewSet no sobreescribe `create`; y el handler global de excepciones sólo
enriquece los errores de features. Si el socio ya tiene una rutina activa, el
cliente recibe **500** en vez de un `400` legible (§8).

El mensaje de WhatsApp con el link del portal y el detalle de la rutina se arma
desde la ficha de socios (`Members.jsx` → `GET /api/routines/member/<id>/whatsapp/`).
Ese endpoint incluye el teléfono del socio y usa el token vigente de su portal.

### Referencia
- Endpoint en lote: `backend/routines/views.py · BulkAssignRoutineView`.
- Alta/baja de asignaciones: `backend/routines/views.py · RoutineAssignmentViewSet`.
- Listado de activas: `backend/routines/views.py · ActiveRoutinesView`.
- Rutina de un socio: `backend/routines/views.py · MemberRoutineView`.
- Mensaje de WhatsApp: `backend/routines/views.py · MemberRoutineWhatsappView`.
- Modelo y constraint: `backend/routines/models.py · RoutineAssignment`.
- Serializers: `backend/routines/serializers.py · RoutineAssignmentSerializer`,
  `backend/routines/serializers.py · ActiveRoutineSerializer`.
- Handler global: `backend/config/api/exception_handler.py · api_exception_handler`.
- Pantallas: `frontend/src/components/routines/RoutineAssignment.jsx`,
  `frontend/src/components/routines/ActiveRoutines.jsx`,
  `frontend/src/components/routines/MemberRoutineModal.jsx`.
- Servicios: `frontend/src/services/routines.service.js`.
- Ficha de socios: `frontend/src/pages/Members.jsx`.

---

## 5. Qué hace el socio (ejecución)

El socio entra por un **link con token** (sin usuario ni contraseña). El portal
(`MemberPortalLayout`) trae toda su información con `getPublicRoutine(token)` y la
comparte por contexto; la pestaña **"Rutina"** monta `MemberWorkout`.

En `MemberWorkout` el socio:

- Ve la lista de ejercicios de su rutina activa, con series/reps/peso y notas.
- **Marca cada serie** como hecha → `toggleWorkoutSet(token, …)`.
- Usa **temporizadores de descanso**: entre series, al finalizar un ejercicio y
  antes del próximo (según cómo se configuró cada fila).
- Ve una **barra de progreso** (series hechas sobre el total).

Si el socio está **bloqueado** (ver §7), la pantalla le muestra la rutina pero el
`POST` de progreso responde **403 "Acceso suspendido por falta de pago."**.

El link del portal usa el **token vigente** del socio. El sistema acepta también
el token de **una generación anterior** (gracia de ACC-18) para no romper un
link ya compartido cuando el token rota; un token de dos rotaciones atrás queda
invalidado. Si el socio fue **eliminado** (baja lógica con `deleted_at`), su
token da **404** en todos los endpoints públicos (ACC-20). Un socio **inactivo**
pero no eliminado sigue entrando al portal: es una decisión de negocio del
portal completo, no un bug de rutinas.

### Referencia
- Portal: `frontend/src/pages/member/MemberPortalLayout.jsx · MemberPortalLayout`.
- Workout: `frontend/src/pages/member/MemberWorkout.jsx · MemberWorkout`.
- Servicios: `frontend/src/services/routines.service.js`.
- Endpoints públicos: `backend/routines/views.py · PublicRoutineView`,
  `backend/routines/views.py · PublicWorkoutProgressView`.
- Resolución del token: `backend/members/models.py · portal_member_or_404`,
  `backend/members/models.py · resolve_public_portal_member`,
  `backend/members/models.py · portal_token_q`.
- Bloqueo: `backend/members/eligibility.py · MemberEligibility.can_operate`.

---

## 6. Progreso y registro

El progreso se guarda en `WorkoutSet`. Cada registro tiene:

- La **asignación** y el **ejercicio de rutina** al que pertenece.
- El **número de serie**.
- Si está **completada** (`completed`) y **cuándo** (`completed_at`).
- La **fecha** (`date`), que por defecto es **la fecha de hoy**.

Hay una restricción que impide repetir el mismo `(asignación, ejercicio, serie,
fecha)`: marcar y desmarcar actualiza el mismo registro (`update_or_create`), no
crea duplicados.

Punto clave: **sólo se registra el entrenamiento de hoy.** La fecha no se elige:
siempre es `timezone.localdate()`. No hay historial entre días ni un "entrené el
lunes". El progreso que ve el socio **se reinicia cada día** (RUT-08, decisión de
negocio).

Tampoco se guarda el peso o las repeticiones **reales** que hizo: eso es texto
libre en la rutina, no un dato de la sesión.

### Referencia
- Modelo: `backend/routines/models.py · WorkoutSet`.
- Vista pública de progreso: `backend/routines/views.py · PublicWorkoutProgressView`.
- Serializer: `backend/routines/serializers.py · WorkoutSetSerializer`.
- Pantalla: `frontend/src/pages/member/MemberWorkout.jsx · MemberWorkout`.

---

## 7. Permisos y accesos

Hay **cuatro** niveles, y conviene no confundirlos:

1. **Gestión con rol (backend).** Los cuatro ViewSets de gestión y el
   `bulk-assign` pasan por `require_routine_manager`. Pueden gestionar
   **dueño, staff y profesor**; el **trainer recibe 403** con el mensaje
   `errors.routine_role_required`. Esto cubre crear/editar/borrar ejercicios,
   plantillas y filas, asignar en lote y desactivar asignaciones.
2. **Lectura autenticada sin rol (backend).** `GET member/<id>/`,
   `GET active/` y `GET member/<id>/whatsapp/` sólo exigen `IsAuthenticated`.
   **No** llaman a `require_routine_manager`. Por eso un **trainer** puede leer
   la rutina de cualquier socio del gimnasio, listar todas las asignaciones
   activas y obtener el mensaje de WhatsApp con el teléfono del socio. Es una
   **Limitación** del sistema actual, no una decisión de negocio declarada (§9).
3. **Interfaz (staff).** La ruta `/routines` está envuelta en
   `RoutineManagerRoute`: trainer → `/trainer-agenda`, y cualquier rol fuera de
   dueño/staff/profesor → `/dashboard`. El gating de la pantalla es sólo visual:
   no reemplaza el control del backend.
4. **Público (socio, sin login).** `public/<token>/` y
   `public/<token>/progress/` **no piden autenticación** (sólo límites de
   frecuencia). El token es la única credencial. El primer endpoint devuelve un
   payload grande: la rutina, las suscripciones, los pagos, la deuda, la
   asistencia y el estado de acceso. Es una **Decisión** de negocio (RUT-06): el
   token del portal ES la credencial del socio y el portal necesita esos datos
   para operar.

El **estado de acceso** del socio (si puede entrenar o no) sale de
`MemberEligibility.block_reason`: es la única fuente de verdad y también la usa
el `POST` de progreso. Posibles motivos de bloqueo: `inactive` (ficha inactiva),
`no_subscription` (ningún ciclo cubre hoy), `blocked` o `initial_pending`. Ojo:
`pending` y `overdue` **no** bloquean el entrenamiento.

Aparte, el **admin Django** de rutinas está recortado por gimnasio
(`GymScopedAdminMixin`, REF-08): un usuario con acceso al admin sólo ve las filas
de su gimnasio; el superusuario central ve todo.

### Referencia
- Gate de gestión: `backend/core/permissions.py · require_routine_manager`,
  `backend/core/permissions.py · is_routine_manager`,
  `backend/core/permissions.py · ROUTINE_MANAGER_ROLES`,
  `backend/routines/views.py · RoutineManagerMixin`.
- ViewSets y lecturas: `backend/routines/views.py · ExerciseViewSet`,
  `backend/routines/views.py · RoutineTemplateViewSet`,
  `backend/routines/views.py · RoutineAssignmentViewSet`,
  `backend/routines/views.py · RoutineExerciseViewSet`,
  `backend/routines/views.py · MemberRoutineView`,
  `backend/routines/views.py · ActiveRoutinesView`,
  `backend/routines/views.py · MemberRoutineWhatsappView`,
  `backend/routines/views.py · BulkAssignRoutineView`.
- Scoping por gym: `backend/core/mixins.py · GymQuerysetMixin`,
  `backend/core/viewsets.py · GymModelViewSet`.
- Ruta frontend: `frontend/src/App.jsx · RoutineManagerRoute`.
- Payload público: `backend/routines/views.py · PublicRoutineView`,
  `backend/routines/views.py · PublicWorkoutProgressView`,
  `backend/routines/serializers.py · MemberPortalSerializer`.
- Elegibilidad: `backend/members/eligibility.py · MemberEligibility.block_reason`.
- Admin: `backend/routines/admin.py`, `backend/core/admin.py · GymScopedAdminMixin`.

---

## 8. Problemas que pueden pasar

1. **El alta directa de asignaciones devuelve 500 si el socio ya tiene una
   rutina activa.** `POST /api/routines/assignments/` (y un `PATCH` que reactive)
   no captura el `IntegrityError` de `uniq_active_routine_per_member`; el
   serializer sólo valida pertenencia al gimnasio y el handler global no lo
   traduce. El `bulk-assign` sí lo maneja y responde `400`. Propuesto para
   `BUGS.md`.
2. **El `bulk-assign` descarta socios en silencio.** Si un ID es de otro
   gimnasio, inexistente o de un socio eliminado, no se asigna y la respuesta
   sigue siendo `200` con `assigned_members` contando sólo los encontrados. El
   cliente no puede saber cuáles quedaron afuera. Propuesto para `BUGS.md`.
3. **El trainer puede leer datos que no gestiona** (Limitación, no bug): rutina
   del socio, listado de asignaciones activas y WhatsApp con teléfono. La
   gestión sí está bloqueada; la lectura no.
4. **Dos ejercicios o dos plantillas pueden llamarse igual** (Limitación): no hay
   unicidad de nombre ni validación en el serializer. La pantalla muestra ambos
   y el staff tiene que distinguirlos por descripción.
5. **Dos filas de una rutina pueden compartir `order`** (Limitación): no hay
   unicidad y el orden visual puede no ser el que el staff esperaba.

Las decisiones de negocio no son problemas: el payload público con datos
financieros (RUT-06), el reinicio diario del progreso (RUT-08) y el acceso de
socios inactivos al portal están documentados como tales en §7, §6 y §9.

### Referencia
- Alta directa y constraint: `backend/routines/views.py · RoutineAssignmentViewSet`,
  `backend/routines/models.py · RoutineAssignment`,
  `backend/routines/serializers.py · RoutineAssignmentSerializer`,
  `backend/config/api/exception_handler.py · api_exception_handler`.
- Descarte silencioso: `backend/routines/views.py · BulkAssignRoutineView`.
- Lecturas sin rol: `backend/routines/views.py · MemberRoutineView`,
  `backend/routines/views.py · ActiveRoutinesView`,
  `backend/routines/views.py · MemberRoutineWhatsappView`.
- Falta de unicidad: `backend/routines/models.py · Exercise`,
  `backend/routines/models.py · RoutineTemplate`,
  `backend/routines/serializers.py · ExerciseSerializer`,
  `backend/routines/serializers.py · RoutineTemplateSerializer`.
- Tests que fijan el comportamiento: `backend/routines/tests_phase_h.py`.

---

## 9. Lo que el sistema NO hace hoy (para no prometerlo en el manual)

- **Limitación: no exige rol para leer rutinas.** La gestión sí pide
  dueño/staff/profesor; la lectura de `member/<id>/`, `active/` y `whatsapp/`
  sólo pide login.
- **Limitación: no garantiza nombres únicos** de ejercicios ni de plantillas.
  Se pueden repetir dentro del mismo gimnasio.
- **Limitación: no garantiza un `order` único** dentro de una plantilla.
- **Decisión: no guarda historial de entrenamientos.** El progreso es siempre de
  hoy y se reinicia cada día (RUT-08).
- **Decisión: no guarda el peso ni las repeticiones reales** que hizo el socio.
  `reps` y `weight` son texto libre de la rutina.
- **Limitación: no valida que `reps` y `weight` sean números.** Acepta "10-12",
  "al fallo" o "30 seg" a propósito.
- **Decisión: no está gated por feature.** `backend/gyms/features.py` no incluye
  rutinas: el módulo está disponible para todos los gimnasios.
- **Decisión: no notifica al socio.** El staff arma y copia el link de WhatsApp
  a mano desde la ficha; no hay email, push ni envío automático.
- **Decisión: no autoasigna rutinas.** Todo se carga desde el panel.
- **Decisión: no hay cupones ni descuentos** asociados a la rutina.

---

## 10. Notas de entorno para leer el código

- Zona horaria `America/Argentina/Buenos_Aires`
  (`backend/config/settings.py · TIME_ZONE`): define qué es "hoy" para el
  progreso.
- Los ViewSets de gestión filtran por el gimnasio del usuario
  (`backend/core/mixins.py · GymQuerysetMixin`,
  `backend/core/viewsets.py · GymModelViewSet`); el portal público entra por el
  token del socio.
- La app **no tiene** `services.py` ni `permissions.py` propios: la lógica vive
  en las vistas y el gate de rol en `backend/core/permissions.py`.
- Migraciones: `backend/routines/migrations/0001` a `0010`. La `0009` agrega el
  soft delete (`is_active`) y la `0010` el índice único parcial
  `uniq_active_routine_per_member`.
- Tests: `backend/routines/tests_phase_h.py` (16 tests: rol, soft delete,
  unicidad, lote atómico, ejercicio inactivo). Fuera de ese archivo la app no
  tiene más cobertura.
- Admin: `backend/routines/admin.py` usa `GymScopedAdminMixin` (REF-08).
- Datos de ejemplo: `backend/seed/data/exercises.py`,
  `backend/seed/data/routines.py`.
- App instalable (PWA) del portal: id `/routine/`
  (`backend/gyms/views.py · PwaMemberManifestView`).
- Flujo dev relacionado: `frontend/src/dev/RoutinesFlow.jsx` (página interactiva
  de este mismo documento). Para "recuperar", ver
  `AUDITORIA-RECUPERACION.md`.
