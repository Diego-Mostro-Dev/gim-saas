# Auditoría de Planes — Cómo funciona hoy el catálogo de planes

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Está pensado para servir de base a un manual para gimnasios, por eso está escrito
> en lenguaje simple. Las referencias de código van aparte, en letra chica, para
> no ensuciar el texto.

---

## 1. Qué es un plan

- Un **plan** es la etiqueta del gimnasio con la que se vende la membresía
  (nombre, descripción, precio). Cada socio, al inscribirse, queda asociado a un
  plan, y de ahí sale su cuota mensual.
- Los campos que importan:
  - **Precio**: lo que cuesta el plan por mes. Al emitir cada período, el precio
    queda **congelado en la línea de facturación**: cambiarlo después no toca los
    meses ya emitidos.
  - **Visitas semanales**: cuántos horarios de gimnasio puede tener el socio por
    semana. Vacío = ilimitado. Este límite se valida al inscribirlo y al pedir un
    cambio de plan; no cambia el precio.
  - **Duración (días)**: es **sólo informativa**. La facturación real es mensual
    por período calendario (del día del alta o el 1° hasta fin de mes) e ignora
    este campo para calcular fechas.
  - **Activo**: el interruptor de publicación. Un plan inactivo deja de ofrecerse
    a los socios, pero los que ya lo tienen siguen con él.
- Los planes se agrupan en **servicios** (por defecto el servicio "Gimnasio" del
  propio gimnasio). El nombre del plan es único dentro del gimnasio.
- Cada plan pertenece a **un solo gimnasio**: la API filtra todo por el gimnasio
  del usuario logueado, y un plan de otro gimnasio no se puede usar.

### Referencia
- Modelo: `backend/plans/models.py:80-120` (`MembershipPlan`); duración informativa
  `backend/plans/models.py:98-104` (help_text del campo); visitas semanales
  `backend/plans/models.py:105`; activo `backend/plans/models.py:106`; nombre único
  por gimnasio `backend/plans/models.py:117`.
- Servicios y servicio por defecto: `backend/plans/models.py:5-38`
  (`Service.get_default_for_gym`).
- Precio congelado por línea al emitir: `backend/subscriptions/services.py:22-43`
  (`ensure_subscription_item`, `_item_price`) y nombre congelado
  `backend/subscriptions/models.py:248`.
- Filtrado por gimnasio: `backend/core/mixins.py:4-19`.

---

## 2. El plan base oculto ("Solo actividades")

- Cada gimnasio tiene un **plan base interno** ("Base Access", precio $0) que
  **no aparece en ningún listado**: ni en el staff ni en el portal. No se puede
  crear ni editar desde la API; lo crea y protege el sistema.
- Sirve para dos casos:
  - **Socios sólo de actividades**: se inscriben a clases sin pagar
    membresía de gimnasio; su suscripción mensual nace con el plan base en $0.
  - **Pases de cortesía**: al activarle la cortesía a un socio, su ciclo pasa al
    plan base y todo se factura en $0.
- El socio nunca ve el nombre interno: donde corresponde se traduce a
  **"Solo actividades"**, y si además tiene cortesía activa se muestra
  **"Pase de cortesía"**.
- El plan base **no se puede elegir** al cambiar de plan: está bloqueado por
  validación.

### Referencia
- Creación/protección: `backend/plans/services.py:40-61`
  (`ensure_base_plan_for_gym`, `is_base=True`, precio $0) y bandera de solo
  lectura `backend/plans/serializers.py:18,32-37`.
- Oculto en el CRUD del staff: `backend/plans/views.py:14`
  (el queryset excluye `is_base=True`).
- Traducción de nombre: `backend/plans/services.py:4-37`
  (`public_plan_name`, `display_plan_name`, "Solo actividades" /
  "Pase de cortesía").
- Uso en cortesía: `backend/members/services.py:159-170`; uso en sólo
  actividades: `backend/members/services.py:172-182`.
- Bloqueo al cambiar de plan: `backend/subscriptions/validators.py:43-47`.

---

## 3. Ciclo de vida de un plan (lo que hace el staff en la pantalla "Planes")

