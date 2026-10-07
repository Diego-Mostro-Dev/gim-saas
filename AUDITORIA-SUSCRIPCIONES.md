# Auditoría de suscripciones — Cómo funciona hoy el sistema

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Está pensado para servir de base a un manual para gimnasios, por eso está escrito
> en lenguaje simple. Las referencias de código van aparte, en letra chica, para
> no ensuciar el texto.

---

## 1. Qué es una suscripción

- Una **suscripción** es el registro de "este socio tiene este plan, en este
  período". Ocupa un rango de fechas: empieza el día del alta (o el 1° del mes,
  según el caso) y termina **el último día del mes**.
- Cada período guarda cuatro cosas que importan:
  - el **plan**,
  - si está **pagado** (una marca que el sistema recalcula solo, no es la fuente
    de la verdad),
  - si la **renovación automática** está prendida o apagada,
  - y el **descuento congelado** del día en que se emitió.
- El mes se factura con **ítems** (líneas): una línea por el plan, una por cada
  actividad, una por el entrenamiento personal mensual y una por cada salida.
  Cada línea guarda el **precio y el nombre congelados**, así que cambiar el
  precio o el nombre del plan después **no toca los meses ya emitidos**.
- El **total del mes** no está guardado: es la suma de las líneas activas menos
  el descuento, calculada en cada consulta.
- **No existe el estado "dada de baja".** Una suscripción no se cancela con un
  botón: lo único que se puede apagar es la renovación automática, y el período
  vence por fecha.
- **Un socio no puede tener dos períodos que se pisen.** Eso lo impide la base
  de datos y además se chequea antes de crear.
- Cada período guarda **por qué nació**: alta, renovación automática, cambio de
  plan o recuperación. En la pantalla del staff eso se ve como "Origen".

### Referencia
- Modelo: `backend/subscriptions/models.py:8-78` (`Subscription`), orígenes `:10-15`.
- Ítems: `backend/subscriptions/models.py:184-313` (`SubscriptionItem`), tipos
  `:191-196`, nombre congelado `:248`, precio congelado `:262`.
- Un solo período por fechas: `backend/subscriptions/models.py:70-73` (constraint único) y chequeo de
  superposición en `backend/subscriptions/domain.py:97-106`.
- Precio del plan congelado al emitir: `backend/subscriptions/services.py:22-43`
  (`ensure_subscription_item`, `_item_price`).
- Total: `backend/subscriptions/services.py:258-309` (`calculate_subscription_total`).

---

## 2. De dónde sale una suscripción

Hay cinco caminos, y no todos los hace la misma persona:

| Camino | Quién lo hace | Qué queda |
|--------|---------------|-----------|
| **Alta de socio** | El staff, eligiendo plan | Ciclo desde hoy hasta fin de mes, **pendiente de pago** hasta que se cobre |
| **Inscripción del propio socio** (portal público) | El socio | Igual: nace sin pagar; además no puede elegir cortesía ni descuento |
| **Renovación automática** | El sistema, el 1° del mes | Ciclo nuevo con el mismo plan y los mismos ítems, pendiente de pago |
| **Cambio de plan** | Lo pide el socio o el staff; aprueba el staff | Ciclo nuevo con el plan nuevo (sección 3) |
| **Recuperación** | El staff, desde "Recuperar socios" | Ciclo nuevo desde hoy hasta fin de mes (ver AUDITORIA-PAGOS §6) |

Detalles:

- Si el socio es de **cortesía**, nace con el plan base y **ya pagado**.
- Si es "solo actividades" (sin gimnasio), nace con el plan base en $0.
- Las actividades, el entrenamiento y las salidas del período anterior **se
  copian** al ciclo nuevo: el socio no los pierde al renovar.
- **No se prorratea al inscribirse:** quien entra el día 20 paga el mes
  completo (ver AUDITORIA-PAGOS §1 y §7).

### Referencia
- Alta por staff: `backend/members/services.py:148-182` (con plan `:148-157`,
  cortesía `:159-170`, solo actividades `:172-182`); el ciclo va de hoy a fin de
  mes en los tres casos.
