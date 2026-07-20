import {
  UtensilsCrossed, Package, Layers, LayoutGrid, ListPlus, BookOpen, ArrowUpDown,
  Tags, Percent, BadgePercent,
  Map as Plano, Store, MapPin, Clock,
  Wallet, Banknote, Landmark, Hash,
  Printer, Receipt, ChefHat, Tag,
  MonitorSmartphone, Blocks,
  Palette,
  LayoutDashboard, SlidersHorizontal,
  type LucideIcon, Truck, Warehouse, ClipboardList, Contact
} from "lucide-react";

// ============================================================================
// MAPA COMPLETO de la Configuración del TPV — sale del inventario del panel
// Next (apps/web app/(panel), 19-07) más el análisis de huecos: personalizar
// (marca), módulos/terminales, puntos de venta, periodos de servicio,
// plantillas de etiqueta y los settings sueltos de /ajustes que son del TPV
// (tpv.funciones.orden, tpv.combinados.categoria_id, etiqueta_producto).
// Cada sección lista su ALCANCE (qué se decide ahí) y el comentario dice de
// qué página del panel se porta.
//
// Reparto del hub (no mezclar): empresa/local/territorio, seguridad (bloqueo
// TPV, MFA), clientes/tipos de cliente → apartado ADMINISTRADOR; zona técnica
// (VERIFACTU, copias, clave) → VISOR NODE; proveedores/almacenes/unidades →
// dominio Compras (aún "En preparación" también en Next); los informes no son
// configuración.
// ============================================================================

export interface Seccion {
  id: string;
  titulo: string;
  /** Una línea bajo el título de la ficha. */
  desc: string;
  Icono: LucideIcon;
  /** Qué se configura aquí (la promesa de la sección, cara al dueño del bar). */
  alcance: string[];
  /** Ya funciona en este terminal (si no: hoy se hace en el panel web). */
  funcional?: boolean;
}

export interface Grupo {
  titulo: string;
  Icono: LucideIcon;
  secciones: Seccion[];
}

