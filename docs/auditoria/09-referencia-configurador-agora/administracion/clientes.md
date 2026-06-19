# Administración › Clientes

> Ficha de **cliente** (CRM ligero): datos fiscales para facturar, condiciones comerciales (tarifa, descuento, recargo de equivalencia), direcciones de entrega para delivery, promociones, precios especiales y observaciones. Es a quién se emite **factura completa** (no la simplificada de barra). En este negocio hay **137 registros** — mayoría empresas.

Capturas: `Clientes` (listado) + `Editar Cliente` (form completo, 3 capturas).

---

## A. Listado de clientes

**Ágora — columnas:** Id · **Nombre Fiscal** · Nombre Comercial · País · **CIF/NIF** · Tipo · Cuenta Contable · Contacto · Cliente Principal · Teléfono · Dirección · Población · Provincia · Cód. Postal · Email · Enviar publicidad. CRUD **Nuevo · Copiar · Editar · Eliminar** + Buscar. (137 registros.)

> Nota: el cliente especial **«Pedido en Mesa»** aparece como registro (id 100…) sin NIF — es el cliente genérico para ventas sin identificar.

**Qué necesitamos:** listado filtrable/buscable con las columnas clave (fiscal, NIF, contacto, población, email). Export. 🔴 falta (tenemos clientes en operativa pero no este maestro CRM).

---

## B. Editar Cliente — secciones

### 1. Datos Administrativos
| Campo | Nota |
|-------|------|
| Nom. Fiscal | Razón social (obligatorio para factura) |
| Nom. Comercial | |
| País | `España` por defecto |
| **Tipo Documento** | `Otro` / NIF / CIF / NIE / Pasaporte / **VAT intracomunitario** |
| **CIF/NIF** | Validar según tipo y país |
| Cuenta Contable | Para exportación a contabilidad |
| **Tipo** (de cliente) | FK a [Tipos de Clientes](tipos-clientes.md) |
| **Subcliente de** | Jerarquía cliente → subcliente (buscador) |
| Tarjeta + *Requiere identificación mediante lectura de tarjeta* | Fidelización / acceso por tarjeta |

### 2. Ubicación
Dirección · Población · Provincia · Código Postal (domicilio fiscal).

### 3. Contacto
Contacto (persona) · Teléfono · Email · ☐ **Enviar Publicidad** (consentimiento RGPD).

### 4. Condiciones Comerciales
| Campo | Nota |
|-------|------|
| **Tarifa** | Lista de precios aplicada (FK a tarifas/price_list) |
| **% Descuento** | Descuento por defecto (0.00) |
| ☐ **Aplicar recargo de equivalencia** | Régimen especial IVA para autónomos minoristas |

### 5. Direcciones de Entrega
Tabla **Dirección · Población · Provincia · Código Postal** (N por cliente, alta/edición/borrado). Para **delivery** y albaranes a distinta dirección que la fiscal.

### 6. Promociones
Tabla **Id · Nombre · Apl./Día · Desde · Hasta · Programación** — promociones asociadas al cliente, con vigencia y programación horaria/por día.

### 7. Precios Especiales (colapsable)
Precio fijado por producto para este cliente (override de tarifa).

### 8. Observaciones
Textarea + ☐ **Mostrar al asignar el cliente a un documento** (aviso al seleccionarlo en el TPV — p. ej. "cobra siempre en efectivo", "cliente moroso").

### 9. Grupos de Puntos de Venta (colapsable)
En qué grupos de TPV es visible el cliente (coincide con *Operativa de Venta* de [`locales.md` §10](locales.md)).

---

## Qué necesitamos / Mapeo a nuestro modelo

```sql
create table customer (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre_fiscal text not null,
  nombre_comercial text,
  pais text default 'ES',
  tipo_documento text,            -- NIF|CIF|NIE|PASAPORTE|VAT|OTRO
  nif text,
  cuenta_contable text,
  group_id uuid references customer_group(id),   -- "Tipo"
  parent_id uuid references customer(id),         -- "Subcliente de"
  tarjeta text,
  requiere_tarjeta boolean default false,
  -- ubicación
  direccion text, poblacion text, provincia text, cp text,
  -- contacto
  contacto text, telefono text, email text, enviar_publicidad boolean default false,
  -- condiciones
  price_list_id uuid, descuento numeric(5,2) default 0,
  recargo_equivalencia boolean default false,
  observaciones text, observaciones_aviso boolean default false
);
create table customer_address (   -- direcciones de entrega
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customer(id),
  direccion text, poblacion text, provincia text, cp text
);
-- customer_promotion, customer_special_price → fases posteriores
```

- Multi‑tenant RLS por `tenant_id`. El **recargo de equivalencia** y la **tarifa** afectan al cálculo fiscal/precio → coordinar con `@gluuh/core` y [03](../../03-catalogo-productos-y-modificadores/). 🔴 falta.

## Mejoras sobre Ágora

- **Validación de NIF/CIF/VAT** en vivo según tipo de documento y país (clave para factura VERIFACTU correcta).
- **RGPD de serie**: el flag *Enviar Publicidad* con fecha/origen de consentimiento y export/borrado del cliente (ver [12 — Seguridad y RGPD](../../../12-seguridad-y-rgpd.md)).
- Buscar cliente por NIF/teléfono/email desde el TPV en 1 toque y asignarlo al ticket.
- El **aviso de observaciones** al asignar (Ágora ya lo tiene) es muy útil — mantenerlo.
