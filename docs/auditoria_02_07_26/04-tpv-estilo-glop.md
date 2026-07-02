# 04 — TPV estilo Glop: qué copiar, qué ya tenemos, cómo superarlo

Análisis de las capturas de **Glop TPV** (pantalla de venta, diálogo de cobro y editor
de salón) contra nuestro TPV actual (`apps/web/app/tpv/page.tsx`). Glop es el benchmark
de "TPV Windows barato y sólido" (19,90 €/mes, 100% offline — ver
`docs/01-investigacion-mercado.md`); Ágora sigue siendo la referencia funcional completa
(`docs/18-mapa-agora-completo.md`). Este doc se centra en la **pantalla de venta**, que
es donde el usuario compara.

## 4.1 Anatomía de la pantalla de venta de Glop (captura 1)

```
┌───────────┬──────────────┬──────────────────────────────┬────┐
│ Cabecera  │              │  Fila de CATEGORÍAS con foto │ T  │
│ ticket:   │   Columna    ├──────────────────────────────┤ a  │
│ cliente,  │   funciones: │                              │ b  │
│ alias,    │   Aparcar    │  GRID DE PRODUCTOS           │ s  │
│ mesa,     │   Pasar mesa │  con imagen de marca         │ :  │
│ comensales│   Cons.propio│  (Coca-Cola, Fanta…)         │ zona│
├───────────┤   Borrar cta │                              │ s  │
│ LÍNEAS    │   Dividir    │                              │    │
│ del ticket│   Camarero   │                              │Barra│
│ Uds/Imp/  │   Último doc.│                              │Salón│
│ Total     │              │                              │Terr.│
├───────────┤──────────────┤                              │Llev.│
│ TOTAL 7,00€              │                              │Hotel│
├──────────────────────────┤                              │    │
│ TECLADO: 123 Und. Precio │                              │    │
│ 456 Utilidades  [COBRAR] │                              │    │
│ 789 Abrir cajón (naranja)│                              │    │
├──────────────────────────┴──────────────────────────────┴────┤
│ BARRA ESTADO: caja · fecha · turno · empleado · terminal ·    │
│               tarifa activa · salón                           │
└───────────────────────────────────────────────────────────────┘
```

Diálogo de cobro (captura 2): cliente/empleado/terminal, tipo de documento
(ticket/factura), importe entregado grande, hasta 3 formas de pago simultáneas,
descuento, CONTADO/TARJETA/CHEQUE, zonas de impresión, "A devolver" en grande, y botones
**Imprimir cuenta (F10) / Cobrar Imprimir (F11) / Cobrar (F12) / Enviar por email**.

Editor de salón (captura 3): lista lateral de tipos de mesa para arrastrar, pestaña de
objetos (plantas, sombrillas, vallas), mesas con sillas dibujadas.

## 4.2 Mapeo función a función

✅ ya lo tenemos · 🟡 parcial · ❌ falta