- Inscripción pública: `backend/members/public_views.py:163-188` — cortesía y
  descuento se ignoran (`:169-173`) y el plan tiene que ser de pago (`:181-188`).
- Renovación: `backend/subscriptions/services.py:1284-1330`
  (`create_next_subscription`); copia de ítems `:46-197`.
- Recuperación: `backend/subscriptions/services.py:1333-1432` (`recover_member`).

---

## 3. Cambio de plan

**Quién lo pide.** Dos formas:

- El **socio**, desde su portal (botón "Solicitar cambio de plan"): elige el plan
  nuevo y arma los horarios que quiere para ese plan. Si está suspendido por
  falta de pago, no puede pedirlo ni cancelarlo.
- El **staff**, a nombre del socio, con el mismo formulario.

**Qué tiene que cumplir el pedido** (si no, ni siquiera se guarda):

- Que el gimnasio tenga habilitados los cambios de plan (Configuración; por
  defecto están habilitados).
- Que no sea el plan base, que no sea el mismo plan que ya tiene, y que sea un
  plan de ese mismo gimnasio.
- **Un solo pedido pendiente por socio** a la vez.
- Que no exista ya otro cambio aprobado con fecha futura.
- Que los horarios elegidos entren en la capacidad del gimnasio y que la
  cantidad no supere las **visitas semanales** del plan nuevo.

**Qué pasa después:**

1. El pedido queda **Pendiente**. El socio puede cancelarlo; el staff también
   (en la pantalla hoy aprueba o rechaza; la cancelación existe en la API).
2. El staff lo **Aprueba** (o lo **Rechaza**, con notas opcionales). Al aprobar
   se calcula la fecha de efecto:
   - **hoy**, si el socio no tiene ciclo vigente;
   - **el 1° del mes siguiente**, si tiene ciclo (que es lo normal).
3. Si es para el mes que viene, el pedido queda **Aprobado** y el sistema
   **reserva los horarios elegidos**; el día 1 lo aplica solo, junto con la
   renovación.
4. Si es para hoy, el sistema **crea el ciclo nuevo con el plan nuevo en ese
   momento**.
5. Cuando termina, el pedido pasa a **Ejecutado**.
6. Si se rechaza o se cancela, ahí termina.

**A tener en cuenta:**

- Aprobar o rechazar un cambio **cancela los pedidos de cambio de horario**
  pendientes del socio (ver AUDITORIA-HORARIOS).
- El cambio cae en la **frontera del mes**, así que **no hay prorrateo por
  cambiar de plan a mitad de mes**: lo ya pagado del período en curso queda como
  está, y el ciclo nuevo ya nace con el precio del plan nuevo.
- Un cambio de plan **no depende de la deuda**: una vez aprobado, se aplica
  aunque el socio esté debiendo.

### Referencia
- Puede pedirlo el socio: `backend/subscriptions/public_views.py:18-56`
  (puerta de pago `:40-44`); el staff: `backend/subscriptions/views.py:269-453`.
- Reglas del pedido: `backend/subscriptions/validators.py:26-135` — gimnasio
  `backend/subscriptions/validators.py:37-41`, no plan base
  `backend/subscriptions/validators.py:43-47`, mismo gimnasio
  `backend/subscriptions/validators.py:55-59`, plan distinto
  `backend/subscriptions/validators.py:61-65`, un solo pendiente
  `backend/subscriptions/validators.py:67-76` (y constraint en
  `backend/subscriptions/models.py:168-174`), sin aprobado futuro
  `backend/subscriptions/validators.py:78-89`, capacidad
  `backend/subscriptions/validators.py:91-124`, visitas semanales
  `backend/subscriptions/validators.py:126-135`.
- Habilitación por gimnasio: `backend/gyms/models.py:100`
  (`allow_plan_changes`, por defecto `True`).
- Estados: `backend/subscriptions/models.py:82-89`.
- Fecha de efecto: `backend/subscriptions/services.py:1267-1271`
  (`calculate_effective_date`).
