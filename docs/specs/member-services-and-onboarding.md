# Member Services & Onboarding — Functional Specification

> **Actualizado según la visión multi-servicio — 2026-06-29**
>
> Este documento describe la especificación funcional del producto. Para la
> arquitectura de dominio completa (modelo de negocio, ciclo de facturación,
> estabilidad contractual, roadmap, migración), ver
> [`docs/architecture/multi-service-domain.md`](../architecture/multi-service-domain.md).
> 
> Para la arquitectura técnica de `entry_mode`, ver [`docs/member-entry-mode.md`](../member-entry-mode.md).
> Para las reglas del módulo de actividades, ver [`docs/activities-rules.md`](../activities-rules.md).

---

## Objetivo

### Qué problema resuelve el sistema

GymDev es una plataforma SaaS para administración de gimnasios y centros de fitness.
Originalmente fue diseñada para un solo perfil de cliente: el socio tradicional que
asiste al gimnasio, tiene un plan mensual, horarios fijos y una rutina de
entrenamiento asignada.

Ese modelo cubre un segmento del mercado, pero deja fuera a una cantidad creciente
de clientes que buscan servicios más flexibles:

- Personas que solo quieren asistir a **actividades** (yoga, funcional, pilates)
  sin compromiso de gimnasio tradicional.
- Clientes que necesitan servicios especializados como **rehabilitación**,
  **personal trainer**, **nutrición** o **crossfit**.
- Personas que quieren **combinar** el gimnasio con actividades extra.

El sistema necesita evolucionar para soportar todos estos perfiles sin perder
la robustez que ya tiene para el socio de gimnasio tradicional.

### Modelo conceptual

Ya no existen "tipos de miembros". Existe un único modelo `Member` que puede
contratar uno o más servicios:

| Servicio | Descripción | Ejemplo |
|----------|-------------|---------|
| Gimnasio | Plan de suscripción, horarios fijos, rutina, asistencia QR | Juan entrena 4 días/semana |
| Actividades | Inscripción a actividades grupales con cupo | María hace yoga 2 días/semana |
| FUTURO: Nutrición | Plan alimenticio, consultas con nutricionista | Ana consulta con nutricionista |
| FUTURO: PT | Sesiones 1:1 con personal trainer | Carlos tiene sesiones personalizadas |
| FUTURO: Rehab | Sesiones de rehabilitación o kinesiología | Laura hace sesiones de recuperación |

Los servicios se seleccionan durante el registro y el sistema crea los registros
correspondientes. No hay un campo "tipo de miembro" que determine el comportamiento.
El comportamiento se determina inspeccionando qué servicios tiene contratados el
miembro (AttendanceSchedule para gimnasio, Enrollment para actividades, etc.).

### entry_mode

El campo `entry_mode` en `Member` se mantiene por compatibilidad hacia atrás con
default `GYM`. Ya no es el eje del producto. Su propósito es:

- Permitir que el frontend adapte el onboarding según los servicios seleccionados
- Servir como indicador histórico de cómo se registró el miembro
- Mantener compatibilidad con código existente que lo consulta

El valor de `entry_mode` se asigna así durante el registro:
- Si selecciona GYM (con o sin actividades) → `GYM`
- Si selecciona solo ACTIVIDADES → `ACTIVITY_ONLY`

> **Importante:** La lógica de negocio NO debe tomar decisiones basadas en
> `entry_mode`. Debe inspeccionar los datos reales (AttendanceSchedule.exists(),
> Enrollment.exists(), etc.). `entry_mode` es solo una guía para el frontend.

### Cómo evolucionará el producto

1. **Capa base** — Gimnasio tradicional
2. **Capa actividades** — Módulo de actividades extra
3. **Capa onboarding** — Registro con selector de servicios (Sprint 2)
4. **Capa portal modular** — Portal que renderiza según servicios contratados
5. **Capa servicios contratados** — Modelo ContractedService (futuro)

---

## Servicios disponibles

### Gimnasio

- Plan de suscripción con precio, duración, visitas semanales
- Horarios fijos (AttendanceSchedule): días y horas que el socio asiste
- Rutina de entrenamiento (RoutineAssignment + ejercicios)
- Registro de asistencia (Attendance) con QR
- Dashboard con progreso y métricas

### Actividades

