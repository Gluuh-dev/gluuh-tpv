# 13 · Rediseño de configuración y estilos generales (backlog por sesiones)

**Fecha:** 06-07-2026. Recoge el feedback del cliente sobre el backoffice para
implementarlo **por sesiones** (una entrega por bloque). Cada sesión cierra con
sus criterios de aceptación; al terminarla, anotar en `docs/sesiones/` (skill
`gluuh-registro`).

> **Principio rector.** El backoffice tiene que sentirse **profesional y
> predecible**: cada entrada del menú abre **su** página autocontenida (nunca
> redirige a otra), toda página de edición tiene el **mismo footer** con Guardar/
> Cancelar, y hay un **buscador global** para llegar a cualquier sitio. Lo
> crítico (seguridad, bloqueo) no puede fallar.

---

## Estilos generales (transversales — se aplican a TODAS las páginas)

Estos dos van **primero** porque los heredan el resto de sesiones. Ambos son
componentes compartidos en `apps/web/components/`.

### E1 · Footer fijo con Guardar / Cancelar centrados
- Barra **siempre pegada abajo** (`sticky bottom-0`), a lo ancho del contenido,
  con **Guardar** y **Cancelar centrados** en la barra (no a la derecha).
- Un solo componente `components/footer-acciones.tsx`: props `onGuardar`,
  `onCancelar`, `guardando`, `deshabilitado`. Fondo con borde superior y leve
  blur; por encima del contenido pero sin tapar el último campo (padding-bottom
  reservado en el layout de la página).
- Sustituye a los botones sueltos «Guardar/Aceptar» que hoy cada ficha pinta al
  final (familias, categorías, productos, ajustes…). Debe convivir con el patrón
  de la guía de diseño (`docs/especificaciones/guia-de-diseno.md` §19).
- **Aceptación:** en cualquier ficha de edición, al hacer scroll, Guardar/Cancelar
  siguen visibles y centrados abajo; funciona en claro/oscuro y en móvil.

### E2 · Buscador global (command palette estilo Supabase)
- En la **navbar de cada página** un buscador (o icono de lupa + atajo `Ctrl/⌘+K`)
  que abre un **modal centrado** estilo Supabase/`cmdk`.
- Busca **todo**: páginas del panel (`lib/nav.ts`), productos, familias,
  categorías, empleados, clientes… agrupado por tipo, con teclado (↑↓, Enter) y
  navegación directa al resultado.
- Componente `components/command-palette.tsx` + hook de atajo global; el índice de
  páginas sale de `NAV`, los datos por consulta a Supabase (debounce).
- **Aceptación:** `Ctrl/⌘+K` abre el modal desde cualquier página; teclear
  «product…» lista páginas y productos; Enter navega; Esc cierra.

> Nota: hoy las notificaciones ya son **Sileo** (`app/lib/toast.ts`), el tema es
> claro/oscuro por `next-themes`. El buscador y el footer deben respetar ambos.

---

## Sesiones (por orden de ejecución)

### S1 · Empresa y Local  ★ EN CURSO
Rehacer `/ajustes` (`app/(panel)/ajustes/page.tsx`) como **ficha de empresa
profesional** con los bloques de la referencia del cliente (captura Ágora):

- **Datos administrativos:** Nombre Fiscal (`razon_social`), Nombre Comercial
  (**nuevo** `nombre_comercial`), CIF (`cif`).
- **Ubicación:** Dirección (`direccion`), Población (**nuevo** `poblacion`),
  Provincia (**nuevo** `provincia`), Código Postal (**nuevo** `codigo_postal`).
- **Contacto:** Contacto/persona (**nuevo** `contacto`), Teléfono (**nuevo**
  `telefono`), Email (**nuevo** `email`), Página Web (**nuevo** `web`).
- Mantener lo fiscal necesario: **territorio fiscal** y **serie de factura**
  (bloque «Fiscalidad»).
- **Sacar de esta página** (van a sus propias sesiones): Bloqueo del TPV → S2;
  Marca y apariencia → S3 (queda un enlace); Orden de botones del TPV → S4.
- Layout a **dos columnas** (datos + contacto), footer E1.

