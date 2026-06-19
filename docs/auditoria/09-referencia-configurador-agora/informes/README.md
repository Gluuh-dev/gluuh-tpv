# Informes — catálogo Ágora + propuesta Gluuh (qué ponemos y cómo)

> Ágora trae **~60 informes** agrupados. Aquí: (A) el **catálogo completo** de referencia, (B) **qué ya tenemos** en `apps/web`, (C) **qué proponemos** construir, priorizado, y (D) **cómo** lo hacemos técnicamente. El usuario delegó la decisión de alcance y enfoque.

---

## A. Catálogo de Ágora (referencia, por grupo)

| Grupo | Informes |
|-------|----------|
| **Análisis** | Análisis de Ventas · Análisis de Compras · Análisis de Stocks |
| **Ventas** | Evolución de Ventas · Comparativa Interanual · Resumen Fiscal · Invitaciones · Reservas · **Documento 347** · Estado de Ticket BAI |
| **Catálogo** | Grupos Mayores · Familias y Productos · Categorías y Productos · Productos en Menús · Márgenes por Familias · Márgenes por Categorías · Promociones y Productos · Alérgenos por Producto · Histórico de Ventas · **Menú Engineering** · Top 50 Formatos · Top 50 Productos · Ventas Diarias |
| **Usuarios** | Rendimiento de Usuarios · Usuarios por Periodo de Servicio · Productos por Usuario · Descuentos por Usuario y Producto · Descuentos por Usuario y Tipo · Cancelaciones por Usuario y Producto · Cancelaciones por Usuario y Tipo · Propinas por Usuario · Asistencia por Usuario · Descuentos Autorizados |
| **Centros de Venta** | Centros de Venta · Ventas por Ubicación · Productos por Centro de Venta · Comensales por Centro de Venta · Operaciones por Centro de Venta |
| **Caja** | Formas de Pago · Tarifas · Movimientos de Caja · Ágora Payments · Cobros Pendientes · Propinas por Formas de Pago · Transacciones con Tarjeta |
| **Periodos de Servicio** | Productos · Centros de Venta · Comensales · Operaciones (por periodo) |
| **Clientes** | Ventas a Cliente · Facturas por Cliente · Impuestos por Cliente · Productos Vendidos a Cada Cliente |
| **Almacén** | Entradas Detalladas por Proveedor · Compras por Proveedor · Precios de Compra · Compras y Ventas por Producto · Stock por Producto · Facturas de Proveedor · Histórico de Compras · Movimientos por Producto · Pagos Pendientes · Pedidos por Recibir · Valoración de Mermas |
| **Cocina** | Tiempos de Preparación |
| **Diarios** | Diario de Facturas · Diario de Albaranes · Diario de Pedidos · Diario de Cierres de Caja · Diario de Ventas |

> No aplican: **Estado de Ticket BAI** (es del País Vasco/foral; nosotros **VERIFACTU + IGIC**). **Reservas** depende de tener módulo de reservas (fase posterior).

## B. Qué ya tenemos (`apps/web`, datos reales)

✅ Ventas diarias · Top 50 productos · Formas de pago · Resumen fiscal · Evolución de ventas · Rendimiento de usuarios · Diario de ventas · Diario de pedidos · Movimientos de caja · Cancelaciones por usuario · Familias y productos · Invitaciones (+ Visor VERIFACTU). Buen punto de partida — varios grupos ya cubiertos.

## C. Qué proponemos — set Gluuh priorizado

**No replicar los 60.** Empezar por lo que mueve el negocio de hostelería y consolidar.

### Fase 1 — Operación diaria (MVP, casi hecho)
- **Cierre Z consolidado** (ensamblar lo que ya hay: ventas, cancelaciones, propinas, cuadre de caja, invitaciones) → [locales.md §11](../administracion/locales.md).
- Ventas diarias · Top productos · Formas de pago · Resumen fiscal · Diario de ventas/facturas · Movimientos de caja · Cobros pendientes.
- **Ventas por centro de venta / ubicación / usuario** (segmentación básica).

