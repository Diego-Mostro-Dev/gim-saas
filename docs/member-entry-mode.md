# Member Entry Mode — Architecture

> **Actualizado según la nueva visión funcional del onboarding — 2026-06-26**
>
> Este documento describe la implementación técnica del campo `entry_mode`.
>
> **Contexto actual:** `entry_mode` ya no es el eje del producto. La nueva visión
> se basa en **servicios contratados** (gimnasio, actividades). `entry_mode`
> se mantiene como campo técnico para compatibilidad hacia atrás y como guía
> para el frontend, pero la lógica de negocio debe inspeccionar los datos
> reales (AttendanceSchedule, Enrollment, etc.).
>
> Para la especificación funcional actualizada, ver
> [`docs/specs/member-services-and-onboarding.md`](./specs/member-services-and-onboarding.md).
> Para las reglas del módulo de actividades, ver
> [`docs/activities-rules.md`](./activities-rules.md).

---

## Propósito Actual

`entry_mode` es un campo en `Member` que indica el camino de registro del miembro.

Ya no representa "el tipo de miembro". Representa cómo se registró:
- `GYM` — el miembro seleccionó gimnasio durante el registro (con o sin actividades)
- `ACTIVITY_ONLY` — el miembro seleccionó solo actividades

El default `GYM` garantiza compatibilidad total hacia atrás con miembros existentes
(que fueron creados antes de que existiera el campo).

## Limitaciones Conocidas

| Aspecto | Limitación |
|---------|------------|
| Member | entry_mode no expresa combinaciones de servicios |
| AttendanceSchedule | No hay restricción de modelo que impida asignar horarios a ACTIVITY_ONLY |
| Activities | Las validaciones detectan services implícitamente (AttendanceSchedule.exists()) |
| Portal | Antes dependía de entry_mode; ahora debe depender de servicios contratados |

## Análisis Realizado (HISTÓRICO)

> Esta sección documenta el análisis que llevó a la creación de `entry_mode`.
> Se mantiene como registro histórico.

Se evaluaron 4 alternativas:

### Alternativa A — `entry_mode` como CharField en Member (implementada)

```python
class Member(models.Model):
    class EntryMode(models.TextChoices):
        GYM = "GYM", "Gimnasio"
        ACTIVITY_ONLY = "ACTIVITY_ONLY", "Solo actividades"

    entry_mode = models.CharField(
        max_length=20,
        choices=EntryMode.choices,
        default=EntryMode.GYM,
    )
```

**Pros:**
- Simplicidad máxima: un campo, sin tablas adicionales
- Default `GYM` garantiza compatibilidad total hacia atrás
- Fácil de consultar
- Bajo acoplamiento

**Contras:**
- No escala a combinaciones de servicios
- La lógica de negocio debe chequear datos reales, no entry_mode

### Alternativa B — `is_gym_member` booleano
### Alternativa C — `MemberType` como modelo separado
### Alternativa D — Detección implícita por plan/asistencia

> Ver análisis completo en el historial de git o en la versión anterior del documento.

## Decisión Tomada (original)

Se implementó `entry_mode` como CharField en Member con choices `GYM` y `ACTIVITY_ONLY`,
default `GYM`. Esta decisión sigue siendo válida técnicamente, pero el rol del campo
cambió: ya no es el discriminador principal del sistema.

## Estado Actual del Código

### Modelo (`backend/members/models.py`)
- `EntryMode` enum con `GYM` y `ACTIVITY_ONLY`
- `entry_mode = CharField(max_length=20, choices=EntryMode.choices, default=EntryMode.GYM)`
- Migración: `0009_member_entry_mode.py` (pendiente de aplicar en DB)

### Serializer (`backend/members/serializers.py`)
- `entry_mode` agregado a `MemberSerializer.fields`
- **No está en `read_only_fields`** — es writable (contradice documentación anterior)
- `access_token` **no está en fields** — bug conocido, hay que agregarlo

### API
- `GET /api/members/` y `GET /api/members/:id/` incluyen `entry_mode`
- `POST /api/members/` y `PATCH /api/members/:id/` aceptan `entry_mode`

## Impacto sobre Attendance

**Ningún cambio estructural.** AttendanceSchedule sigue funcionando igual.
Los miembros ACTIVITY_ONLY no tienen AttendanceSchedule (es un dato, no una
restricción de modelo).

## Impacto sobre Activities

La validación de superposición en `backend/activities/services.py` usa
`AttendanceSchedule.objects.filter(member=member, active=True).exists()`
para detectar si el miembro tiene servicio de gimnasio, NO usa `entry_mode`.