1. **Crear**: el staff carga nombre, descripción, precio, duración (informativa),
   visitas semanales y si está activo. Si no elige servicio, el sistema lo asigna
   al servicio "Gimnasio" del gimnasio. No hay más campos: ni cupos por día, ni
   fechas de vigencia, ni impuestos.
2. **Editar**: se pueden tocar todos los campos. Los meses ya emitidos no se
   tocan: precio y nombre quedan congelados en las líneas existentes. El límite
   de visitas semanales se usa en lo que venga adelante (cambios de plan), no
   reescribe lo ya anotado.
3. **Activar / desactivar**: es un simple checkbox "Activo". Un plan inactivo:
   - desaparece de la lista pública de autoinscripción,
   - desaparece de la lista de planes que ve el socio para cambiarse,
   - **sigue apareciendo** en el listado del staff, que lo ve marcado,
   - y **no afecta a los socios que ya lo tienen**: su ciclo y su renovación
     siguen con ese plan.
4. **Eliminar**: se borra de la lista con confirmación. Si el plan todavía está
   referenciado por líneas de facturación de socios o por solicitudes de cambio,
   el sistema **rechaza el borrado** (protección de integridad): primero hay que
   dejar de usarlo.
5. El **plan base nunca aparece** en esta pantalla y no se puede borrar desde
   la API.

Además, al dar de alta un gimnasio (onboarding del admin o seed de demo) el
sistema crea el plan base y luego los planes que vinieron en la configuración.

### Referencia
- CRUD del staff: `backend/plans/views.py:13-24` (`MembershipPlanViewSet`,
  servicio por defecto en `perform_create`) con
  `frontend/src/pages/Plans.jsx` y `frontend/src/components/plans/PlanForm.jsx`.
- Validaciones del formulario: `backend/plans/serializers.py:25-30`
  (visitas ≥ 1 o vacío), `:39-63` (el servicio debe ser del mismo gimnasio).
- Desactivado, oculto a socios: lista pública `backend/members/public_views.py:250-254`
  y portal del socio `backend/routines/views.py:635-639`
  (ambos filtran `active=True, is_base=False`).
- Borrado protegido: `SubscriptionItem.plan` y
  `PlanChangeRequest.requested_plan` son `PROTECT`
  (`backend/subscriptions/models.py:125-130,223-227`) mientras que
  `Subscription.plan` es `CASCADE` (`backend/subscriptions/models.py:25`).
- Alta de gimnasio con planes: `backend/admins/services.py:95-113`; seed demo:
  `backend/seed/base.py:181-203` con `backend/seed/data/plans.py`.

---

## 4. Cómo se elige el plan al registrar un socio

Hay tres caminos, y el plan que queda es distinto en cada uno:

| Camino | Quién lo hace | Qué plan queda |
|--------|---------------|----------------|
| **Alta de staff** | El staff, en la pantalla de socios | El plan de pago que elija. Si marca cortesía, va directo al plan base pagado. Si es sólo actividades (sin gimnasio), plan base en $0 |
| **Autoinscripción** (portal público con el código del gimnasio) | El propio socio | Elige entre los planes **activos y de pago** (el sistema valida que no sea el base). Cortesía y descuento los asigna después el staff |
| **Onboarding del gimnasio** | El admin, al crear el gimnasio | Carga los planes con los que arranca el gimnasio, además del plan base que el sistema crea solo |

Detalles:

- En el alta de staff, si se piden horarios de gimnasio **el plan es
  obligatorio** (salvo cortesía): no se puede abrir un ciclo sin plan.
- El primer ciclo va **desde el día del alta hasta fin de mes**. Si el alta cae
  después del día de vencimiento del gimnasio, se prorratea (ver
  AUDITORIA-PAGOS §1). El socio de cortesía nace con el plan base **ya pagado**.
- El límite de **visitas semanales** del plan elegido acota cuántos horarios se
  pueden anotar en esa misma inscripción.
- En la autoinscripción, el socio **no puede autoasignarse cortesía ni
  descuento**: el sistema los ignora si vienen en el pedido.

