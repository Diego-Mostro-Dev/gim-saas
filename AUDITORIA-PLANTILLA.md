# Plantilla de auditoría

> Documento de trabajo. No es una auditoría publicada ni se cuenta dentro de las
> 18 auditorías del índice. Sirve para crear o reescribir un `AUDITORIA-*.md`.
>
> Regla de oro: la auditoría describe **lo que el sistema hace hoy**, no lo que
> debería hacer. Los bugs van a `BUGS.md`; las decisiones de negocio se marcan
> como tales.

---

## Cabecera obligatoria

Copiar este bloque al inicio del documento y completar todos los campos:

```text
Verificado contra: <commit>
Fecha: <AAAA-MM-DD>
Alcance: <qué cubre y qué no>
Documentos relacionados: <AUDITORIA-...>
Código cubierto: <apps, archivos o endpoints principales>
Estado: <borrador | en revisión | verificado>
```

### Ejemplo

```text
Verificado contra: f5b4b07
Fecha: 2026-10-30
Alcance: alta, ficha, portal, adjuntos y baja de socios. No cubre cobros ni
asistencias salvo cuando impactan en la ficha.
Documentos relacionados: AUDITORIA-PAGOS.md, AUDITORIA-SUSCRIPCIONES.md
Código cubierto: backend/members, frontend/src/pages/Members.jsx,
frontend/src/pages/member/MemberData.jsx
Estado: verificado
```

---

## Estructura del documento

### Título

`# Auditoría de <tema> — Cómo funciona hoy <frase corta>`

### Introducción

Explicar en dos o tres párrafos:

- qué es el módulo;
- a quién sirve;
- qué límites tiene el documento;
- qué otros documentos conviene leer.

### 1. Qué es y para qué sirve

Definir el concepto en lenguaje simple. Aclarar qué **no** es cuando haya riesgo
de confusión con otro módulo.

### 2. Cómo funciona hoy

Describir el flujo real de punta a punta:

1. quién inicia la acción;
2. qué valida el sistema;
3. qué se crea, modifica o cobra;
4. qué ve cada rol después.

### 3. Reglas y casos borde

Listar las reglas en orden de ejecución. Incluir:

- validaciones;
- límites;
- estados;
- operaciones atómicas;
- qué pasa si falla una parte;
- diferencias entre staff y portal del socio.

### 4. Roles y pantallas

Indicar qué puede hacer cada rol y qué pantalla usa:

| Rol | Puede hacer | Pantalla / flujo |
|---|---|---|
| Dueño | ... | ... |
| Staff | ... | ... |
| Profesor | ... | ... |
| Trainer | ... | ... |
| Socio | ... | ... |

### 5. Lo que el sistema NO hace hoy

Lista explícita para no prometer funcionalidad inexistente en el manual:

- ...
- ...

### 6. Problemas y decisiones de negocio

Separar dos cosas:

- **Problemas:** comportamiento defectuoso o confuso, con referencia a `BUGS.md`
  cuando exista un ID.
- **Decisiones de negocio:** comportamiento intencional aunque parezca raro.

No presentar un bug ya cerrado como problema vigente.

### 7. Referencias técnicas

Usar el formato híbrido:

```text
backend/members/services.py · RegistrationService.register
frontend/src/pages/Members.jsx · Members
```

Reglas:

- El archivo y el símbolo son la referencia principal.
- No usar solo un número de línea.
- Si no hay símbolo estable, usar archivo + nombre de sección funcional.
- Las referencias deben existir en el commit de la cabecera.

### 8. Snapshot de referencias

Opcional. Solo si aporta precisión histórica:

```text
backend/members/services.py:101-208 (al commit f5b4b07)
```

El snapshot no reemplaza la referencia por símbolo. El validador avisa si las
líneas quedaron fuera de rango.

### 9. Checklist de verificación

Antes de marcar el documento como verificado:

- [ ] Leí el documento anterior completo.
- [ ] Recorrí `models → serializers → services → views → frontend`.
- [ ] Revisé los tests del módulo.
- [ ] Crucé los problemas con `BUGS.md` y `PLAN-bugs.md`.
- [ ] Actualicé “Lo que NO hace”.
- [ ] Actualicé “Problemas y decisiones”.
- [ ] Convertí las referencias al formato híbrido.
- [ ] Ejecuté `python3 scripts/check_audit_refs.py AUDITORIA-<TEMA>.md`.
- [ ] Ejecuté los tests del módulo.
- [ ] Actualicé mi fila en `AUDITORIA-INDEX.md`.

---

## Convención de nombres

- Documento: `AUDITORIA-<TEMA>.md`.
- Tema en mayúsculas, sin acentos y con guiones si hace falta.
- Un documento por módulo o conjunto de reglas cohesivo.
- No crear documentos por pantalla ni por bug.

---

## Relación con otros documentos

| Documento | Uso |
|---|---|
| `AUDITORIA-INDEX.md` | Índice, alcance y estado de todas las auditorías |
| `AUDITORIA-MAPA-COBERTURA.md` | Mapa doc ↔ código ↔ pantallas ↔ tests |
| `BUGS.md` | Fuente de verdad de bugs, severidad y estado |
| `PLAN-bugs.md` | Plan de corrección por fases |
| `Actualizacion de auditorias.md` | Plan de trabajo de la actualización |