export const GRUPOS: Grupo[] = [
  {
    titulo: "Carta",
    Icono: UtensilsCrossed,
    secciones: [
      { // ← (panel)/productos + productos/[id] + etiquetas + tpv/config/articulos
        id: "productos", titulo: "Productos", Icono: Package, funcional: true,
        desc: "La ficha completa de cada artículo de la carta.",
        alcance: [
          "Nombre, texto del botón y foto",
          "Precio (impuesto incluido) y clase fiscal",
          "Familia y categorías donde aparece (puede estar en varias)",
          "Formatos (caña, copa, jarra…) y extras propios o de biblioteca",
          "Nombres para ticket y cocina, PLU y código de barras",
          "Alérgenos, estación de impresión y visibilidad",
          "Etiquetas para organizar y filtrar",
        ],
      },
      { // ← (panel)/familias + grupos-mayores + setting tpv.combinados.categoria_id
        id: "familias", titulo: "Familias", Icono: Layers,
        desc: "Familias y grupos mayores: lo que heredan sus productos.",
        alcance: [
          "Nombre, color y grupo mayor de cada familia",
          "Estación de impresión (cocina, barra…) heredada",
          "Formatos, extras y notas que heredan sus productos",
          "Copas combinables y con qué se combinan (categoría de refrescos)",
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
    // COMPRAS: el otro lado del negocio. La carta dice lo que entra por caja;
    // esto, lo que sale — y es de donde sale el COSTE real de cada plato.
    titulo: "Compras",
    Icono: Truck,
    secciones: [
      {
        id: "compras", titulo: "Albaranes y facturas", Icono: Truck, funcional: true,
        desc: "Lo que compras a tus proveedores, y la mercancía que entra",
        alcance: [
          "Albaranes y facturas de proveedor, con sus líneas y sus impuestos",
          "Al RECIBIR un albarán entra la mercancía y se actualiza el stock",
          "El coste real de cada artículo, que es lo que da el margen de verdad",
          "Un albarán recibido no se edita: se corrige con otro documento",
        ],
      },
      {
        id: "proveedores", titulo: "Proveedores", Icono: Contact,
        desc: "A quién le compras",
        alcance: [
          "Datos fiscales del proveedor y forma de contacto",
          "Referencias del proveedor para cada artículo (qué código usa él)",
          "Precios de compra pactados",
        ],
      },
      {
        id: "almacenes", titulo: "Almacenes", Icono: Warehouse,
        desc: "Dónde está la mercancía",
        alcance: [
          "Almacenes del local (barra, bodega, cámara)",
          "Almacén por defecto al recibir mercancía",
          "Traspasos entre almacenes",
        ],
      },
      {
        id: "inventario", titulo: "Inventario y stock", Icono: ClipboardList,
        desc: "Lo que hay, lo que falta y lo que se ha ido",
        alcance: [
          "Existencias por artículo y avisos de stock mínimo",
          "Recuentos de inventario y ajustes con su motivo",
          "Mermas y consumo propio",
        ],
      },
    ],
  },
  {
    titulo: "Precios",
    Icono: Tags,
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
    titulo: "Salas y zonas",
    Icono: Plano,
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
      { // ← (panel)/puntos-venta (punto_venta; agrupa terminales/ventas)
        id: "puntos-venta", titulo: "Puntos de venta", Icono: MapPin,
        desc: "Agrupaciones de venta para terminales e informes.",
        alcance: [
          "Puntos de venta del local (caja, barra, terraza…)",
          "Nombre y descripción de cada uno",
        ],
      },
      { // ← (panel)/periodos-servicio (periodo_servicio)
        id: "periodos-servicio", titulo: "Periodos de servicio", Icono: Clock,
        desc: "Los turnos horarios del día.",
        alcance: [
          "Turnos del día: desayuno, comida, cena…",
          "Hora de inicio y fin de cada periodo",
        ],
      },
    ],
  },
  {
    titulo: "Cobro",
    Icono: Wallet,
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
    Icono: Printer,
    secciones: [
      { // ← (panel)/impresoras (tablas printer/print_route + probar)
        id: "impresoras", titulo: "Impresoras", Icono: Printer, funcional: true,
        desc: "Las impresoras del local y qué imprime cada una.",
        alcance: [
          "Impresoras: nombre, papel (tickets, cocina, barra, etiquetas) e IP",
          "Enrutado: qué estación imprime dónde, por zona",
          "Probar impresión desde aquí",
        ],
      },
      { // ← (panel)/plantillas-ticket + configuracion-de-impresion — al portar,
        //   las TRES páginas del panel (2 sobre setting impresion.config + 1 sobre
        //   tablas) se unifican AQUÍ
        id: "ticket", titulo: "Diseño del ticket", Icono: Receipt,
        desc: "Lo que sale impreso en el ticket del cliente.",
        alcance: [
          "Cabecera, logo, líneas y pie del ticket",
          "QR de VERIFACTU y desglose de impuestos",
          "Vista previa al momento",
        ],
      },
      { // ← (panel)/plantillas-comandas + notas-preparacion + tipos-preparacion
        //   + motivos-cancelacion
        id: "comandas", titulo: "Comandas", Icono: ChefHat,
        desc: "Cómo llegan los pedidos a cocina.",
        alcance: [
          "Plantilla de la comanda de cocina",
          "Notas y tipos de preparación (poco hecho, para llevar…)",
          "Motivos de cancelación",
        ],
      },
      { // ← (panel)/plantillas-etiquetas (plantilla_etiqueta + impresora ETIQUETAS)
        id: "etiquetas", titulo: "Etiquetas", Icono: Tag,
        desc: "Etiquetas de precio y código de barras.",
        alcance: [
          "Plantillas de etiqueta (precio, código de barras…)",
          "Qué impresora de etiquetas las imprime",
        ],
      },
    ],
  },
  {
    titulo: "Terminales y pantallas",
    Icono: MonitorSmartphone,
    secciones: [
      { // ← (panel)/modulos (emparejado por código) + tpv/config/terminales
        id: "terminales", titulo: "Terminales", Icono: MonitorSmartphone,
        desc: "Los TPV y comanderas conectados al nodo.",
        alcance: [
          "Emparejar un terminal nuevo con código de 6 dígitos",
          "Nombre y estación de cada terminal",
          "Estado de conexión y revocar acceso",
        ],
      },
      { // ← (panel)/modulos (tenant_module + config por módulo en lib/modulos.ts)
        id: "modulos", titulo: "Módulos y pantallas", Icono: Blocks,
        desc: "Qué pantallas usa el local y cómo se comportan.",
        alcance: [
          "Encender o apagar módulos: comandera, cocina (KDS), pantalla de recogida, kiosko, cartelería, visor y reservas",
          "Ajustes de cada pantalla: tema, avisos, sonido, textos y diseño",
        ],
      },
    ],
  },
  {
    titulo: "Marca",
    Icono: Palette,
    secciones: [
      { // ← (panel)/personalizar (tenant_branding + offer). El TPV consume
        //   --brand/--brand-lit (index.css): al construirse aquí, presets de color
        id: "marca", titulo: "Marca del local", Icono: Palette,
        desc: "Tu logo y tus colores, en todas las pantallas.",
        alcance: [
          "Logo del local y logo del ticket (blanco y negro)",
          "Colores de la marca: el TPV y las pantallas se recoloran enteros",
          "Ofertas para el kiosko y la cartelería",
        ],
      },
    ],
  },
  {
    titulo: "Este terminal",
    Icono: SlidersHorizontal,
    secciones: [
      { // ← (panel)/configuracion-de-botones (setting tpv.botones) + orden de
        //   funciones de /ajustes (setting tpv.funciones.orden)
        id: "botones", titulo: "Botones del TPV", Icono: LayoutDashboard,
        desc: "Cómo se ve la rejilla de venta en este local.",
        alcance: [
          "Columnas de la rejilla y tamaño del texto",
          "Mostrar foto y precio en los botones",
          "Orden de los botones de funciones (Aparcar, Dividir…)",
        ],
      },
      { // ← apps/web/app/tpv/config/ajustes (preferencias locales) — FUNCIONAL
        id: "preferencias", titulo: "Preferencias", Icono: SlidersHorizontal,
        desc: "Ajustes de este terminal; no afectan a los demás.",
        alcance: [],
        funcional: true,
      },
    ],
  },
];