### Referencia
- Alta por staff: `backend/members/services.py:101-182` — plan obligatorio
  `:137-141`, ciclo con el plan elegido `:148-157`, cortesía con plan base
  pagado `:159-170`, sólo actividades con plan base `:172-182`.
- Autoinscripción: `backend/members/public_views.py:159-212` — cortesía y
  descuento se descartan `:168-173`, el plan debe ser de pago y del gimnasio
  `:181-188`; lista de planes públicos
  `backend/members/public_views.py:240-266` (activos, no base, ordenados por
  precio).
- Límite de horarios en el alta: `frontend/src/components/members/MemberForm.jsx:109`
  (usa `weekly_visits` del plan elegido).
- Ciclo y prorrateo del primer ciclo: `backend/subscriptions/domain.py:97-127`
  (`open_subscription`; `prorated=True` sólo en `origin="onboarding"` cuando
  `start_date.day > payment_due_day`).
- Onboarding del gimnasio: `backend/admins/services.py:95-113`.

---

## 5. Cambio de plan

Un socio puede **cambiarse de plan**, pero no "a cualquier momento": el cambio
es un pedido con estado que aprueba el staff y que rige en la **frontera del
mes**. (El detalle de la facturación y la renovación relacionada está en
AUDITORIA-SUSCRIPCIONES §3; acá va el recorrido del pedido.)

**Quién lo pide.** El socio desde su portal, o el staff a nombre del socio. El
gimnasio puede deshabilitar los cambios en Configuración (por defecto están
habilitados). Si el socio está suspendido por falta de pago, no puede pedirlo ni
cancelarlo desde su portal.

**Qué se valida al crear el pedido** (si algo falla, ni siquiera se guarda):

- Que el socio tenga un ciclo vigente.
- Que el gimnasio permita cambios de plan.
- Que el plan pedido **no sea el plan base**, sea del mismo gimnasio y sea
  distinto al actual.
- **Un solo pedido pendiente por socio** (también lo garantiza la base de datos).
- Que no exista ya otro cambio **aprobado con fecha futura**.
- Que los horarios elegidos tengan capacidad y que su cantidad **no supere las
  visitas semanales** del plan nuevo.

**El recorrido del pedido:**

```
 (el socio o el staff piden el cambio)
              │
              ▼
        ┌──────────┐  el staff rechaza   ┌────────────┐
        │ Pendiente│ ──────────────────▶ │ Rechazado  │
        └────┬─────┘                     └────────────┘
             │ el socio cancela
             ▼
   ┌───────────────────┐
   │ Cancelado por el  │
   │ socio             │
   └───────────────────┘

        el staff aprueba
             │
             ├─ ¿tiene ciclo vigente? ── NO ──▶ fecha de efecto: HOY
             │                                  → queda Ejecutado en el acto:
             │                                    se abre el ciclo con el plan
             │                                    nuevo ahora mismo
             │
             └─ SI (lo normal) ────────▶ fecha de efecto: 1° del mes siguiente
                                          → queda Aprobado y el sistema
                                            RESERVA los horarios elegidos
                                            (ocupan lugar desde ya)
```

**Después de aprobado (efecto el 1° del mes):**

1. El pedido espera. El socio ve "cambio programado"; el staff puede cancelarlo
   mientras sea futuro (al cancelar se libera la reserva de horarios).
2. El día 1, el mismo proceso de renovación del sistema **aplica el cambio**:
   crea (o usa) el ciclo del mes con el plan nuevo, sincroniza los horarios del
   socio a los elegidos y marca el pedido **Ejecutado**. Es idempotente: correr
   dos veces no duplica nada.
3. La ejecución **no depende de la deuda** del socio: una vez aprobado, se
   aplica aunque esté debiendo.
4. Al aprobar o rechazar un pedido se **cancelan los pedidos de cambio de
   horario** que el socio tuviera pendientes.

### Referencia
- Estados del pedido: `backend/subscriptions/models.py:92-185`
  (`pending/approved/executed/rejected/cancelled_by_member/cancelled_by_staff`;
  constraint "un solo pendiente por socio" `:179-185`).
- Validaciones al crear: `backend/subscriptions/validators.py:26-135`.
- Habilitación por gimnasio: `backend/gyms/models.py:100`
  (`allow_plan_changes`, por defecto `True`), toggle en
  `frontend/src/pages/Settings.jsx:1341-1358`.
