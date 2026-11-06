# Auditoría del Núcleo (Reglas) — Cómo funcionan hoy las reglas transversales

> Verificado contra: `f5b4b07`
> Fecha: 2026-10-30
> Alcance: scoping por gimnasio, permisos transversales, solapes compartidos, tiempos/bloques, emails transaccionales, invariantes y helpers de test. No cubre lógica específica de módulos.
> Documentos relacionados: `AUDITORIA-USUARIOS-Y-ACCESOS.md`, `AUDITORIA-ADMIN-SAAS.md`, `AUDITORIA-SEED-DEMO.md`, `AUDITORIA-OPERACIONES.md`
> Código cubierto: `backend/core`
> Estado: verificado

> Documento descriptivo: **lo que el sistema hace hoy**.

---

## 1. Qué es y para qué sirve

El núcleo (`core`) concentra reglas que deben aplicarse igual en todos los módulos: aislamiento por gimnasio, permisos por rol, detección de solapes entre actividades/salidas/PT/gimnasio, cálculo de duración real de bloques, envío de emails transaccionales e invariantes/helpers comunes.

## 2. Cómo funciona hoy

### 2.1 Scoping por gimnasio
- **`core.mixins.GymQuerysetMixin`**: obtiene `gym` desde `request.user.profile.gym`; filtra queryset con `gym=self.get_gym()`; en `perform_create` asigna `gym=self.get_gym()`. Si no hay perfil o no hay gimnasio → `PermissionDenied`.
- **Uso transversal**: múltiples viewsets/herederos usan este mixin para asegurar aislamiento.

### 2.2 Reglas de precio (billing)
- **`core.mixins.BillingPriceMixin`**: reglas para ofertas cobradas por cuota o por paquete.
  - **Modo `sessions`**: fuerza `monthly_price = 0` (el paquete se cobra con su propio asiento de pago).
  - **Modo `monthly`**: exige `monthly_price > 0`.
- **Aplicado en serializers** de módulos con ofertas/actividades según corresponda.

### 2.3 Solapes compartidos
- **`core.overlap.check_member_slot(member, day, start_time, end_time, exclude=None)`**: única fuente de verdad. Verifica solape con gimnasio (`AttendanceSchedule` activo), actividades (`Enrollment` activo), salidas (`OutingEnrollment` activo) y PT (`PersonalTrainingAssignment` activo). Usa `exclude` para ignorarse a sí mismo.
- **`core.overlap.SlotConflict`** con códigos `CONFLICT_GYM_SCHEDULE`, `CONFLICT_ACTIVITY`, `CONFLICT_OUTING`, `CONFLICT_PT` y `detail`.
- **Resolución de gimnasio**: usa `subscriptions.domain.SubscriptionDomain.resolve_gym(member)`.
- **Cálculo de solape**: `times_overlap(start_a,end_a,start_b,end_b)` con `start_a < end_b and start_b < end_a`.

### 2.4 Tiempos y duración real
- **`core.times.add_minutes(start, minutes)`**: suma minutos a hora.
- **`core.times.slot_end(slot)`**: fin real del bloque de gimnasio = `slot.hour + slot.duration_minutes` (default 60). Usa `getattr` para objetos no guardados.
- **`core.overlap._check_gym_schedule`** usa `slot_end(gs.slot)` (soporta duración real).

### 2.5 Permisos
- **`core.permissions.IsSuperUser`**: solo superusuario central.
- **`core.permissions.is_owner` / `require_owner`**: dueño del gimnasio.
- **`core.permissions.is_routine_manager` / `require_routine_manager`**: owner/staff/professor pueden gestionar rutinas; trainer queda afuera. Roles definidos en `ROUTINE_MANAGER_ROLES`.
- Ver `AUDITORIA-USUARIOS-Y-ACCESOS.md` para detalles completos.

### 2.6 Emails transaccionales
- **`core.email.send_password_reset_email`**: envía email de reset con Resend si `RESEND_API_KEY` configurado. Usa plantillas de `core.email_templates`. Loguea y retorna False si no configurado o falla, sin lanzar error.

