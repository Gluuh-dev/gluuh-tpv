# Herramientas › Recursos (multi-idioma / traducciones)

> Traducción de los **textos del catálogo** (nombres de productos, categorías, etc.) a varios idiomas, con import/export Excel. Alimenta la carta digital ([carta-digital.md](carta-digital.md)) y el ticket/idioma de las plantillas.

Captura: `Editar Recursos`.

---

## Ágora — qué muestra

- **Idioma Referencia** (`Español`) — el idioma en que están los textos originales de Ágora.
- **Añadir / Eliminar** idioma.
- **Textos**: tabla con una **columna por idioma**, lista de literales (nombres de producto: `1/2 SOBRASADA`, `1/2 ATUN TOMATE QUESO`…). **Exportar Excel / Importar Excel** para traducir en lote.

> Traducción a nivel de **literal** (no solo UI): la carta online y el ticket pueden salir en el idioma del cliente. Encaja con el **nombre por destino** del producto ([producto.md §3](../productos/producto.md)) y el idioma de plantilla ([plantillas-ticket.md](../administracion/plantillas-ticket.md)).

## Mapeo a nuestro modelo

```sql
create table locale (tenant_id uuid, codigo text);   -- es, en, de, fr...
create table translation (
  tenant_id uuid,
  entity_type text, entity_id uuid, campo text,       -- product.nombre_carta...
  locale text, texto text,
  primary key (entity_type, entity_id, campo, locale)
);
```

- i18n a nivel de dato (no solo de UI). Resolver el texto por `locale` del cliente/carta. Import/export Excel = endpoint en `apps/api`. 🔴 falta.

## Mejoras sobre Ágora

- **Traducción asistida** (sugerir traducción automática, revisar y confirmar) para no traducir 700 productos a mano.
- Idioma del cliente **autodetectado** en la carta digital; fallback al idioma de referencia.
- Reutilizar para la **UI** del TPV/comandera (multi‑idioma del personal) además de la carta.