- Catálogo de actividades (yoga, funcional, pilates, etc.)
- Horarios por actividad con capacidad y cupo
- Inscripción del miembro a actividades individuales
- Validación de superposición entre actividades
- Sin horarios fijos de gimnasio, sin rutina, sin asistencia

### Combinación (Gimnasio + Actividades)

Un miembro puede tener ambos servicios simultáneamente:
- Plan de gimnasio con horarios fijos
- Inscripciones a actividades extra
- Se valida que las actividades no se superpongan con los horarios del gimnasio

### Futuro

Cada nuevo servicio se implementa como un módulo independiente con su propia
lógica de negocio, solapándose únicamente donde tenga sentido (validación de
horarios, facturación unificada, perfil del miembro).

---

## Registro (Onboarding)

### Pantalla 1 — Selección de servicios

Cuando un nuevo usuario ingresa al link de registro, ve checkboxes de servicios:

```
¿Qué servicios querés contratar?

☐ Gimnasio
☐ Actividades

Debe haber al menos uno seleccionado.
[Siguiente]
```

Cada servicio seleccionado agrega los pasos correspondientes al wizard.
Si solo se selecciona uno, se omiten los pasos del otro.

### Paso común — Datos personales

Siempre visible, independientemente de los servicios seleccionados.

- Nombre
- Apellido
- Teléfono
- Email (opcional)
- Foto (opcional)

### Paso GYM — Selección de plan

Solo visible si "Gimnasio" está seleccionado.

- Lista de planes activos del gimnasio
- Cada plan muestra: nombre, precio, duración, visitas semanales
- Al seleccionar un plan se habilita la selección de horarios

### Paso GYM — Selección de horarios

Solo visible si "Gimnasio" está seleccionado.

- Checklist de días disponibles (lunes a sábado)
- Por cada día seleccionado, un desplegable con horarios disponibles
- Validación: no se pueden seleccionar más horarios que las visitas del plan

### Paso ACTIVIDADES — Selección de actividades

Solo visible si "Actividades" está seleccionado.

- Lista de actividades disponibles en el gimnasio
- Cada actividad muestra sus horarios directamente (no hay pantalla separada)
- Cada horario es un checkbox con: día, hora inicio-fin, cupos restantes
- No se muestran horarios con cupo completo
- Si también hay gimnasio: solo se muestran horarios compatibles (sin superposición)
- No se permite seleccionar horarios que se superpongan entre sí

**Ejemplo visual:**
```
Yoga
☐ Martes 10:00-11:00  (8 cupos disponibles)
☐ Jueves 18:00-19:00  (12 cupos disponibles)

Pilates
☐ Lunes 09:00-10:00  (5 cupos disponibles)
☐ Viernes 17:00-18:00  (Completo — no visible)

Funcional
☐ Miércoles 10:00-11:00  (3 cupos disponibles)
```

### Paso final — Confirmación

Resumen completo de todos los datos ingresados:

- Datos personales
- Plan de gimnasio + horarios (si aplica)
- Actividades seleccionadas + horarios (si aplica)
- Botón "Confirmar registro"

### Post-registro

1. Se crea `Member` con `access_token`
2. Se crea `Subscription` con `paid=false`
   - Se crea un `SubscriptionItem` por cada plan seleccionado (gimnasio, yoga, etc.)
3. Si tiene gimnasio: se crean `AttendanceSchedule` para los horarios elegidos
4. Si tiene actividades: se crean `Enrollment` para cada actividad/horario seleccionado
5. El miembro recibe su token de acceso al portal e ingresa inmediatamente

### Cálculo del pago inicial

El monto a pagar depende de la fecha de registro respecto al **día de cierre de facturación** del gimnasio.

**Escenario A — Registro antes o el mismo día del cierre**

El miembro paga el precio COMPLETO de cada servicio contratado. Sin prorrateo.

> Ejemplo: Día de cierre = 10. Registro el 3 de julio. Paga: Gym Premium + Yoga Mensual completos. Tiene hasta el día 16 (fin del período de gracia) para pagar.

**Escenario B — Registro después del día de cierre**

El miembro paga solo la parte proporcional desde la fecha de registro hasta el próximo cierre. Desde el próximo ciclo en adelante, paga el monto mensual normal.

> Ejemplo: Día de cierre = 10. Registro el 18 de julio. Paga proporcional 18 jul - 10 ago. Desde el 10 de agosto paga mes completo.

---