Esto es correcto: la lógica inspecciona datos reales, no el campo indicador.
Para miembros ACTIVITY_ONLY, la validación de superposición con gimnasio se omite
porque no tienen AttendanceSchedule.

> **Nota:** La documentación anterior decía que la validación usaba `entry_mode`.
> Esto era incorrecto. El código siempre usó AttendanceSchedule.exists().

## Impacto sobre Portal

### Arquitectura actual (transicional)

Actualmente el portal usa `entry_mode` para decidir el dashboard y las tabs.
Esto funciona porque hay una correlación directa entre entry_mode y servicios
(ACTIVITY_ONLY → solo actividades; GYM → gimnasio ± actividades).

**A futuro** (Sprint 3), el portal debe migrar a inspeccionar servicios contratados:
- `AttendanceSchedule.objects.filter(member=member, active=True).exists()` → tiene gimnasio
- `Enrollment.objects.filter(member=member, active=True).exists()` → tiene actividades

Esto permitirá que futuros servicios (nutrición, PT, rehab) agreguen módulos
sin modificar el portal.

### DashboardSelector (`frontend/src/pages/member/DashboardSelector.jsx`)
- Actualmente lee `routine.member.entry_mode` del contexto
- A futuro debe inspeccionar los datos reales en `routine`

### MemberPortalLayout (`frontend/src/pages/member/MemberPortalLayout.jsx`)
- Actualmente usa `member.entry_mode` para decidir tabs
- A futuro debe decidir según existencia de datos (schedules, routine, enrollments)

### PublicRoutineView (`backend/routines/views.py`)

**Estado actual:**
- Para miembros GYM: requiere RoutineAssignment (404 si no tiene)
- Para miembros ACTIVITY_ONLY: no requiere RoutineAssignment (routine: null)

**Estado deseado (Sprint 2):**
- Para TODOS los miembros: no requiere RoutineAssignment
- `routine` puede ser `null` en la respuesta
- La decisión NO debe basarse en `entry_mode`
- El portal carga siempre, con `routine: null` si no hay rutina asignada

### Flujo de decisión actual (a reemplazar)

```
GET /api/routines/public/:token/
  │
  └── Buscar RoutineAssignment activa
        ├── Existe → response con routine data
        └── No existe → routine: null en el response
```

Sin bifurcación por entry_mode ni 404.

## Regresiones Detectadas

### 500 en `GET /api/routines/public/<token>/`

**Causa raíz:** La migración `0009_member_entry_mode.py` fue creada y comiteada, pero
**nunca aplicada** a la base de datos. El campo `entry_mode` no existía como columna.

**Resolución:** Ejecutar `python manage.py migrate members 0009`.

**Endpoints afectados:**
- `GET /api/routines/public/<token>/`
- `GET /api/attendance/schedule-change-requests/`
- Cualquier view que acceda a `member.entry_mode` o haga `select_related("member")`

### Bug: access_token no visible en MemberSerializer

`MemberSerializer.Meta.fields` no incluye `access_token`. Cualquier respuesta
del serializer no contiene el token de acceso al portal. Hay que agregarlo.

### Bug: MemberPortalSerializer.routine no acepta null

`routine = serializers.DictField()` serializa `None` como `{}`.
Debe ser `DictField(allow_null=True)` para que `routine` sea `null` en la respuesta.

## Reglas de Negocio para Miembros ACTIVITY_ONLY

1. No tienen horarios fijos del gimnasio (no `AttendanceSchedule`)
2. No registran asistencia (no `Attendance`)
3. No tienen rutina asignada (no `RoutineAssignment`)
4. Pueden inscribirse en actividades sin validación de superposición con gimnasio
5. Ven un portal reducido (solo Actividades y Pagos)
6. Tienen Subscription (paid=false) — ver decisiones pendientes sobre plan
7. El dashboard de inicio muestra: actividades activas, próximas actividades, estado de pagos

---

## [HISTÓRICO] Secciones reemplazadas

> Las siguientes secciones de la versión anterior del documento ya no aplican
> a la visión actual del producto.

### Reemplazado: "Problema Actual" (líneas 7-33 de la versión anterior)

El problema original era que el sistema no podía distinguir entre tipos de miembros.
Eso ya no es relevante porque el sistema ahora se basa en servicios, no en tipos.

### Reemplazado: entry_mode como discriminador del portal

La sección "Impacto sobre Portal" describía un portal que bifurcaba según entry_mode.
Ahora el portal debe bifurcar según servicios contratados.

### Reemplazado: Alternativas de implementación

El análisis de alternativas (A-D) fue la justificación para crear entry_mode.
Sigue siendo válido como documento histórico pero no refleja la dirección actual.
