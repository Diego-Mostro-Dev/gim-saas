# Índice de auditorías

> Verificado contra: `f5b4b07`
> Fecha: 2026-10-30
> Alcance: estado, ubicación y cobertura de las 18 auditorías del sistema.
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
| 13 | `AUDITORIA-ACTIVIDADES.md` | 5.1–5.2 | Actividades, horarios, inscripciones, cobro, sesiones y no-show | `backend/activities` | `Verificado` |
| 14 | `AUDITORIA-SALIDAS.md` | 5.3–5.4 | Salidas, horarios, inscripciones, solicitudes, sesiones y cobro | `backend/outings` | `Verificado` |
| 15 | `AUDITORIA-PERSONAL-TRAINING.md` | 5 | Oferta, trainers, asignaciones, paquetes, sesiones y agenda | `backend/personal_training` | `Pendiente Fase 5` |
| 16 | `AUDITORIA-RUTINAS.md` | 6 | Ejercicios, plantillas, asignación, ejecución y progreso | `backend/routines` | `Pendiente Fase 6` |
| 17 | `AUDITORIA-COMUNIDAD.md` | 6 | Locales adheridos, feature toggle y tarjeta pública | `backend/community` | `Pendiente Fase 6` |
| 18 | `AUDITORIA-CONFIGURACION.md` | 7 | Datos del gimnasio, pagos, horarios, recuperación, features, SEO y PWA | `backend/gyms`, `backend/config` | `Pendiente Fase 7` |

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

Validación global al cierre: 0 errores y 2 advertencias de snapshot en
`AUDITORIA-PAGOS.md` y `AUDITORIA-PERSONAL-TRAINING.md`, a corregir en sus fases.
