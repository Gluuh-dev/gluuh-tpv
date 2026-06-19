# Cocina › Plantillas de Comandas

> Formato del **ticket de comanda** que sale en la **impresora de cocina** (distinto del ticket de cliente, [plantillas-ticket.md](../administracion/plantillas-ticket.md)). Pensado para legibilidad rápida en la partida: letra grande, agrupación, separación por pase. Base de [04 — Impresión §ticket de cocina](../../04-impresion-y-tickets/) y [05](../../05-cocina-kds-y-comanderas/).

Captura: `Plantillas de Comandas` (editor).

---

## Ágora — qué muestra

**Parámetros:**
- **Nombre** (`Plantilla de Comandas`)
- **Idioma** (`Español`)
- **Ancho** (`42 Columnas (Térmica)`) — 32/42/48 según impresora
- **Fuente** (`Grande`) — legible a distancia en cocina
- **Margen Superior / Inferior** (`1` / `1`)

**Parámetros Adicionales:**
- **Imprimir líneas** (`Agrupadas por producto` / por orden de adición…)
- **Separar comanda** (`Por defecto` / por pase / por estación)
- ☐ **Ordenar productos por familia**
- ☐ **Imprimir número de pedido**
- ☐ **Imprimir código de PLU**

> A diferencia del ticket de cliente, la comanda **no lleva precios ni QR**: prioriza qué cocinar, en qué orden y con qué notas. Usa el **nombre de cocina** del producto ("Texto para comanda", [producto.md §3](../productos/producto.md)) y muestra las **notas de preparación** ([notas-y-motivos.md](notas-y-motivos.md)).

## Mapeo a nuestro modelo

```sql
create table comanda_template (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null, idioma text default 'es',
  columnas int default 42, fuente text default 'GRANDE',
  margen_sup int default 1, margen_inf int default 1,
  imprimir_lineas text default 'AGRUPADAS_PRODUCTO',
  separar_comanda text default 'DEFECTO',
  ordenar_por_familia boolean default false,
  imprimir_num_pedido boolean default false, imprimir_plu boolean default false
);
```

- Se asigna al **monitor/impresora de cocina** ([monitores-cocina.md](monitores-cocina.md)). 🔴 falta como configurador (el render de comanda básico puede estar en operativa).

## Mejoras sobre Ágora

- **Fuente extra‑grande** y alto contraste por defecto (cocina con prisa, vapor, lejanía).
- Separación automática **por estación** además de por pase, para que cada partida vea solo lo suyo.
- Misma plantilla sirve para **impresora y KDS** (coherencia visual), no dos configs distintas.