## Subscription

- **Siempre existe una Subscription** para cada miembro.
- `paid=false` al registrarse.
- La Subscription contiene **SubscriptionItems**, uno por cada servicio contratado.
- Cada SubscriptionItem referencia un `MembershipPlan` y un `Service`.
- No hay un sistema paralelo de pagos para actividades. Todo pasa por Subscription.
- El sistema de `can_member_operate` y `get_subscription_payment_status` se mantiene.

> **Nota:** Subscription.plan es actualmente FK no nullable a MembershipPlan. La migración a SubscriptionItem (Sprint 2) resuelve esto. Ver arquitectura para detalles.

### Ciclo de facturación

Cada gimnasio define:
- **Día de cierre**: el día del mes en que se cierra el ciclo de facturación.
- **Período de gracia**: días después del cierre durante los cuales el miembro sigue activo aunque no haya pagado.

El ciclo va del día de cierre del mes N al día de cierre del mes N+1. Cada factura mensual cubre exactamente un ciclo.

### Período de gracia

Durante el período de gracia el miembro está considerado **ACTIVO**. Aunque el pago esté pendiente, puede:
- Asistir al gimnasio
- Asistir a actividades
- Marcar asistencia
- Usar el portal completo
- Ver rutinas
- Solicitar cambios de horario
- Solicitar cambios de plan

Todo funciona con normalidad.

### Estado vencido (overdue)

Cuando el período de gracia expira sin pago, la suscripción pasa a **vencida** (bloqueada).

El miembro conserva:
- Acceso al portal (login, ver información)
- Estado de pago e historial
- Posibilidad de pagar
- Contacto del gimnasio

El miembro NO puede:
- Marcar asistencia (QR check-in)
- Inscribirse en actividades
- Acceder a rutinas de entrenamiento
- Solicitar cambios de plan
- Solicitar cambios de horario
- Consumir ningún servicio contratado

## Estabilidad contractual

Esta es una de las reglas de negocio más importantes.

Un servicio contratado NUNCA cambia durante el ciclo de facturación actual.

Si un miembro quiere:
- Agregar gimnasio
- Eliminar gimnasio
- Agregar yoga
- Eliminar yoga
- Cambiar plan de gimnasio
- Cambiar plan de yoga
- Modificar horarios de asistencia
- Cambiar inscripciones en actividades

la solicitud se almacena **inmediatamente**, pero se vuelve efectiva **al inicio del próximo ciclo de facturación**.

No existen:
- Cambios comerciales a mitad de ciclo
- Reembolsos
- Recalculos parciales
- Intercambios de servicios dentro del mismo ciclo

Esto mantiene la administración simple y preserva la planificación operativa.

### Únicas excepciones

Solo la información personal puede modificarse de inmediato:
- Teléfono
- Email
- Foto de perfil
- Preferencias del portal

Todo lo que afecte el contrato comercial espera al próximo ciclo.

---

## Portal del socio

### Principios

1. **El portal SIEMPRE existe.** No depende de que el miembro tenga rutina,
   horarios, plan ni actividades. Con solo tener un `access_token`, el portal carga.

2. **El portal carga al miembro.** La primera llamada (`GET /api/routines/public/<token>`)
   trae todo lo que el sistema sabe del miembro: datos personales, gym, entry_mode,
   suscripciones, horarios, rutina (puede ser null), actividades, pagos.

3. **El portal es modular.** Cada servicio contratado agrega módulos al portal.
   No se oculta contenido mediante condicionales basados en tipo de miembro:
   se renderizan los módulos que corresponden a los datos existentes.

### Comportamiento por servicios contratados

#### Solo gimnasio

| Módulo | Contenido |
|--------|-----------|
| Inicio | Dashboard con suscripción, plan, próximo entrenamiento, asistencias recientes, último pago, contacto |
| Rutina | Ejercicios asignados, series, repeticiones, pesos, notas (puede estar vacía si el admin no asignó) |
| Pagos | Historial de pagos, estado de suscripción, cambio de plan |
| Actividades | No visible (o visible con estado vacío "no estás inscrito en actividades") |
| Horarios | Horarios fijos del gimnasio, solicitud de cambio |

#### Solo actividades

| Módulo | Contenido |
|--------|-----------|
| Inicio | Dashboard con saludo, nombre del gimnasio, actividades activas, próximas actividades, estado de pagos, contacto |
| Pagos | Historial de pagos |
| Actividades | Inscripciones a actividades, cancelación |

