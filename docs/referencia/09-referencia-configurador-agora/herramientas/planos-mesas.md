# Herramientas › Planos de Mesas (editor gráfico de sala) ★★

> **Diseñador visual del plano de sala**: un lienzo con rejilla donde se colocan **mesas, elementos y decoración**, se elige el **suelo/fondo**, y cada mesa se enlaza a una **ubicación** numerada. Es la pieza que el usuario marca como **clave para replicar igual o mejor**. Base de [02 — Interfaz §plano de mesas](../../02-interfaz-tactil/) y [07 — Configuración §salas](../../07-configuracion-y-administracion/).

Capturas: `Planos de Mesas` (listado), `Editar Plano de Mesa` (vacío y con mesas), diálogos `Seleccionar Suelo`, `Seleccionar Elemento`, `Seleccionar Ubicación`.

---

## A. Listado de Planos

**Id · Nombre · Prioridad**: `PLANO`, `RESERVADO`, `AUXILIAR` (3 registros). **Un plano por zona** → coincide con los [Centros de Venta](../administracion/centros-de-venta.md) (General/Reservado/Auxiliar). CRUD + Copiar.

## B. Editor — Plano de Mesa

**Cabecera:** **Nombre** · **Tamaño** (ancho × alto en px, p. ej. `860 × 592`, `750 × 500`) · **Prioridad** · **Al Redimensionar** (`Reducir` / …). Botones **🖌 Fondo** y **➕ Añadir**.

**Lienzo:** rejilla (grid) sobre la que se **arrastran y colocan** los elementos. El ejemplo real tiene:
```
┌───────────────────────────────────────────────┐
│      101 102 103 104 105 106 107 108     ◯201  │   ← taburetes de barra (101-108)
│  ◻1 ◻8  ▭▭▭▭▭▭▭ BARRA ▭▭▭▭▭▭▭          ◯202  │
│         ◻9   ◻14   ◻15 ◻20             ◯203  │   ← mesas cuadradas (1-20)
│  ◻2 ◻7  ◻10  ◻13   ◻16 ◻19             ◯204  │
│  ◻3 ◻6  ◻11  ◻12   ◻17 ◻18             ◯205  │   ← mesas redondas (201-205)
│  ◻4 ◻5                                          │
└───────────────────────────────────────────────┘
```
Cada mesa muestra su **número de ubicación** y sus **sillas**; la barra es un elemento rectangular.

### B.1 Seleccionar Suelo (Fondo)
Paleta de **~30 tipos de suelo** (colores lisos + texturas: madera, baldosa, mármol…). Se pulsa el deseado y pinta el fondo del lienzo.

### B.2 Seleccionar Elemento (➕ Añadir)
Catálogo gráfico de elementos para el plano:
- **Mesas**: redondas, cuadradas y rectangulares con **2/4/6/8 sillas**; mesa sin sillas (hueco).
- **Decoración/plantas**: macetas, plantas variadas.
- **Mobiliario**: estantería/vitrina, barra, **mesa de billar**, **acuario**, **futbolín**.
- **Aberturas**: puertas (varias), tramos de **pared** (ladrillo, madera, mármol, piedra — varias texturas y colores).
- **Otros**: lámparas/focos, alfombras, adornos.

### B.3 Seleccionar Ubicación
Al colocar una mesa se le **asigna una ubicación** (número de mesa):
- Selector de **Centro de Venta** (`SABORES DE LA PALMA/General`).
- Rejilla de **ubicaciones disponibles** (1‑20, 101‑108, 201‑205, 906‑910…).
- **Nueva ubicación**: campo + Añadir para crear una mesa nueva al vuelo.

> Es decir: el elemento gráfico (mesa) ↔ la **entidad ubicación/mesa** ([centros-de-venta.md §3](../administracion/centros-de-venta.md)). En operativa, el camarero ve este mismo plano con el **estado** de cada mesa (libre/ocupada/por cobrar) y toca para abrir comanda.

---

## Mapeo a nuestro modelo

```sql
create table floor_plan (                 -- "Plano de Mesa" (por zona/centro)
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  sales_center_id uuid references sales_center(id),
  nombre text not null, prioridad int default 0,
  ancho int, alto int,                    -- tamaño del lienzo (px o unidades grid)
  al_redimensionar text default 'REDUCIR',
  fondo text                              -- tipo de suelo
);
create table floor_plan_element (
  id uuid primary key default gen_random_uuid(),
  floor_plan_id uuid references floor_plan(id),
  tipo text not null,                     -- MESA_REDONDA_4 | MESA_CUADRADA | BARRA | PARED | PLANTA | PUERTA ...
  x int, y int, ancho int, alto int, rotacion int default 0,
  z int default 0,
  location_table_id uuid                  -- enlace a la mesa/ubicación (solo si es mesa)
);
```

## Cómo lo hacemos **igual o mejor** (propuesta)

> El usuario quiere replicarlo o superarlo. Recomendación técnica para Gluuh (`apps/web`, React):

- **Lienzo SVG/Canvas con drag‑and‑drop** (p. ej. `dnd-kit` o `react-konva`): arrastrar, redimensionar, rotar y snap a rejilla. Guardado de `{x,y,w,h,rot}` por elemento.
- **Catálogo de elementos como SVG** (mesas/sillas/paredes/decoración) — vectoriales, escalan sin pixelar y se tintan con la marca del local (ver dirección de diseño Supabase/Notion + colores de cliente).
- **Mesa = componente enlazado a `location_table`**: el plano de configuración y el **plano operativo** (TPV/comandera) son **el mismo componente**; en operativa pinta el **estado en tiempo real** (libre/ocupada/por cobrar/cuenta pedida) vía Supabase Realtime/PowerSync ([05](../../05-cocina-kds-y-comanderas/)).
- **Multi‑zona** (un plano por centro) con pestañas; **unir/separar mesas** y **mover comanda** entre mesas con arrastrar‑soltar.
- **Responsive/táctil**: el mismo plano se ve bien en TPV de mostrador y en tablet de comandera; zoom y paneo con gestos ([02](../../02-interfaz-tactil/)).
- **Mejoras sobre Ágora**: capacidad/comensales por mesa, código QR por mesa (pedido en mesa/Scan&Pay), heatmap de ocupación/rotación para informes, y plantillas de sala predefinidas.

> Resumen: **un editor DnD sobre SVG + un modelo `floor_plan`/`floor_plan_element` + mesas enlazadas a `location_table`**, y el mismo render reutilizado en operativa con estados en tiempo real. Esa es la vía para igualar a Ágora y superarlo. 🔴 falta (la operativa pinta salas, sin editor gráfico).
