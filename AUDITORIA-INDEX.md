# Índice de auditorías

> Verificado contra: `f5b4b07`
> Fecha: 2026-11-13
> Alcance: estado final, ubicación y cobertura de las 18 auditorías del sistema.
> Documentos relacionados: `AUDITORIA-MAPA-COBERTURA.md`, `AUDITORIA-PLANTILLA.md`,
> `Actualizacion de auditorias.md`

---

## 1. Cómo usar este índice

- Cada fila es una auditoría publicada o planificada.
- **Estado** indica si el documento ya fue revalidado contra el commit de la
  cabecera.
- **Fase** es la fase del plan `Actualizacion de auditorias.md` en la que se
  actualiza o crea.
- El detalle de código, endpoints, pantallas y tests está en
  `AUDITORIA-MAPA-COBERTURA.md`.

Estados posibles:

| Estado | Significado |
|---|---|
| `Piloto Fase 0` | Migrado al formato nuevo; contenido pendiente de revalidación |
| `Pendiente Fase N` | Existe, pero todavía no fue revalidado contra el código actual |
| `Nueva Fase N` | Todavía no existe; se crea en esa fase |
| `En curso Fase N` | Documento en actualización; todavía no fue verificado |
| `Verificado` | Revalidado contra el commit de la cabecera y con referencias válidas |

---

## 2. Las 18 auditorías

| # | Documento | Fase | Alcance | Código principal | Estado |
|---|---|---|---|---|---|
| 1 | `AUDITORIA-USUARIOS-Y-ACCESOS.md` | 1 | Login, tokens, contraseñas, onboarding de dueño, roles y permisos | `backend/accounts`, `backend/profiles`, `backend/core/permissions.py` | `Verificado` |
| 2 | `AUDITORIA-ADMIN-SAAS.md` | 1 | Panel central, alta de gimnasios, features y configuración inicial | `backend/admins`, `backend/gyms/features.py` | `Verificado` |
| 3 | `AUDITORIA-NUCLEO-REGLAS.md` | 2 | Scoping, permisos, solapes, horarios, emails, invariantes y helpers | `backend/core` | `Verificado` |
| 4 | `AUDITORIA-SEED-DEMO.md` | 2 | Datos demo, fases de seed, aislamiento y opciones de resiembra | `backend/seed`, `backend/gyms/management/commands/seed_demo_data.py` | `Verificado` |
| 5 | `AUDITORIA-OPERACIONES.md` | 2 | Entorno, CI, tareas programadas, backups, monitoreo y despliegue | `backend/config`, `.github/workflows`, `scripts`, `Procfile` | `Verificado` |
| 6 | `AUDITORIA-MIEMBROS.md` | 3 | Alta, ficha, portal, adjuntos y baja lógica de socios | `backend/members` | `Verificado` |
| 7 | `AUDITORIA-PLANES.md` | 3 | Catálogo, plan base, precios y ciclo de vida de planes | `backend/plans` | `Verificado` |
| 8 | `AUDITORIA-SUSCRIPCIONES.md` | 3 | Períodos, renovación, cambios de plan, prorrateo y crédito | `backend/subscriptions` | `Verificado` |
| 9 | `AUDITORIA-PAGOS.md` | 3 | Cobros, deuda, saldo a favor, bloqueo y renovación | `backend/payments`, `backend/subscriptions/services.py` | `Verificado` |
| 10 | `AUDITORIA-RECUPERACION.md` | 3 | Recuperación de suscripción, deuda y casos A/B | `backend/subscriptions/services.py`, `backend/attendance/recovery_service.py` | `Verificado` |
| 11 | `AUDITORIA-ASISTENCIAS.md` | 4 | Check-in, planilla, cupos, descuentos y recuperaciones | `backend/attendance` | `Verificado` |
| 12 | `AUDITORIA-HORARIOS.md` | 4 | Cambios permanentes, intercambios, límites y aprobaciones | `backend/attendance` | `Verificado` |
| 13 | `AUDITORIA-ACTIVIDADES.md` | 5.1–5.2 | Actividades, horarios, inscripciones, cobro, sesiones y faltas | `backend/activities` | `Verificado` |
| 14 | `AUDITORIA-SALIDAS.md` | 5.3–5.4 | Salidas, horarios, inscripciones, solicitudes, sesiones y cobro | `backend/outings` | `Verificado` |
| 15 | `AUDITORIA-PERSONAL-TRAINING.md` | 5.5–5.7 | Oferta, trainers, asignaciones, cobro, sesiones, faltas, solicitudes, agenda y asistencia | `backend/personal_training` | `Verificado` |
| 16 | `AUDITORIA-RUTINAS.md` | 6 | Catálogo, armado, asignación en lote, portal y progreso; permisos y límites | `backend/routines` | `Verificado` |
| 17 | `AUDITORIA-COMUNIDAD.md` | 6 | Locales adheridos, baja lógica, feature y tarjeta pública; socio inactivo vs eliminado | `backend/community` | `Verificado` |
| 18 | `AUDITORIA-CONFIGURACION.md` | 7 | Datos básicos, pagos, planes y horarios, recuperación, descuentos, obras sociales, cierres, QR, features, labels, SEO, PWA, staff y comunidad | `backend/gyms`, `backend/config` | `Verificado` |