| Función Glop | Gluuh hoy | Nota / acción |
|---|---|---|
| Zonas como pestañas (Barra/Salón/Terraza/Llevar/Hotel) | ✅ | Salas (`room`) + Barra + Para llevar en menú lateral del TPV |
| Grid de categorías y productos | 🟡 | Existe a color; **faltan imágenes por producto** (columna `product.imagen` + subida en carta; los refrescos con su marca venden solos) |
| Líneas con Uds/Imp/Total, anular línea | ✅ | |
| Und. / Precio / DTO | ✅ | `PREC`, `DTO%`, `DTO€` ya en el teclado |
| **Aparcar ticket** | ❌ | Estado `APARCADA` en `sales_order` + lista de aparcados para recuperar. Imprescindible en barra |
| **Pasar a mesa** | ❌ | Mover cuenta abierta a otra mesa (update de `mesa_id` + liberar/ocupar). Trivial y muy pedido |
| **Asignar cliente / alias / comensales al ticket** | 🟡 | "Para llevar" ya pide nombre+teléfono; generalizar a cualquier ticket (columnas ya previstas en `sales_order`/`customer`) |
| Invitación / Cons. propio | 🟡 | El core tiene `tipo_operacion` INVITACION/AUTOCONSUMO (con su tratamiento legal, docs/14) y hay informe de invitaciones; falta exponerlo como botón en el TPV |
| Cambio de camarero en ticket | 🟡 | Hay operario por PIN; falta reasignar un ticket a otro camarero |
| **Dividir pagos** | 🟡 | Pago mixto (varias formas) ✅; falta **dividir la cuenta** por líneas o por comensales (dos tickets) |
| Último documento | ❌ | Botón que reabre/reimprime el último ticket. Pequeño |
| **Utilidades** | ❌ | Menú táctil: abrir cajón, último doc, módulos (doc 03), reimprimir, arqueo rápido |
| **Abrir cajón** | ❌ | Requiere la app de escritorio (doc 02) |
| Cobro: entregado + cambio | ✅ | Con botones rápidos 5/10/20/50 |
| Cobro: varias formas + descuento + propina | ✅ | |
| Cobro: **tipo de documento** (ticket/factura nominativa) | ❌ | Factura completa con NIF del cliente (tipos F1/F2 ya en el core) |
| Cobro: **atajos F10/F11/F12** | ❌ | Imprimir cuenta (proforma) / cobrar+imprimir / cobrar. En web y en Electron |
| Cobro: **imprimir cuenta (proforma)** | ❌ | Cuenta sin cerrar para llevar a la mesa. Pequeño |
| Cobro: enviar ticket por email | ❌ | Fase posterior (Resend/SES); el QR VERIFACTU ya da acceso digital |
| Zonas de impresión | ❌ | Llega con impresoras reales (doc 02) y enrutado cocina/barra |
| **Barra de estado inferior** | ❌ | Caja abierta · turno · empleado · terminal · **tarifa activa** · salón · online/offline. Barata y da muchísima sensación de "TPV serio" |
| **Tarifa activa** (precio por tarifa/horario) | ❌ | `tarifa` es stub sin precios. Necesita `product_price` por tarifa + programación horaria (ya identificado en docs/auditoria) |
| Turnos | 🟡 | `shift` existe en BD; sin UI |
| Editor de salón | ✅✅ | El nuestro (`planos-de-mesas`) es **mejor**: suelos por zona, rotación, clonado, atajos, vista móvil, branding de colores |

## 4.3 Qué NO copiar de Glop

- **Su estética 2010** (verde flúo, bordes duros, densidad caótica). Mantenemos la
  dirección ya decidida: operativa colorida y táctil con la marca del cliente
  (`tenant_branding` ya funciona), backoffice estilo Supabase (`GUIA_DISENO_COMPLETA.md`).
- **Su modelo de licencias por puesto y módulos instalables**: nuestra respuesta son los
  módulos cloud activables con emparejado por código (doc 03).
- **Su diálogo de cobro sobrecargado**: mantener nuestro cobro en dos gestos (efectivo
  rápido / pagos avanzados), añadiendo solo tipo de documento, proforma y atajos F.

## 4.4 Dónde somos mejores (y hay que rematarlo)

| Ventaja Gluuh | Estado | Para que sea argumento de venta… |
|---|---|---|
| **VERIFACTU nativo** validado contra el vector AEAT | motor ✅, TPV desconectado | activar el flag y persistir facturas (P0, doc 05). Glop lo vende como añadido; nosotros nacemos con ello |
| Cloud multi-tenant, backoffice desde cualquier sitio | ✅ | — |
| Tiempo real: KDS, pantalla recogida, cartelería, kiosko | ✅ | empaquetarlo como módulos (doc 03) |
| Comandera móvil incluida | ✅ | — (Glop la cobra aparte) |
| Branding del cliente en kiosko/pantallas | ✅ | — |
| Editor de planos superior | ✅ | borrar el editor viejo |
| Actualizaciones automáticas, sin instalar versiones | ✅ (web) + doc 02 | — |
| IGIC canario resuelto de serie | ✅ | — (ningún competidor lo mima) |
| **Offline** | ❌ | aquí Glop nos gana **hoy**. PowerSync es la pieza que iguala su mejor argumento (docs 02/05) |

## 4.5 Cambios de UI concretos en nuestro TPV (resumen ejecutable)

1. **Barra de estado inferior** fija: empleado · terminal · caja/turno · tarifa · sala · estado de red.
2. **Columna de funciones** entre ticket y grid: Aparcar, Pasar a mesa, Cliente,
   Invitación, Cons. propio, Dividir, Último doc., Utilidades. (Hoy esas acciones o no
   existen o están dispersas.)
3. **Imágenes en botones de producto** (con fallback al color actual de la familia).
4. **Cobro**: tipo de documento, imprimir cuenta, F10/F11/F12.
5. Antes de nada: **trocear `tpv/page.tsx`** (1.298 líneas) en componentes
   (`Ticket`, `GridProductos`, `Plano`, `ModalCobro`, `Teclado`…) — cada fila de la
   tabla 4.2 lo engordaría más; se refactoriza primero (P0, doc 05).
