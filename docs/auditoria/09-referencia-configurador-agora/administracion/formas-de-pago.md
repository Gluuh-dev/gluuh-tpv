# Administración › Formas de Pago

> Medios de cobro (Efectivo, Tarjeta, Transferencia, AgoraPay, vales…), cada uno con un comportamiento configurable: si abre cajón, da cambio, entra en arqueo, registra propina, usa pasarela, etc. Alimenta el cobro del TPV y el cuadre de caja. Ver [08 — Pasarelas de pago](../../../08-pasarelas-de-pago.md).

Capturas: `Formas de Pago` (listado) + `Editar Forma de Pago`.

---

## A. Listado

**Id · Nombre · Prioridad** (orden de aparición en el cobro). Ej.:

| Id | Nombre | Prioridad |
|----|--------|----------:|
| 1 | Efectivo | 1 |
| 2 | Tarjeta | 99 |
| 5 | Transferencia | 9 |
| 6 | AgoraPay | 2 |
| 7 | La Palma | 999 |

> "La Palma" (prioridad 999) parece un medio propio/fidelización del negocio. La **prioridad** ordena los botones de cobro.

## B. Editar Forma de Pago

**Forma de Pago:** Nombre. **Estilo:** Texto · Color (`#bacde2`) · Imagen · **Prioridad**.

**Opciones** (todas casillas):
| Opción | Para qué |
|--------|----------|
| Permitir usar en **documentos de venta** | cobros/abonos de venta |
| Permitir usar en **documentos de compra** | pagos a proveedor |
| **Devolver cambio** | calcula cambio (efectivo) |
| **Permitir pagar más del total** | sobre‑pago (efectivo) |
| **Abrir cajón** | pulso al cajón al usarla |
| **Incluir en el arqueo de caja** | cuenta en el cuadre (efectivo sí, tarjeta normalmente no) |
| **Registrar propina** | admite propina con este medio |
| *(propina en arqueo / propinas descuentan del saldo del cajón)* | tratamiento de propina en caja |
| **Permitir usar en pedidos telefónicos** | |
| **Utilizar para recaudación de repartidores** | imputa cobros al repartidor (único medio para ello) |
| **Obligar a introducir un cliente** + **Tipo de Cliente** | exige cliente (p. ej. crédito/empresa) |
| **Máximo permitido** (`Sin límite`) | importe máx. por factura con este medio |
| **Permitir usar en las devoluciones** | abonos |
| **Imprimir vales de devolución** | emite vale (único medio que lo hace) |
| **Usar pasarela de pago** | enlaza con datáfono/pasarela (único medio que la usa) |
| **Grupos de Puntos de Venta** *(colapsada)* | **`[propuesta]`** en qué terminales aparece la forma de pago |

---

## Mapeo a nuestro modelo

```sql
create table payment_method (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null,
  prioridad int default 0,
  color text, imagen_url text,
  -- comportamiento
  uso_venta boolean default true, uso_compra boolean default false,
  devolver_cambio boolean default false, permitir_sobrepago boolean default false,
  abrir_cajon boolean default false, incluir_arqueo boolean default false,
  registrar_propina boolean default false,
  uso_telefonico boolean default false, recaudacion_repartidor boolean default false,
  obliga_cliente boolean default false, tipo_cliente_id uuid,
  maximo numeric(10,2),            -- null = sin límite
  uso_devolucion boolean default true, imprime_vale boolean default false,
  usa_pasarela boolean default false, gateway_config_id uuid
);
```

- Multi‑tenant RLS. El arqueo/cuadre (qué medios cuentan) liga con la **caja** de [07 — Configuración](../../07-configuracion-y-administracion/). Las propinas alimentan el informe "propinas por forma de pago" del **Cierre Z** ([locales.md §11](locales.md)). 🟡 cobro existe en operativa; este configurador 🔴 falta.

## Mejoras sobre Ágora

- **Conciliación con pasarela**: cruzar el cobro con la liquidación del datáfono (AgoraPay/Redsys) automáticamente.
- Medios de **fidelización/monedero** ("La Palma") de primera clase, con saldo, no como forma de pago suelta.
- Reglas de **máximo legal** (efectivo: límite de pagos en efectivo entre empresa y particular según normativa) con aviso.
