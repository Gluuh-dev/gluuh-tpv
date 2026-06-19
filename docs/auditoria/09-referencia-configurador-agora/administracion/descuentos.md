# Administración › Descuentos (manuales)

> Descuentos **predefinidos** que el operario aplica a mano (botones): a una **línea** o al **ticket entero**, en **porcentaje** o **importe**, con **autorización** opcional (control por permiso). Distinto de **Promociones** ([promociones.md](promociones.md)), que se aplican solas por reglas.

Capturas: `Descuentos` (listado, vacío) + `Editar Descuento`.

---

## Ágora — qué muestra

**Listado** — Id · Nombre · **Valor** · **Modo** · **Tipo**. CRUD.

**Editar Descuento:**
- **Parámetros**: Nombre · Código · **Tipo** (`Descuento en Línea` / Descuento en Ticket) · **Modo** (`Porcentaje` / Importe) · **Descuento** (valor) · ☐ **Solicitar autorización**.
- **Estilo**: Texto · Color (`#bacde2`) · Imagen.
- **Grupos de Puntos de Venta** *(colapsada → `[propuesta]`: en qué terminales aparece el botón de descuento)*.

---

## Qué necesitamos / Mapeo

```sql
create table discount (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text, codigo text,
  tipo text not null,            -- LINEA | TICKET
  modo text not null,            -- PORCENTAJE | IMPORTE
  valor numeric(10,2) not null,
  requiere_autorizacion boolean default false,
  color text, imagen_url text
);
```

- **`requiere_autorizacion`** se cruza con la **matriz de permisos** ([usuarios-y-perfiles.md](usuarios-y-perfiles.md)): si el camarero no tiene permiso de descuento, pide PIN de un encargado. Respaldar en backend/RLS, no solo en UI.
- El descuento afecta a base/impuesto: cálculo por `@gluuh/core` con **impuesto incluido**; queda reflejado en el ticket ([plantillas-ticket.md](plantillas-ticket.md), líneas `Dto.`) y en VERIFACTU. 🔴 falta como configurador.

## Mejoras sobre Ágora

- **Límite máximo** por rol (un camarero hasta 10%, encargado sin límite).
- **Motivo de descuento** obligatorio (lista + libre) para auditoría — enlaza con el informe de descuentos/cancelaciones del Cierre Z.
- Botones de descuento **visibles según permiso** del usuario logado (los que no puede usar, no se muestran).
