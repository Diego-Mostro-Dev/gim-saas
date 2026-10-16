# Auditoría de Recuperación — Cómo funciona hoy "Recuperar socios"

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Escrito en lenguaje simple para servir de base a un manual de gimnasios. Las
> referencias de código van aparte, en letra chica, para no ensuciar el texto.
> Cubre **recuperar la suscripción de un socio** (reactivar el ciclo de cobro), que
> es distinto de **recuperar clases/sesiones** (ver §8).

---

## 1. Qué es "recuperar"

En la jerga del sistema, "recuperar" a un socio significa **volver a ponerlo en
curso de cobro**. No es lo mismo que "dar de alta" una ficha (eso es Miembros) ni
que devolverle una clase perdida (eso es Asistencias). Acá se maneja el ciclo
mensual de la suscripción.

La acción tiene **dos casos**, y el mismo botón resuelve uno u otro según el
estado del socio:

- **Caso A — Reactivar:** el socio **ya tiene un ciclo vigente** (una suscripción
  que cubre hoy) y no debe nada. El sistema **no crea nada**: sólo marca al socio
  como activo otra vez y devuelve el ciclo que ya tenía.
- **Caso B — Recuperar:** el socio **no tiene ningún ciclo que cubra hoy**. El
  sistema le **abre un ciclo nuevo** desde hoy hasta fin de mes, que queda
  **pendiente de pago** hasta que el gimnasio lo cobre.

En los dos casos el resultado visible es el mismo: el socio vuelve a estar activo
y en condiciones de entrenar.

### Referencia
- `backend/subscriptions/services.py:1362-1461` (`recover_member`).
- Caso A: `:1422-1427`. Caso B: `:1441-1459`.

---

## 2. Quién puede recuperarse (las 4 condiciones)

La recuperación **siempre la hace el staff a mano**; no es automática. Antes de
abrir el ciclo nuevo, el sistema exige que se cumplan **todas** estas condiciones:

1. **No debe nada.** Ninguna suscripción, ni paquete de sesiones, ni sellado puede
   tener saldo pendiente (ver §3).
2. **No tiene ciclo vigente.** Si ya tuviera uno, en realidad es el Caso A
   (reactivar), no se abre otro.
3. **No tiene ciclo futuro.** Si ya tiene un ciclo cargado que arranca más
   adelante, no se duplica.
4. **No está en el plan base.** El plan base es el que se usa para socios de
   cortesía o "solo actividades"; recuperar con ese plan no tendría sentido de
   cobro. Excepción: si hay un **cambio de plan aprobado** que ya venció, se usa
   *ese* plan en lugar del que figura en la ficha.

Además, el socio debe tener **al menos una suscripción previa**: si nunca tuvo
una, no hay nada que recuperar.

Si alguna falla, el sistema responde con un error descriptivo y no toca nada.

### Referencia
- Deuda: `backend/subscriptions/services.py:1417-1420`.
- Sin ciclo previo: `:1412-1415`. Ciclo vigente / Caso A: `:1422-1427`.
- Ciclo futuro: `:1429-1432`. Plan base: `:1436-1439`.
- Resolución del plan (honra cambio aprobado): `:1434` → `_resolve_plan` `:1725-1740`.
- Endpoint del staff: `backend/subscriptions/views.py:145-177` (`reopen`).

---

## 3. Qué cuenta como deuda (y qué no)

Para decidir si el socio "debe algo", el sistema suma **cinco fuentes**:

| Fuente | Qué es |
|--------|--------|
| Suscripciones | Lo que resta pagar de cada ciclo mensual. |
| Paquetes de actividades | Inscripciones por sesiones (paquete) que todavía no se terminaron de pagar. |
| Paquetes de entrenamiento personal | Igual, pero de PT. |
| Paquetes de salidas | Igual, pero de salidas/running. |
| Sellados | La matrícula/cargo único pendiente de inscripciones y de asignaciones de PT. |

Un detalle importante: **el saldo a favor (crédito) NO es deuda**. Si el socio pagó
de más en un ciclo anterior, ese dinero no lo salva de "debe", pero tampoco lo
cuenta en contra: se reutiliza más adelante contra futuros ciclos (ver
`AUDITORIA-PAGOS.md`).

Nota: el sistema **no usa la marca** `paid` de la suscripción para esto. Un ciclo
marcado como pagado pero con saldo real cuenta como deuda, y uno marcado como
impago pero con saldo $0 no. Lo que manda es el **saldo calculado**.

### Referencia
- `backend/subscriptions/services.py:1049-1120` (`member_total_outstanding_debt`).
- Paquetes: `:1100-1102` (`member_activity_package_debt` `:765`, `member_personal_training_package_debt` `:812`, `member_outing_package_debt` `:849`).
- Sellados: `:1109-1113` (`member_sellado_debt` `:1029`).
- El crédito queda afuera del agregado: `:1062-1072`.

---

## 4. Qué crea la recuperación (Caso B)

Cuando el socio es recuperable y no tiene ciclo vigente, el sistema hace **todo
junto en una sola operación indivisible (atómica)**:

