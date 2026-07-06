---
name: gluuh-registro
description: >-
  Cómo documentar el trabajo hecho en Gluuh TPV: registro de cambios,
  implementaciones y mejoras por sesión en docs/sesiones/, y qué documentos
  vivos actualizar (checklist maestro, guías de implementacion/, skills).
  Úsala cuando el usuario pida "documenta los cambios", "traspaso",
  "registro de sesión" o similar, al cerrar una sesión de trabajo relevante,
  y tras aplicar migraciones, features o decisiones con el cliente.
---

# Registro de cambios y traspasos — Gluuh TPV

Objetivo: que cualquier sesión (persona o agente) pueda continuar el trabajo
sin releer todo el historial. El registro cuenta lo que git no cuenta: el
**porqué**, lo aplicado **fuera del repo** (Supabase, panel, servicios) y lo
**pendiente en orden**.

## Dónde vive cada cosa

| Qué | Dónde |
|---|---|
| Registro por sesión (traspaso) | `docs/sesiones/AAAA-MM-DD-traspaso.md` — uno por sesión, indexado en `docs/sesiones/README.md` |
| Estado global del producto ✅/🟡/❌ | `docs/plan/08-checklist-maestro-100.md` |
| Estado por frente | columna de estado en `docs/implementacion/README.md` |
| Trampas y catálogo de cambios de BD | skill `gluuh-base-datos` |
| Índice general de docs | `docs/README.md` |

## Al cerrar una sesión (o cuando lo pidan)

1. Escribir `docs/sesiones/AAAA-MM-DD-traspaso.md` con la plantilla de abajo
   y añadir su fila en `docs/sesiones/README.md`. Si ya existe el fichero del
   día, ampliarlo — no crear un segundo.
2. Actualizar los documentos vivos afectados (el traspaso solo enlaza, no
   sustituye): estado en `docs/implementacion/README.md`, checklist maestro si
   algo pasó a ✅/🟡, y la skill correspondiente si aparecieron trampas nuevas
   (p. ej. `gluuh-base-datos` tras una migración con gotcha).
3. Precisión: fechas absolutas (nunca "ayer"), IDs concretos (migración
   `00NN_nombre.sql`, hash de commit, tenant, tabla, ruta de fichero), y
   distinguir siempre **aplicado en Supabase** vs **commiteado en el repo**
   (pueden divergir: el historial `supabase_migrations` de la BD está vacío,
   las migraciones se aplican por MCP y se versionan como fichero).

## Plantilla del traspaso

```markdown
# Traspaso de sesión — DD/MM/AAAA

Contexto en 2-3 líneas: frente trabajado, objetivo y referencias externas
(Artifact, manual del cliente…).

## 1. Decisiones (con el cliente o de diseño)
- Qué se decidió y por qué. Enlazar el doc vigente que lo recoge.

## 2. Hecho (aplicado y verificado)
- Migraciones: `00NN_nombre.sql` — aplicada en Supabase ✔/✘, commiteada ✔/✘.
- Código: ficheros tocados + estado (commiteado / working tree sin commitear).
- Cómo se verificó: build, test, dato real en BD.

## 3. Pendiente (en orden)
1. Primera tarea del próximo chat.
2. …

## 4. Datos operativos / gotchas
- Lo que haría tropezar a la siguiente sesión: IDs de tenants, credenciales
  que sí/no funcionan, trampas de esquema, pasos manuales del usuario.
```

Ejemplo real completo: `docs/sesiones/2026-07-06-traspaso.md`.

## Reglas

- **No duplicar lo que ya cuenta git** (diffs, lista de commits): registrar
  decisiones, estado fuera del repo y pendientes.
- Si una decisión cambia el modelo o el plan, el sitio de la decisión es
  `docs/plan/` o la guía de `docs/implementacion/`; el traspaso
  la resume en una línea y enlaza.
- Español, rutas relativas a la raíz del repo, conventional commits si se
  commitea el registro (`docs: traspaso de sesión DD-MM`).
