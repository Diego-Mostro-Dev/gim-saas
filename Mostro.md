# Arquitectura Comercial del Sistema de Membresías

## Estado de la decisión

Esta arquitectura reemplaza la idea de crear un servicio independiente para cada disciplina (Yoga, Pilates, etc.).

La decisión es mantener únicamente dos tipos de servicios principales.

## Servicios

### Gym

Representa el acceso al gimnasio.

Todo lo relacionado con musculación, máquinas, sala de entrenamiento y horarios generales pertenece a este servicio.

---

### Activities

Representa todas las actividades dirigidas.

Dentro de Activities viven todas las disciplinas.

Ejemplos:

- Yoga
- Pilates
- Cross
- Funcional
- Spinning
- Boxeo
- GAP
- Zumba
- cualquier otra actividad futura

Es importante remarcar que **Yoga NO es un Service**.

Yoga es una **Activity**.

Lo mismo aplica para Pilates, Funcional, Cross, etc.

Esto mantiene la arquitectura mucho más limpia y evita multiplicar la cantidad de servicios.

---

# Modelo comercial

La idea es que un miembro pueda comprar cualquier combinación de productos.

Por ejemplo:

## Caso 1

Juan compra solamente Gym.

```
✓ Gym
```

---

## Caso 2

Juan compra solamente Yoga.

```
✓ Yoga
```

---

## Caso 3

Juan compra solamente Pilates.

```
✓ Pilates
```

---

## Caso 4

Juan compra Yoga y Pilates.

```
✓ Yoga
✓ Pilates
```

---

## Caso 5

Juan compra Gym y Yoga.

```
✓ Gym
✓ Yoga
```

---

## Caso 6

Juan compra Gym, Yoga y Pilates.

```
✓ Gym
✓ Yoga
✓ Pilates
```

Todas estas combinaciones deben ser válidas.

El sistema nunca debe asumir que una persona solamente puede tener una única membresía.

---

# Subscription

La Subscription representa el contrato comercial del miembro.

No representa un único producto.

Representa la compra realizada por el cliente.

Dentro de esa compra existirán uno o varios SubscriptionItems.

---

# SubscriptionItem

Cada SubscriptionItem representa un producto comprado.

Ejemplo:

```
Subscription

Item 1
Gym Mensual
$25.000

Item 2
Yoga
$12.000

Item 3
Pilates
$10.000
```

Total:

```
$47.000
```

En este modelo, cada item tiene su propia información:

- producto
- precio
- fechas
- estado
- renovaciones
- historial

Esto convierte a SubscriptionItem en una pieza central del modelo de negocio, en lugar de ser simplemente una copia de Subscription.

---

# Pricing

Cada producto debe tener su propio precio.

Ejemplos:

```
Gym Mensual
$25.000

Yoga
$12.000

Pilates
$10.000

Cross
$18.000

Spinning
$15.000
```

El total de una Subscription surge de la suma de todos sus SubscriptionItems.

```
Total Subscription
=
Σ SubscriptionItems
```

Esto elimina la limitación actual donde únicamente existe un MembershipPlan asociado al Gym.

---

# Renovaciones

Cada producto debería poder renovarse de manera independiente.

Ejemplo:

```
Gym
Renovación automática

Yoga
Renovación manual

Pilates
Cancelado
```

Cada SubscriptionItem debería poder tener su propio ciclo de vida.

---

# Cambios de plan

Los cambios de plan también deberían ocurrir sobre un SubscriptionItem.

Ejemplo:

```
Gym Mensual
↓

Gym Premium
```

Sin afectar los demás productos contratados.

---

# Beneficios de esta arquitectura

- Solo existen dos servicios principales: Gym y Activities.
- Las disciplinas (Yoga, Pilates, Funcional, etc.) se modelan como Activities, no como Services.
- El sistema permite vender cualquier combinación de productos.
- Los precios dejan de depender de un único MembershipPlan.
- SubscriptionItem pasa a representar verdaderamente cada producto contratado.
- La arquitectura es escalable y permite agregar nuevas actividades sin modificar el modelo de servicios.
- El sistema queda preparado para futuras funcionalidades como promociones, paquetes, descuentos, renovaciones independientes y facturación por producto.

---

# Objetivo final

El objetivo es que el sistema funcione como un verdadero gestor comercial de un gimnasio, donde una persona pueda contratar libremente cualquier combinación entre el gimnasio y las actividades disponibles, manteniendo una arquitectura simple (Gym + Activities) pero con un modelo comercial flexible basado en múltiples SubscriptionItems dentro de una misma Subscription.

# Descubrimiento técnico — Estado actual de Subscriptions y Activities

## Contexto

Mientras avanzábamos con la nueva arquitectura de múltiples servicios apareció un problema importante:

La pantalla de **Subscriptions** dejó de cargar correctamente y las consultas al endpoint:

```
GET /api/subscriptions/
```

