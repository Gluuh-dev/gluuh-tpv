# Administración › Grupos de Periodos de Servicio

> Define **franjas horarias** (desayuno, comida, tarde, cena/noche) agrupadas. Se usan para **analizar ventas por periodo** ("Ventas Por Horas") y pueden dirigir cartas/precios por franja y la operativa (turnos de cocina). Es la pieza que da sentido a informes tipo *ventas por tramo horario*.

Capturas: `Grupos de Periodos de Servicio` (listado + editor).

---

## Ágora — qué muestra

**Listado** (Id · Nombre):

| Id | Nombre |
|----|--------|
| 1 | Periodo por Defecto |
| 2 | Ventas Por Horas |

**Editor de un grupo** — `Grupo:` (nombre) + filas **Periodo · Inicio · Fin** (botón `−` para quitar, `+ Añadir` para sumar):

| Periodo | Inicio | Fin |
|---------|--------|-----|
| 6:00  | 06:00 | 12:59 |
| 13:00 | 13:00 | 16:59 |
| 17:00 | 17:00 | 20:29 |
| 21:00 | 20:30 | 05:59 |

(El último tramo **cruza medianoche** 20:30→05:59: el modelo debe soportar franjas que pasan de día.)

---

## Qué necesitamos

- CRUD de **grupos de periodos**, cada uno con N franjas (etiqueta + inicio + fin).
- Soporte de **franja que cruza medianoche** (turno de noche).
- Alimenta los **informes por tramo horario** (ya tenemos evolución de ventas y diario de ventas; falta el corte por periodo) — ver [08 — Roadmap](../../08-roadmap-de-implementacion/) e informes en `app/(panel)`.

## Mapeo a nuestro modelo

```sql
create table service_period_group (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null
);
create table service_period (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references service_period_group(id),
  etiqueta text not null,     -- 'Comida', 'Cena'…
  inicio time not null,
  fin    time not null        -- si fin < inicio ⇒ cruza medianoche
);
```

- Resolver el periodo de una venta por su `created_at::time` (con la regla de cruce de medianoche). 🔴 falta.

## Mejoras sobre Ágora

- **Nombrar** cada franja (Ágora usa la hora como etiqueta); más legible en informes.
- Asociar a una franja: **carta/precios** activos (happy hour, menú mediodía) y **estación/turno** de cocina.
- Validación de **solapes** y huecos entre franjas al guardar.