Módulos NO visibles:
- Rutina (no existe para este miembro)
- Horarios de gimnasio (no existen)
- Asistencia (no aplica)

#### Gimnasio + actividades

Todos los módulos visibles (Inicio, Rutina, Pagos, Actividades, Horarios).
El dashboard de inicio combina información de ambos servicios.

### Modularidad futura

Cuando se agreguen nuevos servicios (nutrición, PT, rehabilitación), el
portal debe mostrar únicamente los módulos contratados por ese miembro.
Un miembro con solo nutrición vería: Inicio, Plan alimenticio, Pagos.
Un miembro con nutrición + PT vería: Inicio, Plan alimenticio,
Sesiones PT, Pagos.

---

## Reglas de negocio

### 1. Nunca permitir superposición entre gimnasio y actividades

Si un miembro tiene horarios de gimnasio (AttendanceSchedule) y quiere
inscribirse en una actividad, la actividad **no puede** superponerse con
ningún horario de gimnasio en el mismo día.

### 2. Nunca permitir superposición entre actividades

Un miembro no puede tener dos inscripciones activas en actividades cuyos
horarios se superpongan en el mismo día.

### 3. Nunca mostrar horarios completos

Si un horario de actividad tiene capacidad completa, no debe
aparecer como opción seleccionable en el registro ni en el portal del socio.

### 4. Nunca permitir reservar un horario sin cupo

Validación transaccional en backend para evitar race conditions.

### 5. El usuario solamente debe ver horarios compatibles

Filtrado inteligente: si ya tiene gimnasio un lunes 10:00, no se muestra
ninguna actividad que se superponga. Lo mismo aplica entre actividades.

---

## Roadmap

### Sprint 1 — entry_mode y portal (EJECUTADO)

- [x] Agregar campo `entry_mode` al modelo Member
- [x] Crear migración 0009 (pendiente de aplicar en DB)
- [x] Modificar PublicRoutineView para ACTIVITY_ONLY sin 404
- [x] Separar dashboards: GymDashboard y ActivityDashboard
- [x] DashboardSelector que lee entry_mode del contexto
- [x] Documentar arquitectura, regresiones, reglas

### Sprint 2 — Nuevo onboarding y ciclo de facturación (SIGUIENTE)

- [ ] Rediseñar pantalla de registro con selector de servicios (checkboxes)
- [ ] Wizard GYM: datos → plan → horarios → confirmación
- [ ] Wizard ACTIVITIES: datos → actividades → confirmación
- [ ] Wizard BOTH: datos → plan → horarios → actividades → confirmación
- [ ] Subscription siempre creada con SubscriptionItems por servicio
- [ ] Filtrado de horarios disponibles por cupo y compatibilidad
- [ ] Endpoint público de actividades con cupo (`GET /api/public/activities/<gym_code>/`)
- [ ] Formalizar ciclo de facturación: día de cierre, período de gracia, pago inicial
- [ ] Implementar lógica de pago inicial (completo antes del cierre, proporcional después)
- [ ] Implementar período de gracia (miembro activo con pago pendiente)
- [ ] Implementar estado vencido (portal preservado, servicios bloqueados)
- [ ] Crear modelo SubscriptionItem y migrar datos existentes
- [ ] Bug: agregar `access_token` a MemberSerializer.fields
- [ ] Bug: MemberPortalSerializer.routine = DictField(allow_null=True)
- [ ] Bug: PublicRoutineView no debe devolver 404 para GYM sin rutina
- [ ] Aplicar migración 0009 a la base de datos

### Sprint 3 — Estabilidad contractual y portal modular

- [ ] Implementar cambios diferidos: cambios almacenados hoy, efectivos próximo ciclo
- [ ] Actualizar PlanChangeRequest para respetar solo-próximo-ciclo
- [ ] Reserva de cupo para inscripciones futuras (active=False, effective_date)
- [ ] Job programado para ejecutar cambios pendientes al cierre del ciclo
- [ ] Portal muestra cambios futuros pendientes al miembro
- [ ] Refactorizar portal para que cargue independientemente de entry_mode
- [ ] Separar vistas en módulos independientes
- [ ] Cada módulo se renderiza según SubscriptionItems contratados
- [ ] Estado vacío para servicios no contratados

