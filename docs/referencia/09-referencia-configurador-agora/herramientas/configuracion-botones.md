# Herramientas › Configuración de Botones

> **Perfiles de layout** de la botonera del TPV/comandera según el **dispositivo**: tamaño de botón y disposición por tipo de terminal. Es la "Configuración" de *Opciones de Pantalla* que referencia cada [Punto de Venta §8](../administracion/puntos-de-venta.md) (p. ej. `Básica - TPV WEB`).

Captura: `Configuración de Botones` (listado).

---

## Ágora — qué muestra

**Listado** — Id · **Nombre** · **Tipo** · **Botones** (tamaño):

| Nombre | Tipo | Botones |
|--------|------|---------|
| Smartphone | COMANDERA | Grandes |
| Tablet | TABLET | Grandes |
| Básica - TPV WEB | TPV | Medianos |
| Comandas - TPV WEB | TPV | Medianos |
| AGORAPAY | COMANDERA | Grandes |

> Cada perfil define el **tamaño/densidad** de los botones según el dispositivo: móvil/comandera → **botones grandes** (dedo, prisa); TPV de mostrador → **medianos** (más densidad, pantalla grande). Coincide con los principios táctiles de [02 — Interfaz](../../02-interfaz-tactil/) (objetivos ≥ 64 px en operativa móvil).

## Mapeo a nuestro modelo

```sql
create table button_layout (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null,
  tipo_dispositivo text not null,   -- TPV | COMANDERA | TABLET
  tamano_boton text not null,       -- GRANDES | MEDIANOS | PEQUENOS
  config jsonb                      -- columnas, densidad, favoritos...
);
-- device.button_layout_id → button_layout(id)  (ver puntos-de-venta.md §8)
```

🔴 falta como configurador.

## Mejoras sobre Ágora

- **Responsive automático**: en vez de perfiles fijos, adaptar columnas/tamaño al viewport (un layout, muchos tamaños) — menos config manual.
- Permitir al usuario **fijar favoritos** y reordenar su botonera (drag‑drop), respetando mínimos táctiles.
- Modo **alto contraste / texto grande** para accesibilidad ([02](../../02-interfaz-tactil/)).
