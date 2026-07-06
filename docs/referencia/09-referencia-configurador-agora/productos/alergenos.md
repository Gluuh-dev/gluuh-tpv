# Productos › Alérgenos

> Catálogo maestro de **alérgenos** (los **14 de declaración obligatoria UE**, Reglamento 1169/2011), cada uno con **nombre e icono**. Se asignan a productos (pestaña *Ficha*) y se muestran en carta, ticket y carta digital. Cumplimiento de **información alimentaria al consumidor**. Confirma el modelo de alérgenos de [03 — Catálogo](../../03-catalogo-productos-y-modificadores/) y la lista de `apps/web/lib/alergenos.ts`.

Capturas: `Alérgenos` (listado) + `Editar Alérgeno`.

---

## Ágora — qué muestra

**Listado** (Id · Nombre · icono) — **14 registros**, los oficiales UE:

| # | Alérgeno | | # | Alérgeno |
|---|----------|---|---|----------|
| 1 | Contiene gluten | | 8 | Frutos de cáscara |
| 2 | Crustáceos | | 9 | Apio |
| 3 | Huevo | | 10 | Mostaza |
| 4 | Pescado | | 11 | Granos de sésamo |
| 5 | Cacahuete | | 12 | Dióxido de azufre y sulfitos |
| 6 | Soja | | 13 | Altramuces |
| 7 | Lácteos | | 14 | Moluscos |

**Editar Alérgeno:** **Nombre** + **Imagen** (icono). CRUD completo.

---

## Qué necesitamos / Mapeo

- Lista maestra **precargada** con los 14 UE (nombre + icono estándar), editable (idioma, icono propio).
- Asignación **N:N a productos** (y derivable de ingredientes, ver escandallo en [06](../../06-compras-proveedores-e-inventario/)).
- Mostrar iconos en: **carta/TPV**, **ticket** (si se configura), y **carta digital/QR**.

```sql
create table allergen (
  id int primary key,                 -- 1..14 oficiales (+ personalizados)
  tenant_id uuid,
  nombre text not null,
  icono_url text
);
create table product_allergen (
  product_id uuid references product(id),
  allergen_id int references allergen(id),
  tipo text default 'CONTIENE'        -- CONTIENE | TRAZAS
);
```

- Multi‑tenant: los 14 son comunes; permitir icono/idioma por tenant. Ya existe `apps/web/lib/alergenos.ts` como base. 🟡 lista existe; asignación a producto + visualización 🔴 por completar.

## Mejoras sobre Ágora

- **Distinguir "contiene" vs "trazas"** (Ágora solo marca presencia).
- **Derivación automática** desde ingredientes/escandallo: si un ingrediente tiene gluten, el producto hereda el alérgeno (menos errores que marcarlo a mano).
- Iconos **accesibles** (texto alternativo, no solo color/imagen) para la carta digital — cumple [accesibilidad](../../02-interfaz-tactil/).
- Aviso en TPV al vender un producto con un alérgeno marcado como **crítico** para el cliente seleccionado (liga con observaciones de [clientes.md](../administracion/clientes.md)).