### Fase 2 — Rentabilidad (el valor diferencial)
- **Márgenes por familia/categoría/producto** (food cost real, ligado a escandallo [06]).
- **★ Menú Engineering** — matriz **popularidad × margen** (Estrella / Vaca / Incógnita / Perro) para decidir qué potenciar, resituar o quitar de la carta. Es el informe más valioso para un restaurante; pocos TPV lo hacen bien.
- **Compras por proveedor · Precios de compra · Compras y ventas por producto · Valoración de mermas · Stock por producto** (control de coste, [06]).

### Fase 3 — Análisis y cumplimiento
- **Comparativa interanual · Evolución/tendencias · Análisis de ventas/compras/stocks** (con gráficos).
- **Periodos de servicio** (desayuno/comida/cena) reutilizando [periodos-servicio.md](../administracion/periodos-servicio.md).
- **Clientes**: ventas/facturas/impuestos por cliente + **Documento 347** (operaciones con un tercero > 3.005,06 €/año — obligación AEAT).
- **Cocina**: tiempos de preparación (desde el KDS, [05]).
- **Auditoría** y **Descuentos/Cancelaciones autorizados por usuario** (control de fraude) → [mantenimiento.md](../herramientas/mantenimiento.md).

## D. Cómo lo hacemos (arquitectura)

1. **Agregación en el servidor, no en el cliente.** Cada informe = **vista SQL / función RPC en Supabase** (Postgres), con **RLS por `tenant_id`** y parámetros (rango de fechas, centro, usuario, familia…). Nunca traer 50k filas al navegador (mejora sobre el tope de [administracion-web.md](../administracion/administracion-web.md)).
2. **Una página por informe** en `app/(panel)`, con **filtros comunes reutilizables** (DateRange, Centro, Usuario) y un layout estándar: **KPIs arriba · tabla · gráfico**.
3. **Componentes compartidos**: `ReportPage`, `DataTable`, `DateRangePicker`, `ExportButton` (PDF/Excel/CSV). Un informe nuevo = una query + un config de columnas, no una página desde cero.
4. **Export**: PDF (imprimible) y Excel/CSV server‑side.
5. **Coherencia fiscal**: Resumen Fiscal, Diario de Facturas y Documento 347 deben **cuadrar con VERIFACTU** (`@gluuh/core`) y con las series ([series.md](../administracion/series.md)); cifras siempre con impuesto desglosado correcto.
6. **Tiempo real donde aporte**: el dashboard del día puede ir en vivo (Supabase Realtime); los informes históricos, bajo demanda con caché.
7. **Rendimiento**: índices por `tenant_id, fecha`; para históricos grandes, **tablas/vistas materializadas** refrescadas en el cierre.

```sql
-- patrón: una función por informe
create function rpt_ventas_por_centro(p_desde date, p_hasta date)
returns table(centro text, tickets int, base numeric, impuestos numeric, total numeric)
language sql security definer as $$
  select c.nombre, count(*), sum(o.base), sum(o.impuestos), sum(o.total)
  from sales_order o join sales_center c on c.id = o.sales_center_id
  where o.tenant_id = current_tenant_id()           -- RLS
    and o.fecha between p_desde and p_hasta
  group by c.nombre order by total desc;
$$;
```

## Resumen de la decisión

- **Construir ~20 informes bien** (fases 1‑2) en vez de 60 a medias; el resto, bajo demanda.
- **Menú Engineering + márgenes** como diferenciador (rentabilidad real, no solo "cuánto vendí").
- **Arquitectura uniforme**: RPC en Supabase + página estándar + export, para añadir informes baratos.
- **Cumplimiento de serie**: fiscal cuadrado con VERIFACTU; 347 e impuestos por cliente para la AEAT.
- 🟡 base ya hecha (11 informes reales); falta ensamblar Cierre Z, rentabilidad y el framework de informe reutilizable.