quedan en estado **Pending** durante mucho tiempo, llegando incluso a parecer que nunca terminan.

Este problema apareció mientras el sistema quedó en un estado intermedio entre la arquitectura antigua y la nueva.

---

# Estado actual del modelo

Actualmente la arquitectura conceptual sigue siendo la siguiente:

## Servicios

- Gym
- Activities

No existe el concepto de "Yoga" como Service.

Las actividades pertenecen al servicio Activities.

Ejemplo:

Activities

- Yoga
- Pilates
- Cross
- Funcional
- Spinning

Este modelo sigue siendo el elegido.

---

# Modelo comercial objetivo

El objetivo continúa siendo que un miembro pueda comprar cualquier combinación de servicios.

Ejemplos válidos:

- Gym
- Yoga
- Pilates
- Yoga + Pilates
- Gym + Yoga
- Gym + Yoga + Pilates

Cada producto contratado deberá convertirse en un **SubscriptionItem**.

Ejemplo:

Subscription

- Item 1
  - Gym mensual
  - $25.000

- Item 2
  - Yoga
  - $12.000

- Item 3
  - Pilates
  - $10.000

Total:

$47.000

Este continúa siendo el objetivo del sistema.

---

# Situación actual

Hoy el sistema quedó a mitad de camino.

Actualmente:

Gym posee:

- Planes
- Precio
- Subscription
- SubscriptionItem

Mientras que Activities solamente posee:

- Horarios
- Cupos
- Inscripciones (Enrollments)

Pero NO posee:

- Precio
- Plan
- SubscriptionItem
- Facturación

Esto genera un modelo híbrido.

---

# Problema detectado

El endpoint:

```
GET /api/subscriptions/
```

queda pendiente durante mucho tiempo.

A primera vista parecía un problema de paginación.

Sin embargo, el análisis indica que probablemente la paginación no sea el verdadero problema.

La paginación del frontend parece funcionar correctamente.

El problema parece estar en el backend.

---

# Hipótesis más fuerte

El método:

```
SubscriptionViewSet.list()
```

ejecuta lógica de negocio antes de responder.

Es decir, una petición GET no solamente lee información.

También ejecuta procesos internos como:

- verificar renovaciones
- ejecutar auto_renew_subscriptions()
- recorrer membresías
- crear o actualizar datos relacionados

Todo esto ocurre antes de devolver la respuesta.

Como consecuencia:

```
GET page=1
```

ejecuta toda esa lógica.

Luego:

```
GET page=2
```

vuelve a ejecutar exactamente la misma lógica.

Después:

```
GET page=3
```

la ejecuta nuevamente.

Esto explica por qué cada request puede tardar más de un minuto.

---

# Lo que todavía NO está demostrado

Durante el análisis apareció una hipótesis:

Que auto_renew_subscriptions() podría estar creando suscripciones duplicadas al ejecutarse varias veces.

Sin embargo, esa afirmación todavía no está demostrada.

Debe tratarse como una hipótesis hasta encontrar evidencia concreta.

No debe tomarse como un hecho.

---

# Problema principal

Más allá de la causa exacta del Pending, existe un problema arquitectónico claro.

Una operación:

```
GET /subscriptions/
```

debería únicamente:

- leer datos
- serializar
- responder

No debería ejecutar procesos de negocio pesados.

Renovaciones automáticas, generación de suscripciones, creación de SubscriptionItems o cualquier otra lógica de negocio deberían ejecutarse mediante procesos independientes (jobs, tareas programadas o acciones explícitas), no durante una consulta GET.

---

# Decisión

No volver atrás con la nueva arquitectura.

El modelo de múltiples servicios continúa siendo el objetivo.

Lo que debe resolverse primero es:

1. Descubrir exactamente por qué `/api/subscriptions/` queda Pending.
2. Corregir ese problema.
3. Completar el modelo comercial de Activities.
4. Recién después eliminar definitivamente la lógica antigua.

La arquitectura sigue siendo válida.

El problema actual parece ser una implementación incompleta y no un error conceptual del diseño.

# Investigación complementaria – Crecimiento masivo de Subscriptions y ejecución durante la paginación

## Estado de la investigación

Después de revisar el flujo completo del backend y del frontend, apareció un comportamiento mucho más grave que el problema inicial de paginación.

Ya no estamos investigando solamente por qué la consulta tarda varios minutos.

Ahora también estamos investigando por qué la base de datos comenzó a generar miles de suscripciones nuevas.

---

# Evidencia encontrada

Durante la prueba se ejecutó:

```python
Subscription.objects.count()
```

Resultado inicial:

```
15096
```

Minutos después:

```
15188
```

Es decir:

**92 nuevas subscriptions fueron creadas mientras simplemente se estaba consultando el listado.**

No hubo ninguna acción manual.

No se creó ningún miembro.

No se creó ninguna suscripción desde la interfaz.

Simplemente se abrió la pantalla de Subscriptions.

---