- Abre una **suscripción nueva** que empieza **hoy** y termina el **último día
  del mes en curso**, con `origin="recovery"`.
- La deja **pendiente de pago** (`paid=False`).
- Hereda la **renovación automática** de la última suscripción del socio.
- **Copia los servicios activos** de la última suscripción: actividades,
  entrenamiento personal y salidas. Así el socio sigue con lo que tenía.
- Si había un **cambio de plan aprobado** que ya venció, lo **finaliza** acá
  mismo: queda ligado al ciclo nuevo y marcado como ejecutado, para que el
  proceso de cambios de plan no lo vuelva a aplicar.
- Marca al socio como **activo**.

Como el ciclo nuevo arranca hoy y queda impago, después de recuperar el socio
aparece de inmediato con una deuda nueva (el mes en curso).

> Ojo con el prorrateo: la recuperación **no prorratea**. Si se recupera a un
> socio el día 25, el ciclo va del 25 al último día del mes y **se cobra el mes
> completo**, no la parte proporcional. En el último día del mes, el ciclo dura
> un solo día.

### Referencia
- Creación del ciclo: `backend/subscriptions/services.py:1441-1459`.
- Apertura y prorrateo (que acá no aplica): `backend/subscriptions/domain.py:49` y `:117-127`.
- Copia de ítems: `_copy_activity_items` `services.py:75`, `_copy_personal_training_items` `:139`, `_copy_outing_items` `:187`.
- Finalización del cambio de plan: `_finalize_plan_change` `:1742`.

---

## 5. Quién es "Recuperable" (el badge de la lista)

La lista de socios no consulta al servidor para cada fila: cada socio trae un
**indicador calculado en modo lectura** llamado `is_recoverable`, que **replica**
las condiciones de §2 sin abrir nada ni marcar a nadie. Ese indicador es el que
dibuja el **badge "Recuperable"**, alimenta el **filtro "Recuperables (N)"** de
"Recuperar socios" y decide si aparece el **botón "Recuperar socio"**.

Como es una **copia** de la regla (no la misma función), puede desincronizarse del
servicio real. De hecho ya pasó una vez con el crédito, y hay un test de regresión
que lo vigila (ver §7).

### Referencia
- `backend/members/serializers.py:258-410` (`get_is_recoverable`).
- Uso en la pantalla: `frontend/src/pages/RecoverMembers.jsx:73-78` (helper), `:119-127` (conteo y filtro), `:724-732` (botón).

---

## 6. La pantalla del staff ("Recuperar socios")

Ruta `/recover-members`, pensada para el personal del gimnasio:

- A la izquierda, **buscador + filtros** ("Todos", "Con deuda", "Recuperables") y
  la lista de socios con sus badges.
- Al elegir un socio, a la derecha se carga **su deuda** (suscripciones, paquetes
  y sellados) y se puede **registrar el pago** de cada ítem.
- **Recién cuando la deuda llega a $0** aparece el botón **"Recuperar socio"**.
  Si el socio ya está al día y no necesita recuperación, muestra el aviso
  "El socio está al día y no requiere recuperación".
- Al recuperar, la pantalla recarga la lista y la deuda, y marca al socio como
  recuperado en la sesión.

El camino de datos es: `reopenSubscription(memberId)` → `POST /api/subscriptions/reopen/`
con `{ member_id }` → `recover_member`.

### Referencia
- Pantalla: `frontend/src/pages/RecoverMembers.jsx` (pago de deuda `:160-277`; recuperación `:279-312`; gate de deuda `:467-739`).
- Ruta: `frontend/src/App.jsx:173`; accesos desde `frontend/src/components/dashboard/BottomNav.jsx:266` y `frontend/src/components/dashboard/PendingPayments.jsx:30`.
- Servicio del front: `frontend/src/services/subscriptions.service.js` (`reopenSubscription`, `getOutstanding`, `getMemberOutstanding`).

---

## 7. Posibles bugs / desajustes

Estos son puntos donde **el badge, la validación y la acción real no siempre
coinciden**, o donde el comportamiento puede sorprender. Están para documentar,
no necesariamente para arreglar.

1. **La deuda de salidas no la ve el badge, pero sí la validación.**
   `member_total_outstanding_debt` incluye `member_outing_package_debt`
   (`services.py:1100-1102`), pero `get_is_recoverable` sólo mira inscripciones de
   actividades y de PT, **no las de salidas** (`serializers.py:280-324`). Un socio
   con deuda de *salidas* aparece como **"Recuperable"** con su botón, y al
   tocarlo el servidor responde **400 "deuda pendiente"**. Revisar también los
   sellados de salidas.

2. **El badge ignora un cambio de plan aprobado y vigente.**
   `recover_member` resuelve el plan con `_resolve_plan` (`services.py:1434`,
   `:1732`), que **sí** honra un `PlanChangeRequest` aprobado; `is_recoverable`
   rechaza de plano si `latest_sub.plan.is_base` (`serializers.py:407`) sin mirar
   ese cambio. Un socio en plan base con un cambio aprobado a plan pago — que el
   backend **sí** recuperaría — queda **oculto** en la UI (falso negativo).

