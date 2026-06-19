# Administración › Impuestos ★ (fiscal — núcleo)

> Tabla de **tipos impositivos** configurables: nombre, **valor %**, **recargo de equivalencia %**, **tipo** (IVA/IGIC/IPSI) y habilitado. Es la pieza que en Gluuh ya resuelve `@gluuh/core` (`tax-rates.ts`, `ivaAuto`) y la tabla SQL `tax_rate`/`resolver_iva()`. **Innegociable que cuadre** con el motor fiscal y el vector AEAT. Ver [03 — Catálogo](../../03-catalogo-productos-y-modificadores/) y [07-facturación](../../../07-facturacion-y-cumplimiento-legal.md).

Captura: `Impuestos` → *Lista de Impuestos*.

---

## Ágora — qué muestra

Tabla de hasta 10 filas: **# · Nombre · Valor · Recargo · Tipo · Habilitado**. En este negocio (Granada → **península, IVA**):

| # | Nombre | Valor | Recargo (equiv.) | Tipo | Habilitado |
|---|--------|------:|------:|------|:--:|
| 1 | Exento | 0.000 % | 0.000 % | IVA | ☐ |
| 2 | Super reducido | 4.000 % | 0.500 % | IVA | ☐ |
| 3 | **Reducido** | 10.000 % | 1.400 % | IVA | **☑** |
| 4 | General | 21.000 % | 5.200 % | IVA | ☐ |
| 5–10 | *(libres)* | 0.000 % | 0.000 % | IVA | ☐ |

> Observaciones:
> - El **Recargo** es el **recargo de equivalencia** (régimen especial IVA): 21→5,2 · 10→1,4 · 4→0,5. Conecta con el flag *Aplicar recargo de equivalencia* del cliente ([clientes.md](clientes.md)).
> - Aquí solo **Reducido (10%)** está habilitado → un bar que factura comida al tipo reducido.
> - **Tipo** es un desplegable (`IVA`): en un despliegue **canario** sería **IGIC** con otros valores (general 7 %, reducido 3 %, 0 %…), y en Ceuta/Melilla **IPSI**.

---

## Cómo lo hacemos nosotros (clave: territorio)

Ágora tiene **una lista por instalación** (esta es IVA peninsular). Nuestro modelo es **territorio‑consciente**: el % se resuelve por **clase fiscal × territorio**, no se reescribe a mano por local.

```
Producto.clase_fiscal (GENERAL|REDUCIDO|SUPERREDUCIDO|EXENTO)
        × Tenant.territorio (PENINSULA|CANARIAS|CEUTA_MELILLA|FORAL)
        → @gluuh/core ivaAuto  /  SQL resolver_iva()  → % aplicado
```

| Clase | Península (IVA) | Canarias (IGIC) | Ceuta/Melilla (IPSI) |
|-------|----------------:|----------------:|---------------------:|
| General | 21 % | 7 % | ~10 % |
| Reducido | 10 % | 3 % | … |
| Superreducido | 4 % | 0 % | … |
| Exento | 0 % | 0 % | 0 % |

```sql
-- ya existe como referencia en @gluuh/core (tax-rates.ts) + tabla tax_rate
create table tax_rate (
  tenant_id uuid,
  territorio text not null,     -- PENINSULA_BALEARES|CANARIAS|CEUTA_MELILLA|FORAL_*
  clase_fiscal text not null,   -- GENERAL|REDUCIDO|SUPERREDUCIDO|EXENTO
  tipo text not null,           -- IVA|IGIC|IPSI
  valor numeric(6,3) not null,
  recargo_equivalencia numeric(6,3) default 0,
  habilitado boolean default true,
  primary key (tenant_id, territorio, clase_fiscal)
);
```

> **Innegociable:** estos valores deben coincidir con `TIPOS_POR_TERRITORIO` de `@gluuh/core` y con el seed SQL (`resolver_iva()`), como exige `CLAUDE.md`. El precio de carta lleva **impuesto incluido**; `calcularImpuestosIncluidos` desglosa la base. El test del **vector oficial AEAT** valida el motor.

## Mejoras sobre Ágora

- **No editar % a mano por local**: se elige el **territorio** del tenant y los tipos se aplican solos (evita errores como poner 21% en Canarias).
- Soporte nativo **IGIC e IPSI** en el mismo modelo (Ágora lo trata como "IVA" genérico configurable).
- **Recargo de equivalencia** ligado al cliente, calculado por `@gluuh/core`, no como columna suelta.
- Validación: avisar si un % editado se desvía del oficial del territorio (protege el cumplimiento).
