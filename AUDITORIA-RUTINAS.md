# Auditoría de Rutinas — Cómo funciona hoy la creación, asignación y ejecución de rutinas

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Escrito en lenguaje simple para servir de base a un manual de gimnasios. Las
> referencias de código van aparte, en letra chica, para no ensuciar el texto.
> Cubre **las rutinas de entrenamiento** (el plan que el gimnasio le arma a un
> socio). No confundir con **entrenamiento personal** (otro módulo, ver §1) ni con
> **recuperar clases/sesiones** (ver `AUDITORIA-RECUPERACION.md`).

---

## 1. Qué es una rutina (y qué no)

Una **rutina** es el plan de entrenamiento que el gimnasio le asigna a un socio.
Se arma con cinco piezas, siempre en este orden:

| Pieza | Qué es |
|-------|--------|
| **Ejercicio** (`Exercise`) | El movimiento del catálogo ("Press banca", "Sentadilla"). Es único por gimnasio. |
| **Plantilla de rutina** (`RoutineTemplate`) | Un plan con nombre ("Full body 3 días"). Agrupa una lista ordenada de ejercicios. |
| **Ejercicio de rutina** (`RoutineExercise`) | Una fila del plan: qué ejercicio, en qué orden, cuántas series y repeticiones, cuánto descanso. |
| **Asignación** (`RoutineAssignment`) | El enganche entre una plantilla y un socio. Es lo que hace que el socio "tenga" esa rutina. |
| **Registro** (`WorkoutSet`) | Cada serie que el socio marca como hecha mientras entrena. |

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
- Modelos: `backend/routines/models.py` — `Exercise` `:28-82`, `RoutineTemplate` `:85-114`, `RoutineExercise` `:117-209`, `RoutineAssignment` `:212-245`, `WorkoutSet` `:248-285`.
- Registro del módulo: `backend/config/settings.py:158`, `backend/config/urls.py:37` (`api/routines/`).
- Portal del socio: `frontend/src/App.jsx:121-133` (rutas `/routine/:token/*`).

---

## 2. El catálogo de ejercicios

El **catálogo** es la lista de movimientos disponibles del gimnasio. Cada
`Exercise` tiene:

- **Nombre** (obligatorio, hasta 100 caracteres).
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
- `backend/routines/models.py:28-82` (`Exercise`; categorías `:29-39`; `delete()` `:79-82`).
- Soft delete: `models.py:8-25` (`SoftDeleteQuerySet`, `SoftDeleteManager`, `AllObjectsManager`).
- `backend/routines/serializers.py:14-18` (`ExerciseSerializer`).
- `backend/routines/views.py:53-56` (`ExerciseViewSet`).
- Pantalla: `frontend/src/components/routines/ExerciseForm.jsx:3-14`, `ExerciseList.jsx:3-13`.

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
| `rest_mode` | Cuándo descansar: `entre series`, `al finalizar el ejercicio`, o `sin descanso`. |
| `next_exercise_rest_seconds` | Descanso extra antes del próximo ejercicio. |
| `exercise_type` | Tipo: `fuerza`, `peso corporal` o `cardio`. Cambia cómo se muestra en el portal. |

Reordenar es cambiar el `order`. Renombrar la rutina es editar la plantilla.
Borrar una fila de rutina es borrado lógico (queda inactiva).

### Referencia
- `backend/routines/models.py:117-209` (`RoutineExercise`; tipos `:118-122`; modos de descanso `:124-128`; campos `:143-192`).
- `backend/routines/serializers.py:57-93` (`RoutineExerciseSerializer`).
- Endpoints: `backend/routines/views.py:59-62` (`RoutineTemplateViewSet`), `:70-80` (`RoutineExerciseViewSet`).
- Pantalla: `frontend/src/components/routines/RoutineBuilder.jsx:4-14`, `RoutineTemplateForm.jsx`, `RoutineTemplateList.jsx`.

---

## 4. Cómo se asigna a un socio

La asignación se hace **en lote** desde la pestaña "Asignaciones": el staff elige
una plantilla y uno o varios socios, y confirma. El endpoint
`POST /api/routines/bulk-assign/` recibe `{ member_ids, routine_template }` y,
**por cada socio**:

1. **Desactiva** cualquier asignación activa previa del socio.
2. **Crea** una asignación nueva (`active = True`) con la plantilla elegida.