- Aprobar / rechazar / cancelar (staff): `backend/subscriptions/views.py:290-378`;
  efecto inmediato `:342-365`; reserva de horarios `:380-401`. El camino del 1°
  del mes lo ejecuta el job: `backend/subscriptions/services.py:1669-1693`
  (`_apply_all_due_plan_changes`), disparado desde
  `backend/subscriptions/services.py:1933`.
- Cancelación por el socio: `backend/subscriptions/public_views.py:59-104`;
  de un aprobado futuro por el staff:
  `backend/subscriptions/services.py:1203-1218`.
- Los horarios elegidos quedan guardados en la solicitud:
  `backend/subscriptions/models.py:121-123`.
- En pantalla: socio `frontend/src/pages/member/GymDashboard.jsx:455-466` con
  `frontend/src/components/plans/PlanChangeModal.jsx` (elige plan y horarios);
  staff `frontend/src/pages/PlanChangeRequests.jsx` (título "Cambios de plan",
  aprobar/rechazar `:364`, `:413`).

---

## 4. La renovación automática: prender, apagar y quién la corre

- Cada suscripción tiene un interruptor: **renovación automática**. Prendida,
  cuando termina el mes el sistema crea el ciclo siguiente con el mismo plan,
  las mismas actividades y los mismos precios, y ese ciclo nuevo queda
  **pendiente de pago**.
