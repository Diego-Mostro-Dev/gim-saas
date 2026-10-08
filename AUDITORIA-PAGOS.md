# Auditoría de Pagos — Cómo funciona hoy el sistema de cobros

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Está pensado para servir de base a un manual para gimnasios, por eso está escrito
> en lenguaje simple. Las referencias de código van aparte, en letra chica, para
> no ensuciar el texto.

---

## 1. El ciclo de cobro

- Cuando un socio se registra, su mes (ciclo) empieza **el mismo día en que se
  inscribe** y termina **el último día del mes**. El 1° del mes siguiente arranca
  su próximo ciclo.
- Al inscribirse se le cobra **el precio completo del plan**, con una única
  excepción: si el alta es **después del día de vencimiento** del gimnasio
  (por defecto el 10), paga **sólo los días que le quedan** del mes. Entra el
  día 10 o antes, y paga el mes entero; entra el día 20 de un mes de 31 días
  y paga 12/31 del precio. Ese primer ciclo queda marcado como prorrateado y
  la renovación siguiente se cobra completa.
- El precio queda **congelado en ese ciclo**: si el gimnasio cambia el precio del
  plan después, el mes ya emitido no se modifica.
- Si el socio tiene un **descuento asignado**, se aplica y también queda
  congelado para ese ciclo. Desactivar el descuento después no altera lo ya
  cobrado.
- La **renovación es automática**: el 1° del mes siguiente el sistema crea el
  nuevo ciclo del socio, con el mismo plan y las mismas actividades, y queda
  **pendiente de pago** hasta que el gimnasio lo cobre.
- Si el socio usa actividades, entrenamiento personal o salidas, esos ítems se
  suman a su cuota mensual y se cobran junto con el plan.

### Referencia
- Alta: `backend/members/services.py:151-179` — ciclo hoy → último día del mes.
- Prorrateo del primer ciclo: la regla se decide una sola vez al abrir la
  suscripción, `backend/subscriptions/domain.py:117-127` (sólo
  `origin="onboarding"` y `start_date.day > payment_due_day`), y factura con
  `backend/subscriptions/services.py:52-72` (`prorated_price_for`, días
  restantes / días del mes, redondeo half-up a centavos) vía
  `backend/subscriptions/services.py:36-49` (`_item_price`, en $0 para
  `is_comp`). Flag en `backend/subscriptions/models.py:57` (`Subscription.prorated`,
  sin backfill: los socios existentes no se tocan).
- Descuento congelado por ciclo: `backend/subscriptions/domain.py:109-111` y campo `discount_percent_snapshot`.
- Renovación automática: `backend/subscriptions/services.py:1284-1327` (`create_next_subscription`).
- Recalculos y el disparador del cron: `backend/config/api/tasks.py` + `.github/workflows/scheduled-tasks.yml` (cada 6 h) + middleware perezoso `backend/config/api/middleware.py`.

---

## 2. Los días del mes (vencimiento y bloqueo)

El sistema trabaja con **dos fechas que el gimnasio puede cambiar** (
*Configuración* del gimnasio). Por defecto:

| Día | Estado del socio | ¿Puede entrenar/operar? |
|-----|------------------|--------------------------|
| 1 → 10 | **Pendiente de pago** | Sí |
| 11 → 15 | **Pago vencido** | Sí (solo aviso/contador) |
| 16 en adelante | **Acceso suspendido** | **No** |

Detalles importantes:

- **El día 10** es el *día de pago* (`payment_due_day`). Hasta ahí el socio está
  "al día" aunque no haya pagado.
- **El día 16** es el *día de bloqueo* (`access_block_day`). Desde ahí el socio
  pierde el acceso hasta que el gimnasio registre su pago.
- El gimnasio puede configurar ambos días en la pantalla de Configuración, con la
  condición de que el día de bloqueo sea siempre mayor que el día de pago.
- El estado de un socio se calcula **según el día de hoy** y el saldo de su
  suscripción: si debe $0 su estado es **Al día**, sin importar el día.
