# Mapa de cobertura de auditorías

> Verificado contra: `f5b4b07`
> Fecha: 2026-11-11
> Alcance: relaciona cada auditoría con sus apps, endpoints, pantallas y tests.
> Documentos relacionados: `AUDITORIA-INDEX.md`, `AUDITORIA-PLANTILLA.md`,
> `Actualizacion de auditorias.md`

---

## 1. Cómo leer este mapa

Cada fila responde cuatro preguntas:

1. **Qué documento** cubre el módulo.
2. **Qué código** es la fuente principal.
3. **Qué pantallas** usa el staff o el socio.
4. **Qué tests** respaldan las afirmaciones.

El código de producto manda. Si una pantalla y el backend parecen decir cosas
distintas, la auditoría debe documentar el comportamiento real y marcar la
diferencia como problema o decisión.

Leyenda de estado:

- **Piloto:** documento migrado al formato nuevo en Fase 0.
- **Pendiente Fase N:** documento aún no revalidado contra el commit actual.
- **Nueva Fase N:** documento que todavía no existe.

---

## 2. Auditorías existentes

| Documento | Fase | Código principal | Endpoints principales | Pantallas / flujos | Tests |
|---|---|---|---|---|---|
| `AUDITORIA-MIEMBROS.md` | 3 | `backend/members` | `/api/members/`, `/api/health-insurances/`, `/api/members/attachments/`, `/api/public/register/<gym_code>/`, `/api/public/<token>/data/` | `frontend/src/pages/Members.jsx`, `Register.jsx`, `member/MemberData.jsx`, `member/MemberAttachments.jsx`, `dev/MembersFlow.jsx` | `backend/members/tests.py`, `tests_phase_k5.py`, `tests_phase_k6.py` |
| `AUDITORIA-PLANES.md` | 3 | `backend/plans` | `/api/plans/`, `/api/services/` | `frontend/src/pages/Plans.jsx`, `components/plans/*`, `dev/PlansFlow.jsx`, `dev/PlanChangesFlow.jsx` | `backend/plans/tests.py` |
| `AUDITORIA-SUSCRIPCIONES.md` | 3 | `backend/subscriptions` | `/api/subscriptions/`, `/api/subscriptions/reopen/`, `/api/plan-change-requests/`, endpoints públicos de cambio/renovación | `frontend/src/pages/Subscriptions.jsx`, `PlanChangeRequests.jsx`, `components/subscriptions/*`, `dev/SubscriptionsFlow.jsx` | `backend/subscriptions/tests.py`, `tests_phase_k4.py`, `tests_phase_k5.py`, `test_proration.py`, `test_money_*.py`, `test_weekly_visits.py` |
| `AUDITORIA-PAGOS.md` | 3 | `backend/payments`, `backend/subscriptions/services.py` | `/api/payments/`, `/api/payments/export/` | `frontend/src/pages/Payments.jsx`, `member/MemberPayments.jsx`, `components/payments/*`, `dev/PaymentsFlow.jsx` | `backend/payments/tests.py`, `backend/subscriptions/test_money_*.py` |
| `AUDITORIA-RECUPERACION.md` | 3 | `backend/subscriptions/services.py`, `backend/attendance/recovery_service.py` | `/api/subscriptions/reopen/`, `/api/attendance/recoveries/`, `/api/attendance/public/recoveries/<token>/` | `frontend/src/pages/RecoverMembers.jsx`, `member/MemberRecoveries.jsx`, `components/recoveries/*`, `dev/RecoveryFlow.jsx` | `backend/subscriptions/tests.py`, `backend/attendance/tests_phase_e.py` |
| `AUDITORIA-ASISTENCIAS.md` | 4 | `backend/attendance` | `/api/attendance/register/`, `/api/attendance/checkin/<token>/`, `/api/attendance/weekly/`, `/api/attendance/status/`, `/api/attendance/analytics/` | `frontend/src/pages/Attendance.jsx`, `Checkin.jsx`, `AttendanceQR.jsx`, `AttendanceAnalytics.jsx`, `components/attendance/*`, `dev/AttendanceFlow.jsx` | `backend/attendance/tests.py`, `tests_phase_e.py`, `tests_phase_j.py`, `tests_phase_k3.py`, `tests_phase_k4.py` |
| `AUDITORIA-HORARIOS.md` | 4 | `backend/attendance` (`ScheduleChangeRequest`, `ScheduleSwapRequest`) | `/api/attendance/schedule-change-requests/`, `/api/attendance/schedule-swap-requests/`, endpoints públicos equivalentes | `frontend/src/pages/ScheduleChangeRequests.jsx`, `ScheduleSwapRequests.jsx`, `PublicRoutine.jsx`, `dev/ScheduleChangesFlow.jsx`, `dev/ScheduleSwapsFlow.jsx` | `backend/attendance/tests_phase_j.py`, `tests_phase_k3.py`, `tests_phase_k4.py` |
| `AUDITORIA-ACTIVIDADES.md` | 5 | `backend/activities` | `/api/activities/`, `/api/activities/<id>/schedules/`, `/api/activities/schedules/<id>/enroll/`, `/api/activities/public/<token>/` | `frontend/src/pages/Activities.jsx`, `ActivitySchedules.jsx`, `ScheduleEnrollments.jsx`, `MemberActivities.jsx`, `member/ActivityDashboard.jsx`, `dev/ActivitiesFlow.jsx` | `backend/activities/tests.py`, `tests_deactivation.py`, `tests_phase_g.py`, `tests_phase_k*.py`, `tests_sessions_invariants.py` |
| `AUDITORIA-SALIDAS.md` | 5 | `backend/outings` | `/api/outings/`, `/api/outings/<id>/schedules/`, `/api/outings/schedules/<id>/enroll/`, `/api/outings/requests/`, `/api/outings/public/<token>/` | `frontend/src/pages/Outings.jsx`, `OutingSchedules.jsx`, `OutingEnrollments.jsx`, `member/MemberOutings.jsx`, `components/outings/*`, `dev/OutingsFlow.jsx` | `backend/outings/tests.py`, `tests_deactivation.py`, `tests_phase_k2.py` |
| `AUDITORIA-PERSONAL-TRAINING.md` | 5 | `backend/personal_training` | `/api/personal-training/services/`, `/trainers/`, `/assignments/`, `/change-requests/`, `/attendance/`, endpoints públicos | `frontend/src/pages/PersonalTrainingSettings.jsx`, `PersonalTrainingAttendance.jsx`, `TrainerAgenda.jsx`, `MemberPersonalTraining.jsx`, `dev/PersonalTrainingFlow.jsx` | `backend/personal_training/tests.py`, `tests_deactivation.py`, `tests_phase_k2.py`, `tests_phase_k3.py`, `tests_phase_k7.py` |
| `AUDITORIA-RUTINAS.md` | 6 | `backend/routines` | `/api/routines/exercises/`, `/templates/`, `/assignments/`, `/routine-exercises/`, `/member/<id>/`, `/member/<id>/whatsapp/`, `/active/`, `/bulk-assign/`, `/public/<token>/`, `/public/<token>/progress/` | `frontend/src/pages/Routines.jsx`, `member/MemberWorkout.jsx`, `components/routines/*`, `dev/RoutinesFlow.jsx` | `backend/routines/tests_phase_h.py` |
| `AUDITORIA-COMUNIDAD.md` | 6 | `backend/community` | `/api/community/businesses/`, `/api/community/public/<token>/` | `frontend/src/pages/CommunityPanel.jsx`, `member/CommunityPublicPage.jsx`, `member/MemberCommunity.jsx` | `backend/community/tests.py` |
| `AUDITORIA-CONFIGURACION.md` | 7 | `backend/gyms`, `backend/config` | `/api/gyms/me/`, `/api/gyms/me/closed-dates/`, `/api/gyms/me/discounts/`, `/api/gyms/staff/`, `/api/health-insurances/`, `/api/attendance/slots/`, `/api/gyms/public/seo/<gym_code>/`, `/api/gyms/pwa/...`, `/api/pwa/manifest/...` | `frontend/src/pages/Settings.jsx`, `CommunityPanel.jsx`, `dev/SettingsFlow.jsx`, `pages/admin/*`, `frontend/api/pwa/manifest/*/*.js`, `frontend/api/seo/register/*.js` | `backend/gyms/tests.py`, `backend/gyms/tests_restore.py`, `backend/members/tests_phase_k5.py`, `backend/attendance/tests_phase_e.py` |