- **La puede apagar y prender solo el socio**, desde su portal ("Cancelar
  renovación automática" / "Reactivar renovación automática"). Para eso tiene
  que no estar suspendido por falta de pago, y la acción actúa **sobre el ciclo
  que está vigente hoy**.
- **El staff no tiene ese botón**: por la API el campo es de solo lectura.
  (Sí se puede tocar desde el admin de Django, y el propio sistema la apaga en
  algunos casos, abajo.)
- **Quién la ejecuta:** el mismo proceso de la app, disparado de dos formas:
  con el tráfico de la app (middleware) y con un cron del repositorio que corre
  **cada 6 horas**. Nadie la dispara a mano. También hay un comando manual.
- **Cuándo NO renueva:**
  - Si el socio estaba **bloqueado por falta de pago** al cerrar el mes → no se
    crea el ciclo nuevo. El portal se lo avisa: *"Tu suscripción del mes
    anterior quedó bloqueada por falta de pago y no se renovó. Regularizá tu
    saldo para recuperar tu plan."* Para reactivarlo, el staff usa "Recuperar
    socios".
  - Si el gimnasio está desactivado, el socio está inactivo, o el plan quedó
    deshabilitado → tampoco.
  - Si el ciclo nuevo ya existe por otro camino → no duplica.
- **La renovación se apaga sola en dos casos:** cuando el ciclo nuevo ya fue
  cubierto por otro camino, y cuando el sistema detecta rezago (el mes de
  destino ya estaba cerrado). En esos casos pasa a "sin renovación" y nadie la
  vuelve a prender: eso lo hace el socio.
- **Aviso en el portal:** si la renovación está prendida y faltan **7 días o
  menos** para el vencimiento, el portal muestra el aviso con la fecha.

### Referencia
- El socio la apaga/prende: `backend/subscriptions/public_views.py:107-140` y
  `:143-176` (puerta de pago `:114` y `:150`; actúa sobre el ciclo vigente
  `:120` y `:156`).
- Para el staff es de solo lectura: `backend/subscriptions/serializers.py:138-148`.
- Quién la dispara: `backend/config/api/middleware.py:11-33` (con el tráfico),
  `backend/config/api/tasks.py:17-49` y `.github/workflows/scheduled-tasks.yml`
  (cada 6 h), intervalo en `backend/config/settings.py:123-128`, comando
  `manage.py auto_renew_subscriptions`.
- Qué decide y qué saltea: `backend/subscriptions/services.py:1463-1621`
  (`_collect_renewal_candidates`), corte por deuda `:1540-1554`, limpieza que
  apaga la renovación `:1864-1868`, y el loop de creación `:1885-1931`.
- Ciclo nuevo: `backend/subscriptions/services.py:1284-1330` — arranca el 1°
  del mes siguiente
  (`:1302-1303`), copia ítems (`:1318-1320`), consume el saldo a favor
  (`:1325`) y aplica los cambios de plan aprobados (`:1327-1328`).
- Avisos del portal: `backend/routines/views.py:542-551` (renovación próxima) y
  `:700-711` (renovación no hecha); textos en `backend/gyms/labels.py:42`.
- Botones en pantalla: `frontend/src/pages/member/GymDashboard.jsx:329-363`.

---

## 5. Cortesías y descuentos

- **Pase de cortesía (`is_comp`):** el socio no paga. Todo lo que se le emite
  sale en **$0**, nunca se le bloquea por falta de pago y no consume saldo a
  favor. En las pantallas se lo marca con la etiqueta "Pase de cortesía".
- Se activa y desactiva desde el **formulario de edición del socio** (checkbox),
  no desde la pantalla de suscripciones.
  - Al **activarla**, el sistema pasa el ciclo actual al plan base,
    **prorratea por los días que ya pasaron** (solo se cobra lo servido) y
    **vuelve a prender la renovación automática**, aunque el socio la hubiera
    apagado.
  - Al **desactivarla** hay que elegir un plan, y se prorratea **por los días
    que quedan** del mes: el socio queda debiendo justo lo que falta del
    período.
- **Ese prorrateo es el único que existe.** No se prorratea al inscribirse ni
  al cambiar de plan (ver AUDITORIA-PAGOS §7).
- **Descuentos:** el gimnasio crea descuentos porcentuales desde
  Configuración y se los asigna a un socio. El porcentaje **se congela al
  emitir cada período**: desactivar el descuento después **no cambia** lo ya
  cobrado. (Excepción: los períodos antiguos, anteriores a ese campo, usan el
  descuento vigente del socio.)
- En la tarjeta del staff, un socio con descuento muestra el precio original
  tachado junto al precio final.

### Referencia
- Cortesía: `backend/members/models.py:203-210`; precios en $0
  `backend/subscriptions/services.py:36-43` (`_item_price`); sin saldo
  pendiente `backend/subscriptions/services.py:712-727`; sin bloqueo
  `backend/members/eligibility.py:65-66`; sin consumo de crédito
  `backend/subscriptions/services.py:551-553`.
- Toggle: `backend/members/serializers.py:609-652` →
  `backend/subscriptions/domain.py:133-301` (`mutate_membership`), prorrateo
  `backend/subscriptions/domain.py:304-337` y `backend/subscriptions/domain.py:371-385`,
  re-prende la renovación `backend/subscriptions/domain.py:193-194`, y hay que
  elegir plan para quitarla `backend/subscriptions/domain.py:221-225`.
- Descuento congelado: `backend/subscriptions/domain.py:109-122` (al crear el
  período) y
  `backend/subscriptions/services.py:312-331` (`member_discount_percent`);
  ayuda del campo `backend/subscriptions/models.py:46-55`.
- CRUD de descuentos: `backend/gyms/views.py:599` (`DiscountViewSet`, ruta
  `/api/gyms/me/discounts/`).
- En pantalla: checkbox "Pase de cortesía"
  `frontend/src/components/members/MemberForm.jsx:441-459` (al desactivarlo
  avisa que se le pedirá un plan), etiqueta
  `frontend/src/components/subscriptions/MemberSubscriptionCard.jsx:66`.

---

## 6. Qué ve cada rol y en qué pantalla

**Staff**

| Pantalla | Para qué sirve | Qué puede hacer |
|----------|----------------|-----------------|
| **Estado comercial** | Ver a cada socio: ciclo actual, días que le quedan, "Pagado/Pendiente", renovación prendida o apagada, origen, actividades incluidas, total y descuento; historial de ciclos; filtros (activos, pendientes, sin ciclo, con/sin renovación) y 4 contadores | **No** edita la suscripción desde ahí: solo entra a "Registrar pago" |
| **Cambios de plan** | Los pedidos de cambio, con sus estados | Aprobar o rechazar (con notas) |
| **Planes** | El catálogo de planes | Crear, editar y eliminar planes (nombre, descripción, precio, duración en días, visitas semanales, activo) |
| **Recuperar socios** | Socios con deuda | Ver el desglose, cobrar y "Recuperar socio" |
| **Pagos** | El cobro del día a día | Registrar, editar y borrar pagos (AUDITORIA-PAGOS §4) |

**Socio (portal)**

| Qué ve o hace | Detalle |
|---------------|---------|
| Su estado | "✓ Al día", "⚠ Pago inicial pendiente", "⚠ Pendiente de pago", "❌ Pago vencido" o "⛔ Acceso suspendido" |
| Cuánto le queda | "X días restantes", "Vence hoy" o "Vencido" |
| Renovación | Estado "Activada/Cancelada" con botón para cancelar o reactivar, y el aviso con la fecha |
| Cambio de plan | Pide el cambio, ve si está pendiente o aprobado, y cancela su pedido |
| Sus pagos | Pagos pendientes e historial, **solo lectura**: el cobro lo hace el staff |
| Si algo está mal | Un banner explica el motivo (pago inicial pendiente, acceso suspendido o renovación saltada) y le muestra cuánto debe |

### Referencia
- Staff: `frontend/src/pages/Subscriptions.jsx:56` (título "Estado comercial"),
  `frontend/src/components/subscriptions/MemberSubscriptionCard.jsx:13-17`
  (etiquetas de origen), `frontend/src/components/subscriptions/MemberSubscriptionCard.jsx:103-127`
  (días, pagado, renovación), `frontend/src/components/subscriptions/MemberSubscriptionCard.jsx:179`
  (botón de pago), `frontend/src/components/subscriptions/SubscriptionFilters.jsx:25-38`
  (filtros), `frontend/src/components/subscriptions/SubscriptionStats.jsx:5-20`
  (contadores), `frontend/src/pages/PlanChangeRequests.jsx:234`,
  `frontend/src/pages/PlanChangeRequests.jsx:364` (aprobar),
  `frontend/src/pages/PlanChangeRequests.jsx:413` (rechazar),
  `frontend/src/pages/Plans.jsx:134` y `frontend/src/pages/Plans.jsx:32-117`
  (formulario), `frontend/src/pages/RecoverMembers.jsx:326` y
  `frontend/src/pages/RecoverMembers.jsx:279-287` (recuperar).
- Socio: estados `frontend/src/pages/member/GymDashboard.jsx:209-225`, días
  `frontend/src/pages/member/GymDashboard.jsx:317-319`, renovación
  `frontend/src/pages/member/GymDashboard.jsx:329-363`, cambio de plan
  `frontend/src/pages/member/GymDashboard.jsx:455-466`, pagos
  `frontend/src/pages/member/MemberPayments.jsx`, banners
  `frontend/src/pages/member/MemberPortalLayout.jsx:589-595`.
- Datos que llegan al portal: `backend/routines/views.py:516-571` (suscripción,
  días, avisos) y `backend/routines/views.py:626-807` (deuda total y renovación
  saltada).
- La puerta que decide si el socio puede operar:
  `backend/members/eligibility.py:32-77` (`can_operate` / `block_reason`).

---

## 7. Lo que el sistema NO hace hoy (para no prometerlo en el manual)

- **No da de baja a un socio ni cancela una suscripción** con un botón: lo único
  apagable es la renovación automática, y la apaga el propio socio.
- **No deja que el staff apague o prenda la renovación** de un socio desde la
  pantalla (por API es de solo lectura).
- **No prorratea** al inscribirse ni al cambiar de plan (solo al activar o
  quitar una cortesía).
- **No permite elegir la fecha** en que rige un cambio de plan: es hoy o el 1°
  del mes, nada intermedio.
- **No admite dos pedidos de cambio de plan** a la vez, ni cambiar al mismo plan
  ni al plan base.
- **No avisa por email ni WhatsApp** el cambio de plan, la renovación ni el
  vencimiento: todos los avisos son dentro del portal.
- **No cobra el cambio de plan en el momento** ni tiene un botón para "pagar la
  diferencia": la plata se acomoda en la facturación del ciclo.
- **No permite prórrogas ni vencimientos por socio**: todos los ciclos terminan
  el último día del mes; lo único configurable por gimnasio son los días de pago
  y de bloqueo (AUDITORIA-PAGOS §2).

---

## 8. Problemas que pueden pasar hoy

Fallos conocidos, registrados en `BUG-Pagos.md`. Conviene conocerlos antes de
prometer estos comportamientos en el manual.

1. **Un cambio de plan puede no reflejar el saldo a favor.** Si el cambio
   reprecia un período que ya estaba pagado, el sistema no vuelve a calcular el
   pago ni genera el crédito correspondiente (P21). Hoy no conviene prometer que
   "la diferencia queda a favor" por el camino del cambio de plan.
2. **El botón "recuperable" a veces no coincide con lo que pasa al recuperar**
   (P24): la lista de socios calcula las condiciones en un lugar y la acción de
   recuperar en otro, así que puede ofrecer recuperar y el sistema rechazar.
   (AUDITORIA-PAGOS §6 dice que son las mismas condiciones; hoy no lo son.)
3. **La etiqueta "Pagado/Pendiente" de la pantalla del staff puede estar
   desactualizada** (P22/P23): es una copia que en algunos caminos se escribe a
   mano. La deuda real es la que calcula el sistema.
4. **Aprobar un cambio con efecto hoy no arrastra el entrenamiento personal**
   ni consume el saldo a favor, mientras que el camino del 1° del mes sí lo
   hace. Un socio con PT mensual aprobado hoy puede no ver esa línea ese mes.
5. **Dar una cortesía re-prende la renovación automática**, aunque el socio la
   hubiera apagado.
6. **Un socio que nunca pagó su primer mes igual se renueva**: su estado al
   cierre es "pago inicial pendiente", que no corta la renovación, así que el
   mes siguiente nace un ciclo nuevo deudor.
7. **Borrar una suscripción desde el admin de Django deja sus pagos huérfanos**
   (P12): siguen existiendo, pero dejan de contar en la deuda.

### Referencia
- P21: `backend/subscriptions/services.py:1804-1814` (reprecio sin
  `sync_subscription_paid`).
- P24: `backend/members/serializers.py:258-410` vs
  `backend/subscriptions/services.py:1333-1432`.
- P22/P23: `backend/subscriptions/services.py:1314` y
  `backend/subscriptions/services.py:1418` (escritura manual de `paid`), más
  `backend/subscriptions/serializers.py:286`.
- Efecto inmediato sin PT: `backend/subscriptions/views.py:362-364` vs
  `backend/subscriptions/services.py:1800-1803`.
- Cortesía re-prende la renovación: `backend/subscriptions/domain.py:193-194`.
- Primera renovación sin pago: `backend/subscriptions/services.py:1176-1183`
  (estado `initial_pending`) con `backend/subscriptions/services.py:1540-1554`
  (el corte solo mira `blocked`).
- Registro completo de los bugs: `BUG-Pagos.md`.

---

### Notas de entorno para leer el código

- Zona horaria: `America/Argentina/Buenos_Aires` (`backend/config/settings.py:461`).
- Toda operación de staff se filtra automáticamente por el gimnasio del usuario
  logueado (`backend/core/mixins.py:4-19`).
- El portal del socio no usa usuario: entra con un **token en la URL**
  (`permission_classes = []` con throttles) y todas sus escrituras pasan por la
  puerta de pago `MemberEligibility.can_operate` (`backend/members/eligibility.py:32-46`).
- Los estados de pago (`paid` / `initial_pending` / `pending` / `overdue` /
  `blocked`) **no se guardan**: se calculan en cada consulta
  (`backend/subscriptions/services.py:1166-1190`).
- La tarea de renovación corre con el tráfico de la app y con el cron de 6 h; un
  claim atómico evita que corra dos veces a la vez
  (`backend/subscriptions/services.py:1986-2059`).