# Confirmaciones obtenidas

## 1. GET /api/subscriptions modifica la base de datos

Esto quedó completamente confirmado.

El endpoint:

```
GET /api/subscriptions/
```

NO solamente devuelve información.

Antes de devolver la primera página ejecuta:

```
gym_has_pending_auto_renewals()

↓

auto_renew_subscriptions()
```

Y esa función contiene:

```python
Subscription.objects.create(...)
```

Es decir:

Un simple GET puede crear nuevas filas en Subscription.

También puede crear o actualizar SubscriptionItem.

Por lo tanto el endpoint deja de ser una operación de lectura.

Tiene efectos secundarios.

Eso es un problema importante de arquitectura.

---

# 2. La paginación dispara múltiples ejecuciones

El frontend utiliza:

```
fetchAllPages()
```

El flujo es:

```
Página 1

↓

Página 2

↓

Página 3

↓

Página 4

↓

...
```

Cada una de esas páginas realiza un nuevo request HTTP.

Cada request vuelve a entrar en:

```
SubscriptionViewSet.list()
```

Y vuelve a ejecutar:

```
auto_renew_subscriptions()
```

No existe ninguna protección para evitar que esa función vuelva a ejecutarse.

---

# 3. Existe una ventana de carrera (Race Condition)

La función realiza este flujo:

```
Fase 1

Obtiene candidatos

↓

Fase 2

Verifica si ya existe la renovación

↓

Fase 3

Crea la nueva Subscription
```

El problema es que la comprobación ocurre ANTES de crear.

Si dos requests llegan casi al mismo tiempo:

```
Request A

↓

Verifica

↓

No existe

↓

...

Request B

↓

Verifica

↓

Tampoco existe

↓

...

Ambos crean la misma renovación.
```

No existe:

- locking
- select_for_update
- transacción que impida la duplicación

Por lo tanto la función no es segura frente a múltiples ejecuciones simultáneas.

---

# 4. El endpoint de lectura deja de ser idempotente

Un endpoint GET debería poder ejecutarse infinitas veces sin modificar el sistema.

Actualmente:

```
GET

↓

crea Subscription

↓

crea SubscriptionItem
```

Por lo tanto ya no es idempotente.

---

# 5. El crecimiento observado

Durante la investigación aparecieron:

```
15096

↓

15188
```

Es decir:

92 registros nuevos.

Todavía no está completamente demostrado el origen exacto de esos 92 registros.

Existen dos hipótesis.

---

## Hipótesis A (más probable)

Cada página de la paginación ejecuta nuevamente:

```
auto_renew_subscriptions()
```

Si la función tarda mucho y varias páginas comienzan a ejecutarse casi al mismo tiempo:

```
Página 1

↓

Página 2

↓

Página 3

↓

...

Todas ejecutan la renovación.
```

Como la comprobación ocurre antes de crear, varias terminan generando las mismas renovaciones.

Esto produciría exactamente el crecimiento observado.

---

## Hipótesis B

Existe algún proceso paralelo (cron o management command)

```
auto_renew_subscriptions
```

ejecutándose al mismo tiempo.

Actualmente no hay evidencia suficiente para confirmarlo.

Debe descartarse revisando los procesos activos.

---

# Verificación realizada

Se comprobó que el gimnasio actual solamente posee:

```
Subscription.objects.filter(gym=gym).count()

↓

5
```

Mientras que el total de la base es:

```
15188
```

Por lo tanto el crecimiento global puede involucrar otros gimnasios.

Todavía falta determinar exactamente a qué gimnasio pertenecen esas nuevas subscriptions.

---

# Conclusiones confirmadas

✅ GET /api/subscriptions ejecuta lógica de escritura.

✅ auto_renew_subscriptions crea nuevas Subscription.

✅ fetchAllPages provoca múltiples requests consecutivos.

✅ Cada request vuelve a ejecutar la renovación.

✅ La función no posee protección contra concurrencia.

✅ Existe una ventana de carrera entre la comprobación y la creación.

✅ El endpoint deja de ser una simple consulta.

---

# Pendientes de investigación

Todavía falta responder:

- ¿Las 92 subscriptions nuevas pertenecen únicamente al gimnasio actual o también a otros gimnasios?

- ¿Existe un proceso externo ejecutando auto_renew_subscriptions?

- ¿Cuántas veces se ejecuta realmente auto_renew_subscriptions durante una sola carga del frontend?

- ¿Debe eliminarse completamente esa lógica del endpoint GET y moverla a un proceso programado (cron, Celery, comando manual o tarea administrativa)?

---

# Nivel de gravedad

Muy alto.

Actualmente una operación de lectura:

```
GET /api/subscriptions/
```

puede modificar la base de datos, crear nuevas subscriptions y hacerlo múltiples veces durante una sola carga de la interfaz, lo que puede provocar crecimiento descontrolado de registros y duplicaciones si existen múltiples requests concurrentes.
