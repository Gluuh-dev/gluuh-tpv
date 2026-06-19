# Herramientas › Formación (modo entrenamiento)

> **Modo formación**: usuarios que practican en el TPV real **sin afectar a datos reales ni a fiscalidad** — sus ventas se borran al cerrar el punto de venta. Capturas: `Parámetros de Formación` y `Sesiones de Formación`.

---

## Ágora — qué muestra

**Parámetros de Formación:** seleccionar **usuarios** en periodo de formación. Aviso: *"Las ventas serán eliminadas al cerrar el punto de venta."*

**Sesiones de Formación:** filtro **Desde/Hasta · Grupos de TPVs** → tabla **TPV · Fecha Negocio · Fecha Apertura · Fecha Cierre · Total Cobros · Total Documentos** + **Borrar todas**.

> Un camarero nuevo aprende a manejar el TPV con la carta y flujos reales; al cerrar jornada, esas "ventas" desaparecen.

## Para nosotros (¡crítico fiscal!)

- Las ventas en formación **NO deben generar registro VERIFACTU** ni numeración legal ni movimiento de stock real. Marcar la sesión/usuario como `formacion=true` y **excluir del motor fiscal** (`@gluuh/core`) y de las series.
- Coincide con [usuarios-y-perfiles.md](../administracion/usuarios-y-perfiles.md) (flag por usuario) y con el cierre Z ([locales.md §11](../administracion/locales.md)).

```sql
alter table app_user add column en_formacion boolean default false;
-- order/payment con flag formacion=true → no VERIFACTU, no serie legal, no stock; se purgan al cierre
```

🔴 falta. **Importante**: separar limpiamente lo de formación de lo real para no contaminar la cadena fiscal.

## Mejoras sobre Ágora

- **Entorno sandbox** con datos de ejemplo (no la carta real) opcional, además del modo "en vivo".
- Tutoriales guiados integrados para onboarding del personal.
