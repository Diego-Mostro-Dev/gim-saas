# Auditoría de Seed Demo — Cómo funciona hoy la siembra de datos de demo

> Verificado contra: `f5b4b07`
> Fecha: 2026-10-30
> Alcance: comando `seed_demo_data`, app `seed`, fases de siembra, flags, aislamiento e idempotencia. Uso exclusivo para desarrollo/QA, no expuesto a usuarios finales.
> Documentos relacionados: `AUDITORIA-NUCLEO-REGLAS.md`, `AUDITORIA-OPERACIONES.md`, `AUDITORIA-MIEMBROS.md`
> Código cubierto: `backend/seed`, `backend/gyms/management/commands/seed_demo_data.py`
> Estado: verificado

> Documento descriptivo: **lo que el sistema hace hoy**.

---

## 1. Qué es y para qué sirve

`seed_demo_data` crea un conjunto coherente de datos de demo para un gimnasio: planes, socios, suscripciones, pagos, actividades (si habilitadas), ejercicios/rutinas/asignaciones, horarios/asistencias históricas, etc. Diseñado para desarrollo/QA con aislamiento por gimnasio e idempotencia controlada por flags.

## 2. Cómo funciona hoy

### 2.1 Comando
- **`gyms/management/commands/seed_demo_data.py`**: acepta `--gym <slug>` (requerido), `--force`, `--reference-date YYYY-MM-DD`, `--preserve-plans`. Obtiene gimnasio con `get_object_or_404`, instancia `BaseSeeder`. Si no necesita siembra y sin `--force` → SKIP. Si `--force` ejecuta limpieza por fases y luego siembra fases 1-5.

### 2.2 Seeder
- **`seed.base.BaseSeeder`**: inicializa con gym, ref_date (hoy por defecto), force, preserve_plans. Calcula rangos de meses anteriores para generar históricos. Genera teléfonos/email únicos por gimnasio.
- **`needs_seeding()`**: cuenta `Member.all_objects.filter(gym=...)`. Si hay socios y sin `force` → False (no re-siembra). Si vacío → True. Si hay socios y `force` → True.
- **Fases**:
  - `seed_phase1()`: planes, socios, suscripciones, pagos (dentro de transacción)
  - `seed_phase2()`: actividades, horarios de actividades, inscripciones (solo si `gyms.features.activities_enabled(gym)`)
  - `seed_phase3()`: ejercicios, plantillas de rutina, asignaciones
  - `seed_phase4()`: miembros con asistencia histórica
  - `seed_phase5()`: más histórico/asistencia
- **Limpieza con `--force`**: llama `cleanup_phase5()`, `cleanup_phase4()`, `cleanup_phase2()`, `cleanup_phase1()`, `cleanup_phase3()` en ese orden. `cleanup_phase1()` borra pagos/suscripciones/socios; borra planes solo si `not preserve_plans`. `cleanup_phase2()` borra inscripciones/horarios/actividades del gimnasio.

### 2.3 Datos demo
- `seed/data/member_names.py`, `seed/data/plans.py`, `seed/data/activities.py`, `seed/data/exercises.py`, `seed/data/routines.py` proveen datos base.

## 3. Reglas y casos borde

- **Aislamiento**: filtra todo por `gym`. Tests verifican que sembrar otro gimnasio no toca el actual.
- **Idempotencia**: sin `--force`, no re-siembra si ya hay socios.
- **Preservar planes**: `--preserve-plans` evita borrar `MembershipPlan` en cleanup_phase1 (útil para conservar configuración).
- **Actividades condicionales**: solo si feature `activities` habilitado.
- **Transaccional**: `seed_phase1` usa `transaction.atomic()`.
- **Fechas base**: configurable con `--reference-date` para generar históricos consistentes.
- **Teléfonos namespaceados**: incluyen `gym.id` para evitar colisiones.

## 4. Roles y pantallas

Solo uso por CLI/comando de gestión. No accesible desde UI de usuarios finales.

## 5. Lo que el sistema NO hace hoy

- **No siembra otros módulos** más allá de las fases implementadas.
- **No crea usuarios staff/owner** (se enfoca en datos operativos).
- **No restaura backups** (eso va por scripts/operaciones).

## 6. Problemas y decisiones de negocio

**Decisiones de negocio:**
- **Guardia `needs_seeding`**: previene sobrescritura accidental.
- **Flags explícitos (`force`, `preserve-plans`)**: control granular de limpieza.
- **Aislamiento estricto**: crítico para entornos multi-gimnasio.

**Problemas:** Ver `BUGS.md` si aplica.

## 7. Referencias técnicas

```text
backend/gyms/management/commands/seed_demo_data.py · Command
backend/seed/base.py · BaseSeeder
backend/seed/base.py · BaseSeeder.needs_seeding
backend/seed/base.py · BaseSeeder.cleanup_phase1
backend/seed/base.py · BaseSeeder.cleanup_phase2
backend/seed/base.py · BaseSeeder.seed_phase1
backend/seed/base.py · BaseSeeder.seed_phase2
backend/seed/base.py · BaseSeeder.seed_phase3
backend/seed/base.py · BaseSeeder.seed_phase4
backend/seed/base.py · BaseSeeder.seed_phase5
backend/seed/tests.py · SeederHelperTests
backend/seed/tests.py · NeedsSeedingTests
backend/seed/tests.py · SeedPhase1IsolationTests
backend/seed/data/member_names.py · FIRST_NAMES
backend/seed/data/member_names.py · LAST_NAMES
backend/seed/data/plans.py · DEMO_PLANS
backend/seed/data/activities.py · DEMO_ACTIVITIES
backend/seed/data/exercises.py · EXERCISES
backend/seed/data/routines.py · ROUTINES
```

## 8. Snapshot de referencias

```text
backend/gyms/management/commands/seed_demo_data.py:1-140 (al commit f5b4b07)
backend/seed/base.py:1-200 (al commit f5b4b07)
backend/seed/tests.py:1-140 (al commit f5b4b07)
```

## 9. Checklist de verificación

- [x] Revisé comando y BaseSeeder
- [x] Revisé fases, flags, limpieza
- [x] Revisé tests de seed (`seed/tests.py`)
- [x] Verifiqué aislamiento
- [x] Actualicé “Lo que NO hace”
- [x] Referencias híbridas
- [x] Validador OK
- [x] Tests revisados
- [x] Índice actualizado