---

## 3. Auditorías nuevas

| Documento | Fase | Código principal | Endpoints principales | Pantallas / flujos | Tests |
|---|---|---|---|---|---|
| `AUDITORIA-USUARIOS-Y-ACCESOS.md` | 1 | `backend/accounts`, `backend/profiles`, `backend/core/permissions.py` | `/api/auth/login/`, `/logout/`, `/refresh/`, `/me/`, `/change-password/`, `/password-reset/...`, `/onboarding/...` | `frontend/src/pages/Login.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `ChangePassword.jsx`, `Staff.jsx`, `onboarding/GymSetup.jsx` | `backend/accounts/tests.py`, `backend/profiles/tests.py`, `backend/core/tests_admin_scoping.py` |
| `AUDITORIA-ADMIN-SAAS.md` | 1 | `backend/admins`, `backend/gyms/features.py` | `/api/admin/gyms/`, `/api/admin/gyms/<id>/`, `/api/admin/features/` | `frontend/src/pages/admin/AdminGyms.jsx`, `AdminGymWizard.jsx`, `AdminGymEdit.jsx` | `backend/admins/tests.py` |
| `AUDITORIA-NUCLEO-REGLAS.md` | 2 | `backend/core` | Transversal a todos los endpoints | No tiene pantallas propias; impacta en todos los flujos | `backend/core/tests.py`, `tests_admin_scoping.py` |
| `AUDITORIA-SEED-DEMO.md` | 2 | `backend/seed`, `backend/gyms/management/commands/seed_demo_data.py` | Comando `seed_demo_data` | No tiene pantallas propias | `backend/seed/tests.py` |
| `AUDITORIA-OPERACIONES.md` | 2 | `backend/config`, `.github/workflows`, `scripts`, `Procfile` | `/api/health/`, `/api/system/tasks/`, `/api/system/backup/`, `/api/system/sentry-test/` | No tiene pantallas propias | `backend/config/api/tests.py`, `backend/gyms/tests_restore.py` |

---

## 4. Módulos transversales

Estos módulos no tienen una auditoría exclusiva, pero aparecen en casi todas.
Su comportamiento debe citarse desde el documento del módulo que lo usa y, cuando
sea una regla central, desde `AUDITORIA-NUCLEO-REGLAS.md`.

| Módulo | Qué aporta | Documentos que lo consumen |
|---|---|---|
| `backend/core/mixins.py` | `GymQuerysetMixin`, `BillingPriceMixin` | Miembros, planes, suscripciones, pagos, asistencias, add-ons, rutinas, comunidad |
| `backend/core/overlap.py` | Solapes entre gimnasio, actividades, salidas y PT | Miembros, asistencias, actividades, salidas, PT |
| `backend/core/times.py` | Cálculo de fin de bloque | Asistencias, actividades, salidas, PT |
| `backend/core/permissions.py` | Superusuario, dueño, gestor de rutinas | Usuarios y accesos, configuración, rutinas |
| `backend/core/money_invariants.py` | Invariantes de dinero | Suscripciones, pagos, recuperación, add-ons |
| `backend/core/session_invariants.py` | Invariantes de sesiones | Actividades, salidas, PT, recuperación |
| `backend/core/testing.py` | Helpers de tests y `settle_subscription` | Todas las suites |
| `backend/gyms/features.py` | Feature flags y guards | Actividades, salidas, PT, comunidad, configuración |
| `backend/gyms/labels.py` | Etiquetas visibles del gimnasio | Configuración y pantallas de staff |
| `backend/config/api/throttles.py` | Límites de requests | Auth, portal, altas públicas, pagos |
| `backend/config/api/middleware.py` | Tareas programadas perezosas | Operaciones y suscripciones |
| `backend/config/settings.py` | Entorno, TTLs, base de datos, storage | Operaciones y todos los módulos |

---

## 5. Cobertura del frontend

| Pantalla / flujo | Documento que la cubre |
|---|---|
| `Members.jsx`, `Register.jsx`, `member/MemberData.jsx`, `member/MemberAttachments.jsx` | Miembros |
| `Plans.jsx`, `components/plans/*` | Planes |
| `Subscriptions.jsx`, `PlanChangeRequests.jsx`, `components/subscriptions/*` | Suscripciones |
| `Payments.jsx`, `member/MemberPayments.jsx`, `components/payments/*` | Pagos |
| `RecoverMembers.jsx`, `member/MemberRecoveries.jsx`, `components/recoveries/*` | Recuperación |
| `Attendance.jsx`, `Checkin.jsx`, `AttendanceQR.jsx`, `AttendanceAnalytics.jsx` | Asistencias |
| `ScheduleChangeRequests.jsx`, `ScheduleSwapRequests.jsx`, `PublicRoutine.jsx` | Horarios |
| `Activities.jsx`, `ActivitySchedules.jsx`, `ScheduleEnrollments.jsx`, `MemberActivities.jsx`, `member/ActivityDashboard.jsx` | Actividades |
| `Outings.jsx`, `OutingSchedules.jsx`, `OutingEnrollments.jsx`, `member/MemberOutings.jsx` | Salidas |
| `PersonalTrainingSettings.jsx`, `PersonalTrainingAttendance.jsx`, `TrainerAgenda.jsx`, `MemberPersonalTraining.jsx` | Personal Training |
| `Routines.jsx`, `member/MemberWorkout.jsx`, `components/routines/*` | Rutinas |
| `CommunityPanel.jsx`, `member/CommunityPublicPage.jsx`, `member/MemberCommunity.jsx` | Comunidad |
| `Settings.jsx`, `dev/SettingsFlow.jsx` | Configuración |
| `Login.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `ChangePassword.jsx`, `Staff.jsx`, `onboarding/GymSetup.jsx` | Usuarios y accesos |
| `admin/AdminGyms.jsx`, `admin/AdminGymWizard.jsx`, `admin/AdminGymEdit.jsx` | Admin SaaS |
| `Dashboard.jsx`, `AttendanceAnalytics.jsx`, `Registration.jsx` | Transversales; se citan desde el documento del módulo que alimenta cada dato |

---

## 6. Huecos de cobertura detectados en Fase 0

- `frontend/src/pages/CommunityPanel.jsx` no tiene un `dev/CommunityFlow.jsx`
  equivalente al resto de los módulos. La auditoría de comunidad debe apoyarse en
  el código y en la pantalla real.
- `frontend/src/pages/Staff.jsx` y `onboarding/GymSetup.jsx` no tienen flujo dev
  propio; se cubren desde `AUDITORIA-USUARIOS-Y-ACCESOS.md`.
- `frontend/src/pages/Dashboard.jsx`, `Registration.jsx` y
  `AttendanceAnalytics.jsx` son pantallas transversales: no llevan auditoría
  propia, pero sus datos deben quedar explicados desde los módulos que los
  alimentan.
- `backend/routines` no tiene `tests.py`; su cobertura vive en
  `tests_phase_h.py`. No debe citarse un archivo inexistente.
- `backend/activities/overlap.py`, `backend/payments/views.py` y
  `backend/personal_training/overlap.py` tenían referencias con líneas fuera de
  rango en las auditorías viejas. Al migrar a símbolos, esas referencias deben
  dejar de depender del número de línea.
- `AUDITORIA-CONFIGURACION.md` quedó reescrita y verificada en Fase 7; sus
  referencias usan símbolos canónicos y no números de línea.

---

## 7. Orden de actualización

1. Fase 0: plantilla, mapa, índice, validador y piloto `AUDITORIA-MIEMBROS.md`.
2. Fase 1: usuarios/accesos y admin SaaS.
3. Fase 2: núcleo, seed y operaciones.
4. Fase 3: miembros, planes, suscripciones, pagos y recuperación.
5. Fase 4: asistencias y horarios.
6. Fase 5: actividades, salidas y personal training.
7. Fase 6: rutinas y comunidad.
8. Fase 7: configuración e integración cruzada.
9. Fase 8: cierre, validación global y publicación del índice final.