- Una vez registrado el último pago que salda su deuda, el acceso se restablece
  solo, sin trámite del staff.

### Casos particulares

- **Socio nuevo que todavía no pagó ni una vez** (estado "pago inicial
  pendiente"): está bloqueado **desde el día 1**, aunque haya entrado después del
  día 10. Recién cuando el gimnasio carga su primer pago puede operar.
- **Un socio que debía al cerrar el mes** (estado bloqueado el último día) **no
  se renueva solo**: su ciclo no se genera hasta regularizar. Después de eso se
  puede recuperar (ver sección 6).
- **La deuda por sesiones, sellados o salidas no bloquea el acceso.** El bloqueo
  por pago se decide **solo** por el saldo de la suscripción mensual.
- Los socios de **cortesía** (`is_comp`) nunca se bloquean por pago: su ciclo
  nace pagado y todo se factura en $0.

### Referencia
- Estados de pago: `backend/subscriptions/services.py:1166-1190` (`get_subscription_payment_status`): `paid` / `initial_pending` / `pending` / `overdue` / `blocked`.
- Config del gimnasio: `backend/gyms/models.py:79-88` (días por defecto 10 y 16) y validación `access_block_day > payment_due_day` en `:179-186` y `gyms/serializers.py:89-93`.
- Bloqueo real (qué estados cortan el acceso): `backend/members/eligibility.py:55-75` — solo `"blocked"` e `"initial_pending"`; `overdue` NO bloquea; `is_comp` exento.
- Corte de renovación por deuda: `backend/subscriptions/services.py:1463-1555` (`_collect_renewal_candidates`, `payment_blocked`).
- Panel del gimnasio: `backend/config/api/dashboard.py:295-316` (conteos de pendientes/vencidos/bloqueados + días configurados).

---

## 3. Qué puede y qué no puede hacer un socio según su estado

**Cuando el acceso está suspendido por falta de pago, el socio NO puede:**

- Hacer check-in en el gimnasio.
- Inscribirse a actividades, salidas o entrenamiento personal, ni solicitar/confirmar cambios.
- Recuperar sesiones perdidas.
- Cambiarse de plan ni apagar su renovación automática.
- Guardar su rutina de entrenamiento.
- Ver o editar sus propios datos personales, ni cambiar su foto.

**Aunque esté suspendido, el socio SÍ puede:**

- **Subir su comprobante de pago** (es justamente la vía para destrabar el acceso).
- Ver su rutina y su estado (el sistema le muestra cuánto debe y por qué está bloqueado).
- Ver la comunidad del gimnasio.

El mensaje que ve es "Acceso suspendido por falta de pago", y en su portal se le
muestra cuánto debe y el motivo del bloqueo.

### Referencia
Bloqueo por falta de pago (devuelven 403 "Acceso suspendido por falta de pago."):
- Check-in: `backend/attendance/public_views.py:128`.
- Cambios/intercambios de horario: `backend/attendance/public_views.py:407,430,475,498`.
- Recuperación de sesiones: `backend/attendance/recovery_service.py:80,160`.
- Actividades: `backend/activities/enrollment_service.py:76` y `activities/public_views.py:44-46`.
- Salidas: `backend/outings/enrollment_service.py:71` y `outings/enrollment_request_service.py:22,69`.
- Entrenamiento personal: `backend/personal_training/public_views.py:68,111` y `assignment_service.py:109`.
- Guardado de rutina: `backend/routines/views.py:365-367`.
- Cambios de plan y renovación automática: `backend/subscriptions/public_views.py:40,66,114,150`.
- Datos del socio y foto: `backend/members/views.py:341-353` (GET y PATCH) y `:387`.
NO bloqueado a propósito:
- Subir comprobante/adjuntos: `backend/members/public_views.py:265-272`.
- Portal de rutina (devuelve estado, motivo y deuda): `backend/routines/views.py:425+,698-719`.
- Comunidad: sin gate de pago.
UI del socio bloqueado (pestañas ocultas y banner): `frontend/src/pages/member/MemberPortalLayout.jsx:339-359,461-470`.

---

## 4. Cómo se cobra

- **Quién cobra:** el personal del gimnasio, desde la pantalla de Pagos (o
  "Recuperar socios"). **El socio no se paga solo**: solo puede subir el
  comprobante, y el staff registra el pago.
- **Métodos de pago:** Efectivo, Transferencia, Tarjeta.
- **Qué se puede cobrar (conceptos):**
  - **Suscripción** — la cuota mensual del plan (incluye actividades, PT y salidas agregadas al mes).
  - **Sellado / matrícula** — monto único al inscribirse en un paquete (configurable por el gimnasio). Se cobra **una sola vez por paquete**, pero **al agregar sesiones a un paquete** el sellado vuelve a quedar pendiente.
  - **Coseguro por sesiones** — por sesión de actividades; el valor por sesión lo define la **obra social** configurada del socio, no el gimnasio.
  - **Entrenamiento personal** — paquete de sesiones (cada sesión a su precio).
  - **Salida** — paquete de salidas por sesiones.
  - **Saldo a favor** — asiento automático, no se cobra (ver sección 5).
- **Un pago apunta a UNA sola cosa** (una suscripción, un paquete, un sellado).
  No existe "pagar todo junto con un solo pago": la deuda total del socio suma
  todos sus items, pero cada pago se registra por separado.
- **No se puede cobrar de más** que el saldo pendiente de ese item. Si ya está
  saldado y se intenta cobrar igual, el sistema lo rechaza.
- **Aviso de pago duplicado:** si en las últimas 24 horas ya se registró un pago
  en efectivo para esa misma suscripción, el sistema pide confirmación antes de
  guardar el segundo.
- **Editar y borrar pagos:** el staff puede modificar o eliminar un pago (con
  doble confirmación "no se puede deshacer"). Al borrar, el sistema recalcula
  solo los saldos.
- **Resumen y exportación:** la pantalla de Pagos muestra total recaudado,
  cantidad de pagos, y valores en efectivo/transferencia. Se puede **descargar el
  detalle mensual en CSV** (fecha, socio, concepto, detalle, monto, método,
  notas).
- **No existe cobro online** (ni pasarela ni tarjeta en el portal del socio), ni
  pago en cuotas extendido (ej. pagar 3 meses juntos).

### Referencia
- Conceptos y métodos: `backend/payments/models.py:8-23`.
- Un pago = un target (FKs `subscription`, `applied_to`, `enrollment`, `personal_training_assignment`, `outing_enrollment`).
- Validación de monto (no pagar más que el saldo): `backend/payments/serializers.py:117-141` (`_validate_amount`) y `:143+` (`_validate_package_amount`).
- Sellado: `backend/activities/models.py:193-203`, cobro exacto y único en `backend/payments/serializers.py:185-197`; el sellado **vuelve a quedar pendiente al regenerar/agregar sesiones de un paquete** en `backend/activities/session_service.py:118` y `backend/personal_training/session_service.py:93`.
- No se renueva un paquete con sesiones sin cobrar: `activities/session_service.py:112`, `personal_training/session_service.py:87`, `outings/session_service.py:111`.
- Coseguro según obra social: `backend/members/models.py:22-33` (`HealthInsurance.session_price`).
- Editar/borrar recalcula: `backend/payments/views.py:142-190` (`perform_destroy`) y `payments/serializers.py:600`.
- Aviso de duplicado de efectivo: `frontend/src/utils/paymentAlerts.js` (ventana 24 h).
- Export CSV mensual: `backend/payments/views.py:71-140`.
- Donde el staff cobra: `frontend/src/pages/Payments.jsx` y `frontend/src/pages/RecoverMembers.jsx`.
- Portal del socio (solo lectura): `frontend/src/pages/member/MemberPayments.jsx`.

---

## 5. La cuenta del socio (deuda y saldo a favor)

- La **deuda total** de un socio suma:
  - el saldo pendiente de su o sus suscripciones (cuota mensual),
  - los paquetes de sesiones de actividades, PT y salidas que le faltan pagar,
  - los sellados pendientes.
- Esa deuda se muestra en el portal del socio y en las pantallas del staff
  ("Estado comercial" y "Recuperar socios").
- **Saldo a favor (crédito):** se genera automáticamente cuando el total de un
  ciclo **baja** después de que el socio ya pagó (ej. se activa un pase de
  cortesía, cambia un descuento o cambia el plan). La diferencia queda como
  saldo a favor del socio.
- Ese saldo **se consume solo** al siguiente ciclo: se descuenta de lo que el
  socio debe el mes que viene, hasta cubrir su total (no se puede usar de otra
  forma ni más allá de un ciclo).
- **No existen reembolsos en efectivo:** el saldo a favor solo se reutiliza
  contra futuros ciclos.
- **No hay intereses ni recargo por mora**, ni factura/IVA: la única exportación
  es el CSV mensual de pagos.

### Referencia
- Deuda total por socio: `backend/subscriptions/services.py:1020+` (`member_total_outstanding_debt`) y deudas por paquete en `:736/:783/:820/:857`.
- Endpoints de deuda: `backend/subscriptions/views.py:179-265` (`/outstanding` general y por socio).
- Saldo a favor: `backend/subscriptions/services.py:433` (`member_credit_balance`), `:457-524` (`ensure_overpayment_credit` — se crea solo cuando baja el total), consumo al renovar `:1325` (`consume_member_credit`).
- Sin reembolsos: no existe flujo de reembolso/refund en el código.
- Lo que ve el staff ("Estado comercial"): `frontend/src/pages/Subscriptions.jsx` y `frontend/src/components/subscriptions/MemberSubscriptionCard.jsx`.

---

## 6. Recuperar a un socio

- Un socio se puede **recuperar** (reactivar) solo si **no tiene ninguna deuda
  pendiente** (ni suscripciones, ni sesiones, ni sellados).
- El flujo lo hace el staff desde "Recuperar socios": el sistema verifica que la
  deuda esté saldada y abre un **ciclo nuevo desde hoy hasta fin de mes**, que
  queda pendiente de pago hasta que se cobre.
- Si no cumple las condiciones (debe algo, ya tiene ciclo vigente o futuro), el
  sistema lo avisa y no procede.

### Referencia
- `backend/subscriptions/services.py:1333-1410` (`recover_member`): exige deuda total $0 (`member_total_outstanding_debt`), sin ciclo vigente ni futuro, y crea el ciclo `origin="recovery"` hasta fin de mes.
- El "es recuperable" en la lista de socios: `backend/members/serializers.py:258-410` (mismas condiciones, en modo lectura).

---

## 7. Lo que el sistema NO hace hoy (para no prometerlo en el manual)

- **Prorratea sólo el primer ciclo de un alta posterior al día de vencimiento**
  (ver §1). No prorratea cambios de plan, recuperaciones ni renovaciones, y no
  reparte ningún otro movimiento por días.
- **No tiene cobro online** (ni tarjeta desde el portal del socio ni pasarela).
- **No manda recordatorios ni emails** de vencimiento (solo restablecimiento de contraseña).
- **No cobra intereses ni recargos** por atraso.
- **No emite factura ni recibo** (solo el CSV mensual).
- **No reembolsa dinero**: el saldo a favor se usa contra futuros ciclos.
- **No permite pagar varios meses juntos** ni un "pagar todo" en un solo pago.
- **No registra quién cobró**: el pago no guarda el usuario que lo cargó.
- **No tiene cierre de caja** (arqueo) ni reportes de mora.

---

### Notas de entorno para leer el código
- Zona horaria: `America/Argentina/Buenos_Aires` (`backend/config/settings.py:461`).
- Toda operación de pagos se filtra automáticamente por el gimnasio del usuario logueado (`backend/core/mixins.py:4-19`).
- Al borrar o modificar un pago, los saldos se recalculan automáticamente (`sync_subscription_paid`, `sync_enrollment_paid`, `sync_assignment_paid`, `sync_outing_paid`).