### Sprint 4 — Modelo Service y ContractedService

- [ ] Diseñar e implementar modelo Service
- [ ] Migrar MembershipPlan a FK → Service
- [ ] Diseñar e implementar modelo ContractedService
- [ ] Renombrar campos de Gym: payment_due_day → closing_day, access_block_day → grace_end_day
- [ ] Migrar entry_mode a ContractedService
- [ ] Deprecar entry_mode en Member
- [ ] Actualizar vistas para consultar ContractedService

### Sprint 5+ — Nuevos servicios (futuro)

- Nutrición, Personal Trainer, Rehabilitación, CrossFit, Pilates, etc.

---

## Casos de uso

### Caso 1: Juan — Solo gimnasio

**Perfil:** Hombre de 30 años, quiere ganar masa muscular.

**Flujo:**
1. Recibe link de registro del gimnasio
2. Selecciona "Gimnasio" (solo)
3. Completa datos personales
4. Selecciona plan "Mensual Premium" (4 visitas/semana)
5. Elige horarios: lunes 8:00, martes 8:00, jueves 8:00, viernes 8:00
6. Confirma registro

**Estado post-registro:**
- Member creado
- Subscription (paid=false) con plan Premium
- 4 AttendanceSchedule
- Sin enrollments en actividades
- Sin rutina (el admin la asigna después)

**Portal:** Ve Inicio, Rutina (vacía), Pagos, Horarios. Sin pestaña Actividades.

### Caso 2: María — Solo actividades (yoga)

**Perfil:** Mujer de 40 años, no quiere gimnasio, solo quiere hacer yoga.

**Flujo:**
1. Recibe link de registro del gimnasio
2. Selecciona "Actividades" (solo)
3. Completa datos personales
4. Ve actividades disponibles: Yoga, Funcional, Pilates
5. Selecciona Yoga → elige martes 10:00-11:00 y jueves 10:00-11:00
6. Confirma

**Estado post-registro:**
- Member creado (entry_mode = ACTIVITY_ONLY)
- Subscription (paid=false) — plan pendiente de definir
- Sin AttendanceSchedule
- 2 Enrollment en Yoga
- Sin rutina

**Portal:** Ve Inicio (dashboard actividades), Pagos, Actividades.

### Caso 3: Pedro — Gimnasio + actividades

**Perfil:** Hombre de 35 años, entrena fuerza 3 días y quiere funcional 2 días.

**Flujo:**
1. Recibe link de registro
2. Selecciona "Gimnasio" y "Actividades"
3. Completa datos personales
4. Selecciona plan "Mensual Intermedio" (3 visitas/semana)
5. Elige horarios gimnasio: lunes 8:00, miércoles 8:00, viernes 8:00
6. Selecciona "Funcional" → solo ve horarios que no chocan con lunes/miércoles/viernes 8:00
7. Elige: martes 10:00-11:00, jueves 10:00-11:00
8. Confirma

**Portal:** Ve todos los módulos. Dashboard combinado.

---

## [HISTÓRICO] Secciones reemplazadas por la nueva visión

> Las siguientes secciones corresponden a la versión anterior del documento
> (anterior a 2026-06-26) que describía el modelo de "3 tipos de miembros".
> Se mantienen como registro histórico pero no reflejan la visión actual del producto.

### Reemplazado: Tipos de clientes (3 perfiles)

Anteriormente el sistema definía tres tipos de miembros: GYM, ACTIVITY_ONLY y
GYM+ACTIVITIES como perfiles separados. Esto fue reemplazado por el modelo de
servicios contratados donde un miembro puede tener cualquier combinación.

### Reemplazado: Pantalla inicial con 3 opciones excluyentes

Anteriormente la pantalla inicial ofrecía: "Entrenar en gimnasio", "Solo actividades",
"Ambas opciones" como opciones mutuamente excluyentes. Ahora son checkboxes
independientes.

### Reemplazado: Sin Subscription para ACTIVITY_ONLY

Anteriormente los miembros ACTIVITY_ONLY no tenían Subscription. Ahora
siempre se crea una Subscription independientemente de los servicios contratados.

### Reemplazado: entry_mode como eje del portal

Anteriormente el portal dependía de `entry_mode` para decidir qué mostrar.
Ahora el portal inspecciona los datos reales (AttendanceSchedule, Enrollment, etc.).
