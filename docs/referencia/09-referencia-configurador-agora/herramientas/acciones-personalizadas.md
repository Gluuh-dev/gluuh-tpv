# Herramientas › Acciones Personalizadas

> **Botones de acción personalizados** para el TPV: cobro directo con un medio concreto, o abrir una **URL/aplicación** externa. Son las "acciones personalizadas" que aparecen en la **matriz de permisos** ([usuarios-y-perfiles.md](../administracion/usuarios-y-perfiles.md), p. ej. *Ejecutar AgoraPay*).

Capturas: `Acciones Personalizadas` (listado + editor).

---

## Ágora — qué muestra

**Listado** — Id · **Texto del Botón** · **Tipo** · **Valor**:

| Texto | Tipo | Valor |
|-------|------|-------|
| Cobrar en Efectivo | Cobro directo | Efectivo |
| Cobrar en Tarjeta | Cobro directo | Tarjeta |
| AgoraPay | Cobro directo | AgoraPay |

**Editor:** **Texto** · **Tipo** (`Url/Aplicación` / `Cobro directo` …) · **Acción** (valor: medio de pago o URL) · ☐ **Mostrar URLs en un diálogo de Ágora** (in‑app vs externo) · **Img. Tema Claro** · **Img. Tema Oscuro** (icono por tema).

> **Cobro directo** = botón que cobra todo con un medio sin pasar por el selector (cobro de un toque, clave para velocidad). **Url/Aplicación** = lanzar una web/app (reservas, fidelización, balanza, etc.).

## Mapeo a nuestro modelo

```sql
create table custom_action (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  texto text not null,
  tipo text not null,            -- COBRO_DIRECTO | URL_APP
  valor text,                    -- medio de pago | url
  url_en_dialogo boolean default false,
  img_claro_url text, img_oscuro_url text
);
```

- El permiso de ejecutar cada acción se controla por rol ([usuarios-y-perfiles.md](../administracion/usuarios-y-perfiles.md)); el **cobro directo** liga con [formas-de-pago.md](../administracion/formas-de-pago.md). 🔴 falta.

## Mejoras sobre Ágora

- Cobro directo con **propina rápida** y apertura de cajón configurable por acción.
- Acciones que llaman a **nuestras propias rutas** (abrir KDS, imprimir reimpresión, llamar a cocina) además de URLs externas.
- Icono por tema ya lo tiene Ágora; añadir **color de marca** y posición/orden en la botonera.