---

## 3. Documentos de apoyo

| Documento | Uso | Estado |
|---|---|---|
| `AUDITORIA-PLANTILLA.md` | Plantilla y checklist para crear o reescribir auditorías | `Fase 0` |
| `AUDITORIA-MAPA-COBERTURA.md` | Mapa doc ↔ código ↔ endpoints ↔ pantallas ↔ tests | `Fase 0` |
| `Actualizacion de auditorias.md` | Plan completo de actualización por fases | `Fase 0` |
| `BUGS.md` | Fuente de verdad de bugs, severidad y estado | Vigente |
| `PLAN-bugs.md` | Plan de corrección de bugs por fases | Vigente |

---

## 4. Convención de referencias

Las auditorías usan referencias híbridas:

```text
backend/members/services.py · RegistrationService.register
frontend/src/pages/Members.jsx · Members
```

- El archivo y el símbolo son la referencia principal.
- El número de línea solo se admite como snapshot histórico.
- Si no hay símbolo estable, se usa archivo + sección funcional.
- Las referencias deben existir en el commit de la cabecera.

Validación:

```bash
python3 scripts/check_audit_refs.py AUDITORIA-*.md
```

Para exigir también que los snapshots de línea estén dentro de rango:

```bash
python3 scripts/check_audit_refs.py --strict-lines AUDITORIA-*.md
```

---

## 5. Cómo mantener el índice

1. Al terminar una auditoría, cambiar su estado a `Verificado`.
2. Actualizar la fecha y el commit de la cabecera del documento.
3. Actualizar la fila correspondiente de este índice.
4. Ejecutar el validador de referencias.
5. Si cambia el alcance, actualizar también `AUDITORIA-MAPA-COBERTURA.md`.

---

## 6. Estado de Fase 0

- [x] Baseline congelado en `f5b4b07`.
- [x] Plantilla común creada.
- [x] Mapa de cobertura creado.
- [x] Índice inicial creado con las 18 auditorías.
- [x] Validador de referencias implementado.
- [x] `AUDITORIA-MIEMBROS.md` migrado como piloto.
- [x] Cierre de Fase 0: validar el piloto y revisar el diff completo.

**Fase 0: CERRADA**

Validación global al cierre: 0 errores. Las 2 advertencias de snapshot
detectadas en `AUDITORIA-PAGOS.md` y `AUDITORIA-PERSONAL-TRAINING.md` se
corrigieron en sus fases; el validador estricto ya no reporta advertencias.

---

## 7. Estado de Fase 8 — Cierre y publicación

- [x] 18 de 18 auditorías con cabecera, alcance y fecha.
- [x] Sin afirmaciones vigentes de bugs ya cerrados: las secciones de
  "Problemas" se reescribieron como **"Problemas y decisiones vigentes"**.
- [x] Decisiones de negocio marcadas como tales (`DIN-11`, `DIN-13`, `DIN-16`,
  `ACC-22`, `ADD-11`, `ADD-17`, `ADD-23`, `RUT-06`, `RUT-08`, `COM-01`,
  `COM-02`, `CFG-02`, `CFG-03`).
- [x] Enlaces entre documentos revisados (`AUDITORIA-PAGOS.md`,
  `AUDITORIA-COMUNIDAD.md`).
- [x] `BUGS.md` cuadrado: **109 hallazgos** (5 `CRÍTICO`, 31 `ALTO`,
  52 `MEDIO`, 21 `BAJO`), **96 cerrados**, **13 decisiones** y **0 abiertos**.
- [x] Validador estricto: **1252 referencias, 0 errores, 0 advertencias**.
- [x] `makemigrations --check --dry-run`: sin cambios pendientes.
- [x] Frontend: `pnpm lint` sin errores y `pnpm build` verde.
- [ ] Suite backend completa: no se ejecutó localmente porque requiere el
  Postgres 16 descartable de `/tmp/opencode/pgtest`; la corre el CI
  (`backend-tests.yml`) en la PR/push.

**Fase 8: CERRADA** (cierre documental y gates de frontend; la suite backend
queda cubierta por CI).

El código de producto no cambió durante la actualización: el commit de
verificación sigue siendo **`f5b4b07`**.

---

## 8. Estado de Fase 9 — Cierre de bugs abiertos

- [x] `CFG-16` cerrado: `OwnerWriteMixin` exige dueño en la escritura de
  descuentos y obras sociales, con lectura abierta al gimnasio.
- [x] `CFG-17` cerrado: `active` y `slug` son `read_only_fields` de
  `GymSerializer`; el admin central los sigue escribiendo.
- [x] `BUGS.md`: **96 cerrados**, **13 decisiones** y **0 abiertos**.
- [x] `PLAN-dinero.md`: deuda `P8–P16` reconciliada (cerrada o decidida; `P9`
  queda como `ADD-11`).
- [ ] Gate completo (backend, migraciones, frontend y validador de referencias):
  lo corre el CI después del commit y push en `development`.

**Fase 9: CERRADA** en lo documental y de código; la verificación de la suite
queda en CI.