3. **El badge rechaza a socios de cortesía, la acción no.**
   `is_recoverable` devuelve `False` para `is_comp` (`serializers.py:277-278`),
   pero `recover_member` **no** excluye a los socios de cortesía. Desajuste
   (probablemente benigno, pero real).

4. **La recuperación no aplica el saldo a favor.**
   `create_next_subscription` llama `consume_member_credit` (`services.py:1354`),
   pero `recover_member` **no** (`:1441-1456`). Un socio con crédito abierto y
   deuda $0 es recuperable; su ciclo nuevo queda **100% impago** aunque el crédito
   podría cubrirlo. El crédito se aplicará recién en la próxima renovación.

5. **El endpoint responde siempre `201 Created`.**
   En el Caso A (reactivar) **no se crea ninguna suscripción**, pero `reopen`
   igual devuelve `201` (`views.py:174-177`). El código de estado no distingue
   reactivar de crear.

6. **El chequeo de deuda va antes que el de "ciclo vigente".**
   `recover_member` valida la deuda (`services.py:1417`) antes de buscar el ciclo
   vigente (`:1422`). Un socio **inactivo con ciclo vigente pero con deuda
   residual** no puede "reactivarse" por esta vía: recibe el error de deuda. Si la
   reactivación no cobrara nada, tal vez debería permitirse.

7. **`is_recoverable` es una reimplementación manual y frágil.**
   `serializers.py:258-410` reproduce el total facturado, el descuento congelado y
   el crédito ya consumido **en memoria**, para no hacer queries de más. Cualquier
   cambio futuro en esos helpers puede volver a desincronizarlo (ya ocurrió con el
   crédito; ver el test de regresión `backend/members/tests.py:103-162`).

8. **Sin bloqueo explícito en `recover_member`.**
   Lee las precondiciones sin `select_for_update` (`services.py:1408-1434`). Un
   doble clic concurrente tiende a resolverse por el solapamiento que detecta
   `open_subscription` (`domain.py:49+`), pero no es una garantía propia del flujo.

9. **La recuperación no prorratea.** (Repetido de §4, listado acá por su efecto en
   el cobro.) Recuperar a mitad o fin de mes cobra el **mes completo** por los
   pocos días que restan.

### Referencia
- Deuda de salidas: `backend/subscriptions/services.py:849`, `:1100-1102` vs `backend/members/serializers.py:280-324`.
- Cambio de plan: `backend/subscriptions/services.py:1434` / `:1725-1740` vs `backend/members/serializers.py:407`.
- Cortesía: `backend/members/serializers.py:277-278`.
- Crédito: `backend/subscriptions/services.py:1354` vs `:1441-1456`.
- Estado de respuesta: `backend/subscriptions/views.py:174-177`.
- Orden de validaciones: `backend/subscriptions/services.py:1417-1427`.
- Reimplementación: `backend/members/serializers.py:258-410`; regresión en `backend/members/tests.py:103-162`.

---

## 8. Lo que el sistema NO hace hoy (para no prometerlo en el manual)

- **No prorratea la recuperación**: cobra el mes completo aunque se recupere sobre
  el final del mes.
- **No aplica el saldo a favor en la recuperación**: el crédito espera a la
  renovación siguiente (ver §7.4).
- **No avisa al socio** por ningún canal: recuperar es una acción interna del staff.
- **No revive la ficha**: "recuperar" es del ciclo de cobro. La ficha del socio se
  crea/edita/borra en Miembros; no existe una baja lógica ni una reactivación de
  ficha.
- **No recupera clases/clases perdidas**: eso es **recuperación de sesiones**
  (`SessionRecovery`), otro flujo con su propio portal (`MemberRecoveries.jsx`) y
  sus propios endpoints (`/api/attendance/recoveries/`). No confundir con este.
- **No permite al socio recuperarse a sí mismo**: sólo el staff.
- **No crea deuda nueva distinta del ciclo recuperado**: no genera ajustes,
  intereses ni recargos por el tiempo inactivo.

---

## 9. Notas de entorno para leer el código

- Zona horaria del sistema: `backend/config/settings.py` (`America/Argentina/Buenos_Aires`).
  "Hoy" y "fin de mes" se calculan con esa zona.
- Los querysets del staff están limitados al gimnasio del usuario
  (`backend/core/mixins.py`), y `reopen` toma al socio con
  `get_object_or_404(Member, id=member_id, gym=gym)` (`backend/subscriptions/views.py:164`).
- El indicador `is_recoverable` viaja en el serializer de la lista de socios
  (`backend/members/serializers.py`) y es **read-only**.
- Tests que fijan el comportamiento actual:
  `backend/members/tests.py:81-294` (`IsRecoverableTests`, `RecoveryEndpointTests`)
  y `backend/subscriptions/test_money_bugs.py:421-471` (creación del ítem de PT al
  recuperar).