El resultado que ve el staff es "una sola rutina activa por socio". Pero eso es
una **convención de la interfaz**, no una regla de la base de datos: no hay
restricción de unicidad que impida dos activas, y el bucle del alta **no abre
transacción ni bloqueo**. Un doble envío simultáneo puede dejar estados raros
(ver §8).

También se puede desactivar una asignación suelta con un `PATCH active=false`.
La interfaz **no usa el DELETE** de asignaciones (y si lo usara, sería un borrado
**duro**, porque `RoutineAssignment` no tiene borrado lógico).

### Referencia
- `backend/routines/views.py:272-337` (`BulkAssignRoutineView`; desactivar + crear `:313-332`).
- `backend/routines/views.py:65-67` (`RoutineAssignmentViewSet`), `:244-267` (`ActiveRoutinesView`).
- `backend/routines/models.py:212-245` (`RoutineAssignment`, sin `unique_together`).
- `backend/routines/serializers.py:28-54` (`RoutineAssignmentSerializer`), `:151-196` (`ActiveRoutineSerializer`).
- Pantalla: `frontend/src/components/routines/RoutineAssignment.jsx`, `ActiveRoutines.jsx`, `MemberRoutineModal.jsx`.
- Servicios: `frontend/src/services/routines.service.js:102` (`getActiveRoutines`), `:112` (`bulkAssignRoutine`), `:125` (`deactivateAssignment`).

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

Si el socio está **bloqueado** (ver §7), la pantalla le impide registrar: el
`POST` de progreso responde **403 "Acceso suspendido por falta de pago."**.

### Referencia
- Portal: `frontend/src/pages/member/MemberPortalLayout.jsx:19`, `:169-205` (carga `routine`), `:448` (contexto).
- Workout: `frontend/src/pages/member/MemberWorkout.jsx:17-69` (`RestTimer`), `:71-94` (carga de progreso), `:96` (lista de ejercicios).
- Servicios: `frontend/src/services/routines.service.js:144` (`getWorkoutProgress`), `:148` (`toggleWorkoutSet`), `:162` (`getPublicRoutine`).
- Endpoints: `backend/routines/views.py:83-116` (`MemberRoutineView`), `:340-412` (`PublicWorkoutProgressView`).
- Bloqueo: `backend/routines/views.py:365-369`.

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
lunes". El progreso que ve el socio **se reinicia cada día**.

Tampoco se guarda el peso o las repeticiones **reales** que hizo: eso es texto
libre en la rutina, no un dato de la sesión.

### Referencia
- `backend/routines/models.py:248-285` (`WorkoutSet`; `date` `:272-275`; `unique_together` `:280-285`).
- `backend/routines/views.py:354-357` (filtra por `timezone.localdate()`), `:400-409` (`update_or_create`).
- `backend/routines/serializers.py:242-252` (`WorkoutSetSerializer`).
- `frontend/src/pages/member/MemberWorkout.jsx:71-94`.

---

## 7. Permisos y accesos

Hay tres niveles, y conviene no confundirlos:

1. **Staff (con login).** Los endpoints de rutinas piden **sólo estar
   autenticado** (`IsAuthenticated`) y filtran por el gimnasio del usuario
   (`GymQuerysetMixin`). **No chequean el rol**: existe un helper `require_owner`
   (sólo dueño), pero en rutinas **no se usa**. Es decir, cualquier usuario
   autenticado del gimnasio (dueño, profesor, etc.) puede crear/editar/borrar
   ejercicios y plantillas, y asignar rutinas.
2. **Interfaz (staff).** El gating por rol es **sólo visual**: `HomeRedirect` y
   `ProfessorRoute` empujan a ciertos usuarios, pero la ruta `/routines` **no**
   está envuelta en `ProfessorRoute`, así que cualquier rol autenticado puede
   abrirla.
3. **Público (socio, sin login).** Los endpoints `public/<token>/` y
   `public/<token>/progress/` **no piden autenticación** (sólo un límite de
   frecuencia). El token es la única credencial. El primer endpoint devuelve un
   payload grande: la rutina, las suscripciones, los pagos, la deuda y el estado
   de acceso.

El **estado de acceso** del socio (si puede entrenar o no) sale de
`MemberEligibility.block_reason`: es la única fuente de verdad y también la usa
el POST de progreso. Posibles motivos de bloqueo: `inactive` (ficha inactiva),
`no_subscription` (ningún ciclo cubre hoy), `blocked` o `initial_pending`. Ojo:
`pending` y `overdue` **no** bloquean el entrenamiento.