**DDL (migración 0069, aplicar por MCP + espejo):** añadir a `location`
`nombre_comercial text`, `poblacion text`, `provincia text`, `codigo_postal text`,
`contacto text`, `telefono text`, `email text`, `web text` (todas `null`).
`razon_social` = Nombre Fiscal; `location.nombre` sigue como nombre corto del local.

**Aceptación:** los 11 campos de la captura se guardan y recargan; la migración
degrada (aviso ámbar) si no está aplicada; footer E1.

### S2 · Seguridad (Administración)  — crítico, no puede fallar
Página **nueva** `/seguridad` (entrada en `lib/nav.ts` → Administración → Usuarios),
que **absorbe** lo que hoy está disperso en `/ajustes`:
- **Bloqueo del TPV**: velo por inactividad (segundos) y/o al terminar cada cuenta
  (ya existe en `setting` `tpv.bloqueo`; mover la UI aquí).
- **Passkeys / acceso rápido** (huella, Face ID, Windows Hello): mover el bloque
  de passkey de `/ajustes`.
- **Sesión de trabajo por cuenta / cierre**: al cerrar cada cuenta se re-pide
  identidad (PIN/pulsera); revisar contra la atribución de camarero por línea
  (0059) y el velo de bloqueo. Registrar quién abre/cierra.
- Futuro (anotar, no bloquea): política de contraseña, caducidad de sesión del
  panel, registro de accesos (liga con la auditoría `audit_log`, doc 07 de
  `referencia/`).
- **Aceptación:** el bloqueo se configura aquí y el TPV lo respeta; passkeys
  funcionan; `/ajustes` ya no muestra estos bloques.

### S3 · Marca y apariencia (Empresa y Local)
- Consolidar la identidad visual del cliente: logo, logo de ticket (b/n),
  colores de marca, kiosko/cartelería. Hoy vive en `/personalizar`
  (`tenant_branding`); decidir si **Marca y apariencia** es su nombre definitivo
  bajo Empresa y Local y pulir la página a nivel profesional (previsualización).
- Incluir el **tema** (claro/oscuro) del panel.
- **Aceptación:** desde Empresa y Local se llega a Marca y apariencia; cambiar
  logo/colores se refleja en TPV/kiosko; footer E1.

### S4 · Orden de botones del TPV (sección propia)
- Página/**sección dedicada** (bajo Empresa/Herramientas) para ordenar la columna
  de funciones del TPV (Aparcar, Dividir, Cliente, F10-F12…). Ya existe la lógica
  en `/ajustes` (`setting` `tpv.funciones.orden`, `BOTONES_TPV`); sacarla a su
  propia página con drag-and-drop (hoy son flechas ↑↓) y previsualización.
- **Aceptación:** reordenar y guardar cambia el orden real en `app/tpv`; footer E1.

### S5 · Arreglar la navegación (no redirigir)
- **Problema:** varias entradas del menú **redirigen** a otra página, lo que
  desorienta. Hoy: `/carta → /productos`, `/dispositivos → /modulos`,
  `/plantillas-ticket → /configuracion-de-impresion` (`redirect()` en su `page.tsx`).
- **Decisión a tomar por entrada:** o (a) la entrada tiene contenido propio, o
  (b) se **elimina del menú** (`lib/nav.ts`) en vez de redirigir en silencio.
  Ninguna entrada visible debe saltar a una ruta distinta sin avisar.
- Revisar todo `lib/nav.ts`: que cada `href` visible abra SU página; quitar los
  `soon`/huérfanos que lleven a sitios que no son.
- **Aceptación:** pulsar cualquier entrada del menú abre exactamente esa página
  (misma URL en la barra); cero redirecciones sorpresa.

---

## Notas de implementación

- **Persistencia:** ajustes de comportamiento (bloqueo, orden de botones) siguen
  en `setting` (GLOBAL/LOCAL/DEVICE), no en columnas nuevas (regla del repo).
  Datos de empresa/local → columnas de `location` (S1).
- **BD por MCP** (token personal ya configurado); espejo en `apps/api/db/schema.sql`.
- Orden sugerido: **E1 → E2 → S1 → S5 → S2 → S3 → S4** (los estilos primero para
  no rehacer footers; S5 es barato y quita la confusión del menú cuanto antes).
- Cada sesión, al cerrarla: entrada en `docs/sesiones/` + este documento marca la
  sesión como hecha.