- Quién lo pide: socio `backend/subscriptions/public_views.py:18-56`
  (puerta de pago `:40-44`), staff `backend/subscriptions/views.py:269-453`.
- Aprobar / rechazar / cancelar (staff): `backend/subscriptions/views.py:290-378`
  — qué estados admite cada acción `:305-319`, fecha de efecto `:333`
  (`calculate_effective_date`, en `backend/subscriptions/services.py:1296-1300`),
  efecto inmediato `:342-366`, reserva de horarios `:380-401`, sincronización de
  horarios `:403-444`, y cancelación de pedidos de horario pendientes `:446-453`.
- Cancelación (socio): `backend/subscriptions/public_views.py:59-104`; de un
  aprobado futuro, libera reservas: `backend/subscriptions/services.py:1232-1247`
  (`cancel_future_plan_change`).
- Ejecución el día 1: `backend/subscriptions/services.py:1698-1722`
  (`_apply_all_due_plan_changes`, nunca condicionada por deuda), idempotente en
  `:1776-1839` (`apply_plan_change`), y la renovación honra el cambio aprobado
  en `:1725-1739` (`_resolve_plan`).
- Pantallas: socio `frontend/src/pages/member/GymDashboard.jsx:455-466` con
  `frontend/src/components/plans/PlanChangeModal.jsx` (elige plan y horarios,
  con el contador de visitas semanales); staff
  `frontend/src/pages/PlanChangeRequests.jsx` (aprobar / rechazar).

---

## 6. Lo que el sistema NO hace hoy (para no prometerlo en el manual)

- **No deja vender un plan "por días"**: la duración del plan es informativa;
  todo se factura por mes calendario.
- **No prorratea cambios de plan ni renovaciones**; el único prorrateo es el
  primer ciclo de un alta posterior al día de vencimiento y la cortesía
  (AUDITORIA-PAGOS §1 y §7, AUDITORIA-SUSCRIPCIONES §5).
- **No permite elegir la fecha** en que rige un cambio de plan: es hoy (sin
  ciclo vigente) o el 1° del mes siguiente.
- **No admite dos pedidos de cambio de plan** a la vez, ni cambiar al mismo
  plan ni al plan base.
- **No ofrece planes con vigencia limitada** (fechas "desde/hasta"), ni
  planes por cantidad de usos, ni cuotas por socio: el ciclo termina siempre el
  último día del mes.
- **No versiona el catálogo**: no hay historial de precios; lo congelado vive en
  cada período emitido, no en el plan.
- **No cobra el cambio de plan en el momento** ni tiene botón para "pagar la
  diferencia": la plata se acomoda en la facturación del ciclo (ver el caveat del
  saldo a favor en AUDITORIA-SUSCRIPCIONES §8, problema P21).
- **No manda avisos por email ni WhatsApp** cuando un plan se crea, se
  desactiva o cuando se aprueba un cambio.
- **No bloquea la renovación** de un socio cuyo plan quedó desactivado: el plan
  sigue vigente para quien ya lo tiene.

---

### Notas de entorno para leer el código

- Zona horaria: `America/Argentina/Buenos_Aires` (`backend/config/settings.py:461`).
- Toda operación de staff se filtra automáticamente por el gimnasio del usuario
  logueado (`backend/core/mixins.py:4-19`); el portal público entra por código
  del gimnasio o token del socio.
- El CRUD de planes es un `ModelViewSet` simple
  (`backend/plans/views.py:13-24`): no tiene acciones extra (aprobar, duplicar,
  etc.), sólo CRUD + el filtro `is_base=False`.
- El plan base se traduce a lenguaje del socio en cada pantalla con
  `public_plan_name` / `display_plan_name` (`backend/plans/services.py:9-37`);
  si un lugar muestra el nombre crudo del snapshot, el traductor de snapshots es
  `public_plan_name_from_snapshot` (`:33-37`).
- El flujo visual de esta feature vive en `frontend/src/dev/PlansFlow.jsx`
  (sólo desarrollo) y se alimenta de este documento.