### Referencia
- Endpoints staff: `backend/routines/views.py:53-80`.
- Scoping por gym: `backend/core/mixins.py:4-22`; `backend/core/viewsets.py:5-7`.
- `require_owner` (no usado acá): `backend/core/permissions.py:20-31`.
- Endpoints públicos: `backend/routines/views.py:340-412`, `:425-831`.
- Ruta frontend sin `ProfessorRoute`: `frontend/src/App.jsx:189`; gating visual `:85-107`.
- Elegibilidad: `backend/members/eligibility.py:31-77`.

---

## 8. Posibles bugs / desajustes (documentar, no arreglar)

1. **Sin control de rol en el backend.** Cualquier usuario autenticado del gym
   puede administrar el catálogo y asignar rutinas: no se llama a `require_owner`.
   — `backend/routines/views.py:53-80`, `:272-337`.
2. **Asignación con DELETE duro.** `RoutineAssignment` no tiene borrado lógico y
   el ViewSet expone `DELETE`. — `backend/routines/models.py:212-245`,
   `backend/routines/views.py:65-67`.
3. **Sin unicidad de rutina activa + alta sin transacción.** Nada impide dos
   asignaciones activas para el mismo socio, y el bucle de `bulk-assign` no es
   atómico ni bloquea: un doble envío puede dejar estados intermedios.
   — `backend/routines/models.py:212-245`, `backend/routines/views.py:313-332`.
4. **Ejercicios borrados que igual aparecen.** `MemberRoutineSerializer.get_exercises`
   no filtra `is_active`, así que un ejercicio desactivado puede seguir mostrándose
   en la rutina del socio. — `backend/routines/serializers.py:132-148`.
5. **`RoutineExerciseViewSet` no usa `GymModelViewSet`.** A diferencia de los otros
   tres ViewSets, hereda de `ModelViewSet` y **no inyecta el gym** en el alta;
   depende sólo de la validación del serializer. — `backend/routines/views.py:70-80`.
6. **Endpoints públicos sin autenticación.** `public/<token>/` y su progreso no
   piden login (sólo throttle) y el payload incluye rutina, pagos, deuda y acceso.
   — `backend/routines/views.py:340-412`, `:425-831`.
7. **Sin tests.** No existe `backend/routines/tests.py` (sólo hay un `.pyc` viejo en
   `__pycache__`). Es una de las pocas apps sin cobertura.
8. **Registro sólo de hoy.** El progreso usa siempre la fecha actual y no hay
   historial de entrenamientos. — `backend/routines/views.py:365-369`,
   `backend/routines/models.py:272-275`.
9. **Ruta `/routines` sin `ProfessorRoute`.** Cualquier rol autenticado puede abrir
   la pantalla de rutinas. — `frontend/src/App.jsx:189`.
10. **Trampa de nombres (no es un bug).** `frontend/src/pages/PublicRoutine.jsx` es
    la página de **horarios**, no el workout; el workout real es
    `frontend/src/pages/member/MemberWorkout.jsx`.

---

## 9. Lo que el sistema NO hace hoy

- No exige un rol para crear/editar/asignar rutinas.
- No garantiza en la base una sola rutina activa por socio.
- No guarda historial de entrenamientos (sólo de hoy) ni el peso/reps reales hechos.
- No valida que `reps` y `weight` sean números (son texto libre).
- No tiene tests automáticos.
- No está gated por feature (`gyms/features.py` no incluye rutinas).
- No hay notificación al socio: sólo el link de WhatsApp que arma el staff.

---

## 10. Notas de entorno para leer el código

- Zona horaria `America/Argentina/Buenos_Aires` (`backend/config/settings.py:461`):
  define qué es "hoy" para el progreso.
- Los ViewSets de rutinas filtran por el gimnasio del usuario (`backend/core/mixins.py:4-22`).
- La app **no tiene** `services.py`, `permissions.py` ni `tests.py`: toda la lógica
  vive en las vistas.
- Migraciones: `backend/routines/migrations/0001` … `0009`.
- Datos de ejemplo: `backend/seed/data/exercises.py`, `backend/seed/data/routines.py`.
- App instalable (PWA) del portal: id `/routine/` (`backend/gyms/views.py:76`).
- Flujo dev relacionado: `frontend/src/dev/RoutinesFlow.jsx` (página interactiva
  de este mismo documento). Para "recuperar", ver `AUDITORIA-RECUPERACION.md`.