### 2.7 Invariantes y helpers
- **Invariantes**: `core.money_invariants`, `core.session_invariants` (validaciones/invariantes transversales).
- **Testing**: `core.testing.BaseAPITest` (helpers para crear gym/user/member/etc.); `core.tests_admin_scoping` valida scoping en admin Django.
- **Viewsets/misc**: `core.viewsets`, `core.admin` (scoping admin).

## 3. Reglas y casos borde

- **Un socio no puede estar en dos cosas a la misma hora**: validación centralizada evita desincronización entre apps.
- **Duración real de bloques**: obliga a usar `slot_end` para comparar con actividades/salidas/PT.
- **Modo sesiones fuerza cuota a 0**: evita doble cobro.
- **Modo mensual exige precio > 0**: evita facturación $0.
- **Sin gimnasio asignado**: `GymQuerysetMixin.get_gym` lanza `PermissionDenied`.
- **Trainer sin gestión de rutinas**: regla explícita e intencional.
- **Email sin API key**: no falla, solo loguea y retorna False.

## 4. Roles y pantallas

Transversal a todos los roles. Afecta validaciones, filtrado, permisos y notificaciones en todo el sistema.

## 5. Lo que el sistema NO hace hoy

- **No hay un único "policy engine"**: reglas distribuidas en mixins/funciones del core.
- **No hay validación global de solapes en nivel de modelo**: se hace en servicios/validadores usando `core.overlap`.
- **No hay envío masivo de emails** desde `core.email` (solo transaccionales puntuales).

## 6. Problemas y decisiones de negocio

**Decisiones de negocio:**
- **Fuente única de solapes**: centralizar evita inconsistencias (bug histórico corregido).
- **Duración real**: soporta bloques no estándar.
- **Forzar precio a 0 en modo sesiones**: decisión deliberada para evitar doble cobro.

**Problemas:** Ver `BUGS.md` si aplica.

## 7. Referencias técnicas

```text
backend/core/mixins.py · BillingPriceMixin
backend/core/mixins.py · GymQuerysetMixin
backend/core/overlap.py · check_member_slot
backend/core/overlap.py · SlotConflict
backend/core/overlap.py · times_overlap
backend/core/overlap.py · CONFLICT_GYM_SCHEDULE
backend/core/overlap.py · CONFLICT_ACTIVITY
backend/core/overlap.py · CONFLICT_OUTING
backend/core/overlap.py · CONFLICT_PT
backend/core/times.py · add_minutes
backend/core/times.py · slot_end
backend/core/permissions.py · IsSuperUser
backend/core/permissions.py · is_owner
backend/core/permissions.py · require_owner
backend/core/permissions.py · is_routine_manager
backend/core/permissions.py · require_routine_manager
backend/core/permissions.py · ROUTINE_MANAGER_ROLES
backend/core/email.py · send_password_reset_email
backend/core/email_templates.py · build_password_reset_email
backend/core/money_invariants.py · *
backend/core/session_invariants.py · *
backend/core/testing.py · BaseAPITest
backend/core/tests.py · *
backend/core/tests_admin_scoping.py · AdminGymScopingTests
backend/core/viewsets.py · *
backend/core/admin.py · GymScopedAdminMixin
```

## 8. Snapshot de referencias

```text
backend/core/mixins.py:1-150 (al commit f5b4b07)
backend/core/overlap.py:1-180 (al commit f5b4b07)
backend/core/times.py:1-80 (al commit f5b4b07)
backend/core/permissions.py:1-120 (al commit f5b4b07)
backend/core/email.py:1-140 (al commit f5b4b07)
```

## 9. Checklist de verificación

- [x] Leí código del core completo relevante
- [x] Recorrí mixins, overlap, times, permissions, email
- [x] Revisé tests core (`core/tests.py`, `core/tests_admin_scoping.py`)
- [x] Crucé con otros módulos
- [x] Actualicé “Lo que NO hace”
- [x] Actualicé “Problemas y decisiones”
- [x] Referencias híbridas
- [x] Validador OK
- [x] Tests revisados
- [x] Índice actualizado
