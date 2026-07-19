import {
  Package, Layers, LayoutGrid, ListPlus, BookOpen, ArrowUpDown,
  Tags, Percent, BadgePercent,
  Map as Plano, Store,
  Wallet, Banknote, Landmark, Hash,
  Printer, Receipt, ChefHat,
  LayoutDashboard, SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

// ============================================================================
// MAPA de la Configuración del TPV — sale del inventario del panel Next
// (apps/web app/(panel), hecho el 19-07). Cada sección lista su ALCANCE (qué se
// decide ahí) y el comentario dice de qué página del panel se porta.
//
// Reparto del hub (no mezclar): empleados/perfiles/licencias → apartado
// ADMINISTRADOR; zona técnica (VERIFACTU, copias, clave) → VISOR NODE.
// Aquí vive lo que promete la tarjeta F2: carta, precios, salas y mesas,
// impresión, cobro e impuestos, más los ajustes de ESTE terminal.
// ============================================================================

export interface Seccion {
  id: string;
  titulo: string;
  /** Una línea bajo el título de la ficha. */
  desc: string;
  Icono: LucideIcon;
  /** Qué se configura aquí (la promesa de la sección, cara al dueño del bar). */
  alcance: string[];
}

export interface Grupo {
  titulo: string;
  secciones: Seccion[];
}

export const GRUPOS: Grupo[] = [
  {
    titulo: "Carta",
    secciones: [
      { // ← (panel)/productos + productos/[id] + tpv/config/articulos
        id: "productos", titulo: "Productos", Icono: Package,
        desc: "La ficha completa de cada artículo de la carta.",
        alcance: [
          "Nombre, texto del botón y foto",
          "Precio (impuesto incluido) y clase fiscal",
          "Familia y categorías donde aparece (puede estar en varias)",
          "Formatos (caña, copa, jarra…) y extras propios o de biblioteca",
          "Nombres para ticket y cocina, PLU y código de barras",
          "Alérgenos, estación de impresión y visibilidad",
        ],
      },
      { // ← (panel)/familias + grupos-mayores
        id: "familias", titulo: "Familias", Icono: Layers,
        desc: "Familias y grupos mayores: lo que heredan sus productos.",
        alcance: [
          "Nombre, color y grupo mayor de cada familia",
          "Estación de impresión (cocina, barra…) heredada",
          "Formatos, extras y notas que heredan sus productos",
          "Copas combinables por familia",
        ],
      },
      { // ← (panel)/categorias + categorias/[id]
        id: "categorias", titulo: "Categorías", Icono: LayoutGrid,
        desc: "La rejilla que ve el camarero en el TPV.",
        alcance: [
          "Qué categorías existen y qué productos contiene cada una",
          "Visibilidad por centro de venta (barra, terraza…)",
        ],
      },
      { // ← (panel)/modificadores
        id: "modificadores", titulo: "Extras y comentarios", Icono: ListPlus,
        desc: "Biblioteca de extras con precio y comentarios a cocina.",
        alcance: [
          "Grupos de extras con precio (doble ración, sin lactosa…)",
          "Comentarios a cocina (poco hecho, sin hielo…)",
          "Mínimos y máximos de selección por grupo",
          "A qué familias, categorías o productos se aplican",
        ],
      },
      { // ← (panel)/menus
        id: "menus", titulo: "Menús", Icono: BookOpen,
        desc: "Menú del día con precio cerrado.",
        alcance: [
          "Nombre, precio cerrado y clase fiscal del menú",
          "Grupos del menú (primero, segundo, postre…)",
          "Opciones de cada grupo, sacadas de la carta",
          "En qué categoría de la rejilla aparece",
        ],
      },
      { // ← (panel)/ordenar-familias-y-categorias + ordenar-productos
        id: "ordenar", titulo: "Ordenar la carta", Icono: ArrowUpDown,
        desc: "El orden en que se ve todo en la rejilla.",
        alcance: [
          "Orden de familias y categorías",
          "Orden de los productos dentro de cada categoría",
        ],
      },
    ],
  },
  {
    titulo: "Precios",
    secciones: [
      { // ← (panel)/tarifas (el TPV aún no las aplica al vender)
        id: "tarifas", titulo: "Tarifas", Icono: Tags,
        desc: "Varios precios para la misma carta.",
        alcance: [
          "Tarifas del local (barra, terraza, happy hour…)",
          "Precio por producto y tarifa; vacío = precio base",
        ],
      },
      { // ← (panel)/descuentos
        id: "descuentos", titulo: "Descuentos", Icono: Percent,
        desc: "Los descuentos que se pueden aplicar al cobrar.",
        alcance: [
          "Descuentos con nombre: porcentaje o importe",
          "Cuáles están activos en el TPV",
        ],
      },
      { // ← (panel)/promociones (el TPV aún no las aplica)
        id: "promociones", titulo: "Promociones", Icono: BadgePercent,
        desc: "Rebajas automáticas por fechas, horas o días.",
        alcance: [
          "Regla: porcentaje o importe, sobre toda la carta, una categoría o un producto",
          "Vigencia por fechas, franja horaria y días de la semana",
        ],
      },
    ],
  },
  {
    titulo: "Salas y mesas",
    secciones: [
      { // ← (panel)/planos-de-mesas (editor visual)
        id: "planos", titulo: "Planos de mesas", Icono: Plano,
        desc: "Las salas del local, mesa a mesa.",
        alcance: [
          "Salas y zonas del local",
          "Mesas: posición, tamaño, capacidad y nombre",
          "Decorado del plano (barra, puertas, plantas…)",
        ],
      },
      { // ← (panel)/centros-venta
        id: "centros-venta", titulo: "Centros de venta", Icono: Store,
        desc: "Zonas de venta con su propia carta y precios.",
        alcance: [
          "Zonas de venta: barra, sala, terraza…",
          "Qué carta se ve y qué tarifa se usa en cada una",
        ],
      },
    ],
  },
  {
    titulo: "Cobro",
    secciones: [
      { // ← (panel)/formas-pago (flags cajón/arqueo aún sin consumir en el TPV)
        id: "formas-pago", titulo: "Formas de pago", Icono: Wallet,
        desc: "Con qué se puede cobrar en este local.",
        alcance: [
          "Efectivo, tarjeta, Bizum, vales…",
          "Si abre el cajón al cobrar",
          "Si cuenta en el arqueo de caja",
        ],
      },
      { // ← (panel)/configuracion-de-caja (claves caja.* en setting)
        id: "caja", titulo: "Caja", Icono: Banknote,
        desc: "Cómo se abre, se arquea y se cuadra la caja.",
        alcance: [
          "Fondo inicial del cajón",
          "Arqueo ciego y umbral de descuadre",
          "Permitir vender con la caja cerrada, o no",
        ],
      },
      { // ← (panel)/impuestos (solo lectura; el territorio se cambia en el local)
        id: "impuestos", titulo: "Impuestos", Icono: Landmark,
        desc: "Los tipos que aplican en tu territorio.",
        alcance: [
          "Tipos por clase fiscal según territorio (IVA, IGIC o IPSI)",
          "Solo consulta: los tipos los fija la ley",
          "El territorio se cambia en los datos del local (Administrador)",
        ],
      },
      { // ← (panel)/series (la facturación aún lee location.serie_factura)
        id: "series", titulo: "Series", Icono: Hash,
        desc: "Series de numeración de tickets y facturas.",
        alcance: [
          "Series de ticket, factura, abono y presupuesto",
          "Prefijo, numeración y cuál es la predeterminada",
        ],
      },
    ],
  },
  {
    titulo: "Impresión",
    secciones: [
      { // ← (panel)/impresoras (tablas printer/print_route + probar)
        id: "impresoras", titulo: "Impresoras", Icono: Printer,
        desc: "Las impresoras del local y qué imprime cada una.",
        alcance: [
          "Impresoras: nombre, papel (tickets, cocina, barra…) e IP",
          "Enrutado: qué estación imprime dónde, por zona",
          "Probar impresión desde aquí",
        ],
      },
      { // ← (panel)/plantillas-ticket + configuracion-de-impresion (setting impresion.config)
        id: "ticket", titulo: "Diseño del ticket", Icono: Receipt,
        desc: "Lo que sale impreso en el ticket del cliente.",
        alcance: [
          "Cabecera, logo, líneas y pie del ticket",
          "QR de VERIFACTU y desglose de impuestos",
          "Vista previa al momento",
        ],
      },
      { // ← (panel)/plantillas-comandas + notas-preparacion + tipos-preparacion + motivos-cancelacion
        id: "comandas", titulo: "Comandas", Icono: ChefHat,
        desc: "Cómo llegan los pedidos a cocina.",
        alcance: [
          "Plantilla de la comanda de cocina",
          "Notas y tipos de preparación (poco hecho, para llevar…)",
          "Motivos de cancelación",
        ],
      },
    ],
  },
  {
    titulo: "Este terminal",
    secciones: [
      { // ← (panel)/configuracion-de-botones (setting tpv.botones)
        id: "botones", titulo: "Botones del TPV", Icono: LayoutDashboard,
        desc: "Cómo se ve la rejilla de venta en este local.",
        alcance: [
          "Columnas de la rejilla y tamaño del texto",
          "Mostrar foto y precio en los botones",
        ],
      },
      { // ← apps/web/app/tpv/config/ajustes (preferencias locales) — FUNCIONAL ya
        id: "preferencias", titulo: "Preferencias", Icono: SlidersHorizontal,
        desc: "Ajustes de este terminal; no afectan a los demás.",
        alcance: [],
      },
    ],
  },
];
