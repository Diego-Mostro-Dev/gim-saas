# Auditoría de Admin SaaS — Cómo funciona hoy el panel central

> Verificado contra: `f5b4b07`
> Fecha: 2026-10-30
> Alcance: panel central para superusuarios, alta/edición de gimnasios, features, configuración inicial vía wizard, scoping central vs por gimnasio. No cubre configuración interna del gimnasio ni facturación SaaS avanzada.
> Documentos relacionados: `AUDITORIA-USUARIOS-Y-ACCESOS.md`, `AUDITORIA-NUCLEO-REGLAS.md`, `AUDITORIA-OPERACIONES.md`
> Código cubierto: `backend/admins`, `backend/gyms`, `backend/core/permissions.py`
> Estado: verificado

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.

---

## 1. Qué es y para qué sirve

El panel central (SaaS) permite al **superusuario** (`IsSuperUser`) crear y configurar gimnasios desde un único punto. Gestiona el catálogo de features, crea la estructura inicial (configuración, planes, horarios, descuentos, obras sociales, fechas cerradas) y opcionalmente crea/enlaza el dueño. Todo esto queda aislado del scoping por gimnasio.

## 2. Cómo funciona hoy

### 2.1 Listado y creación
- **Listar**: `admins.views.AdminGymListCreateView.get` → `AdminGymListSerializer`, ordenado por `-created_at`, `name`.
- **Crear**: `admins.views.AdminGymListCreateView.post` usa `AdminGymCreateSerializer`. Llama a `admins.services.create_gym_with_config(validated_data)`. Si falla con `ValueError`, devuelve 400. Devuelve `GymSerializer` + `owner_created`.
- **Detalle/edición**: `admins.views.AdminGymDetailView.get/patch`. En PATCH permite actualizar `features` haciendo merge (`{**gym.features, **features}`) además de otros campos via `AdminGymUpdateSerializer`.

### 2.2 Catálogo de features
- **Features**: `admins.views.AdminFeaturesView.get` devuelve `{"features": feature_catalog()}` desde `gyms.features`. El catálogo es data-driven para configurarse al crear gimnasio.

### 2.3 Servicio de creación con configuración inicial
`admins.services.create_gym_with_config(data)` orquesta:
- Crea/actualiza `Gym` con datos base (nombre, slug, contactos, días de cobro/bloqueo, etc.)
- Aplica `features` seleccionados
- Crea **plan base** (`MembershipPlan` con `is_base=True`) si no existe
- Crea **plan/es del wizard** (`plans` enviados)
- Crea **slots** de horario (`ScheduleSlot`) si se envían
- Crea **descuentos** (`Discount`) si se envían
- Crea **obras sociales** (`HealthInsurance`) si se envían
- Crea **fechas cerradas** (`GymClosedDate`) si se envían
- Si `features.activities=True` y se envían `activities`, crea `Service` + `Activity` + `ActivitySchedule` asociados
- Manejo de **dueño**: según payload `owner.mode` puede enlazar/crear; devuelve `owner_created` booleano. El `onboarding_code` del gimnasio queda disponible para enlace público.

### 2.4 Permisos
- Todas las vistas usan `core.permissions.IsSuperUser`. Un usuario normal (owner/staff) obtiene 403. El superusuario ve todo; el scoping por gimnasio no aplica al panel central.

## 3. Reglas y casos borde

- **Solo superusuario**: acceso estrictamente central.
- **Merge de features en PATCH**: al actualizar, se hace merge parcial para no perder features existentes.
- **Plan base obligatorio**: se asegura la existencia del plan base; además se crean los planes del wizard.
- **Actividades condicionales**: solo se crean si feature `activities` habilitado y payload trae `activities`.
- **Onboarding URL**: el gimnasio queda con `onboarding_code` usable para alta pública de dueño (ver `AUDITORIA-USUARIOS-Y-ACCESOS.md`).
- **Configuración atómica**: creación coordinada desde servicio para dejar el gimnasio listo para operar.

## 4. Roles y pantallas

| Rol | Puede hacer | Pantalla / flujo |
|---|---|---|
| Superusuario central | Listar/crear/editar gimnasios, ver catálogo de features | Panel central SaaS (`frontend/src/pages/admin/AdminGyms.jsx`, `frontend/src/pages/admin/AdminGymWizard.jsx`) |
| Dueño/Staff del gimnasio | Sin acceso al panel central (403) | N/A |

## 5. Lo que el sistema NO hace hoy

- **No hay multi-tenant billing** complejo documentado aquí.
- **No hay suspensión/eliminación masiva** con flujos especiales descritos.
- **No hay roles intermedios para el panel central** (solo superusuario).

## 6. Problemas y decisiones de negocio

**Decisiones de negocio:**
- **Panel central separado del scoping**: el superusuario opera globalmente, distinto a dueños por gimnasio.
- **Wizard completo**: al crear gimnasio se deja configurado con estructura mínima operativa.
- **Features data-driven**: catálogo centralizado para habilitar/deshabilitar módulos.

**Problemas:** Ver `BUGS.md` si aplica.

## 7. Referencias técnicas

```text
backend/admins/views.py · AdminGymListCreateView
backend/admins/views.py · AdminGymDetailView
backend/admins/views.py · AdminFeaturesView
backend/admins/serializers.py · AdminGymListSerializer
backend/admins/serializers.py · AdminGymCreateSerializer
backend/admins/serializers.py · AdminGymUpdateSerializer
backend/admins/services.py · create_gym_with_config
backend/admins/urls.py · urlpatterns
backend/admins/tests.py · AdminGymApiTests
backend/admins/tests.py · test_non_superuser_gets_403
backend/admins/tests.py · test_create_gym_without_activities
backend/admins/tests.py · test_create_gym_with_activities
backend/gyms/features.py · feature_catalog
backend/gyms/models.py · Gym
backend/gyms/serializers.py · GymSerializer
backend/core/permissions.py · IsSuperUser
frontend/src/pages/admin/AdminGyms.jsx · AdminGyms
frontend/src/pages/admin/AdminGymWizard.jsx · AdminGymWizard
frontend/src/pages/admin/AdminGymEdit.jsx · AdminGymEdit
```

## 8. Snapshot de referencias

```text
backend/admins/views.py:1-140 (al commit f5b4b07)
backend/admins/services.py:1-220 (al commit f5b4b07)
backend/admins/tests.py:1-200 (al commit f5b4b07)
backend/gyms/features.py:1-80 (al commit f5b4b07)
```

## 9. Checklist de verificación

- [x] Leí el documento anterior completo
- [x] Recorrí `models → serializers → services → views → frontend`
- [x] Revisé tests (`admins/tests.py`, `core/tests_admin_scoping.py`)
- [x] Crucé problemas con `BUGS.md`/`PLAN-bugs.md`
- [x] Actualicé “Lo que NO hace”
- [x] Actualicé “Problemas y decisiones”
- [x] Convertí referencias al formato híbrido
- [x] Ejecuté validador de referencias
- [x] Ejecuté tests relacionados
- [x] Actualicé fila en `AUDITORIA-INDEX.md`
