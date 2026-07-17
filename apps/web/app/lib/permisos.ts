// Catálogo de permisos de perfil, estilo Ágora: permiso = (Aplicación, acción).
// El CATÁLOGO es igual para todos los clientes → vive en código (no en BD).
// El conjunto CONCEDIDO vive en `perfil.permisos` (se edita en /perfiles) y el
// usuario lo hereda EN VIVO por `app_user.perfil_id`. Semántica heredada de 0041:
// ausente o true = PERMITIDO; `false` explícito = BLOQUEADO.
//
// Enforcement (apps/web/app/(panel)/layout.tsx):
//  · "Punto de venta": los 5 flags que el TPV respeta con `puede(k)` (0041).
//  · "Zonas del panel" (`panel.<id>` = id de entrada de menú, lib/nav): oculta la
//    zona del menú Y **bloquea el acceso directo** por URL a sus páginas.
//  · "Áreas sensibles": permisos más finos que marcan páginas concretas (campo
//    `perm` en lib/nav); bloquean solo esas páginas dentro de su zona.

export interface PermisoDef { id: string; label: string }
export interface GrupoPermisos { grupo: string; permisos: PermisoDef[] }

export const CATALOGO_PERMISOS: GrupoPermisos[] = [
  {
    grupo: "Punto de venta",
    permisos: [
      { id: "modificar", label: "Modificar la cuenta (cantidades, precio, notas)" },
      { id: "descuento", label: "Aplicar descuentos" },
      { id: "borrar", label: "Borrar / anular líneas o cuenta" },
      { id: "invitar", label: "Invitaciones y consumo propio" },
      { id: "cobrar", label: "Cobrar" },
      { id: "aparcar", label: "Aparcar y recuperar cuentas" },
      { id: "agotado", label: "Marcar productos agotados («86»)" },
      { id: "crear_producto", label: "Crear productos desde el TPV" },
      { id: "abrir_cajon", label: "Abrir el cajón" },
    ],
  },
  {
    grupo: "Zonas del panel",
    permisos: [
      { id: "panel.operativa", label: "Operativa (TPV, pantallas, caja)" },
      { id: "panel.admin", label: "Administración (empresa, catálogo, usuarios…)" },
      { id: "panel.compras", label: "Compras y stocks" },
      { id: "panel.herramientas", label: "Herramientas y zona técnica" },
      { id: "panel.informes", label: "Informes" },
    ],
  },
  {
    grupo: "Administración",
    permisos: [
      { id: "admin.usuarios", label: "Usuarios, perfiles y puntos de venta" },
      { id: "admin.catalogo", label: "Catálogo (familias, productos, precios)" },
      { id: "admin.fiscal", label: "Impuestos, series y VERI·FACTU" },
    ],
  },
  {
    grupo: "Compras y stock",
    permisos: [
      { id: "compras.stock", label: "Control de stock (inventario, movimientos, cierres)" },
    ],
  },
  {
    grupo: "Herramientas",
    permisos: [
      { id: "tecnica", label: "Zona técnica (impresión, módulos, copias)" },
      { id: "herramientas.precios", label: "Herramientas de precios (importar/exportar, márgenes)" },
      { id: "cartas", label: "Cartas digitales (marca, traducciones, QR)" },
    ],
  },
];

/** Mapa de permisos concedidos (id → permitido). Ausente/true = permitido. */
export type MapaPermisos = Record<string, boolean>;

/** Todos los ids del catálogo (para resúmenes y validación). */
export const IDS_PERMISOS: string[] = CATALOGO_PERMISOS.flatMap((g) => g.permisos.map((p) => p.id));

/** ¿El permiso `id` está permitido? Ausente/true = sí; `false` explícito = no. */
export function permite(permisos: MapaPermisos | null | undefined, id: string): boolean {
  return permisos?.[id] !== false;
}

/** Clave de permiso para la zona (entrada de menú) `navId`. */
export const permisoZona = (navId: string) => `panel.${navId}`;

/** Perfiles recomendados listos para clonar/ajustar (mejor que empezar de cero).
 *  Se siembran al crear la empresa y con el botón de /perfiles.
 *
 *  MATERIALIZADOS (F1, 0112/0113): desde el switch fail-closed del servidor,
 *  una clave AUSENTE es DENEGADA en `operario_permite()`. Por eso cada perfil
 *  declara TODAS las claves del catálogo en explícito — `{}` ya no significa
 *  «todo permitido» y no debe volver a sembrarse así. */
export interface PerfilRecomendado { nombre: string; descripcion: string; permisos: MapaPermisos }
const TODO_PERMITIDO: MapaPermisos = Object.fromEntries(IDS_PERMISOS.map((id) => [id, true]));
const salvo = (deniega: string[]): MapaPermisos => ({ ...TODO_PERMITIDO, ...Object.fromEntries(deniega.map((d) => [d, false])) });
export const PERFILES_RECOMENDADOS: PerfilRecomendado[] = [
  { nombre: "Administrador", descripcion: "Acceso total al panel y al TPV.", permisos: { ...TODO_PERMITIDO } },
  { nombre: "Encargado", descripcion: "Todo menos la zona técnica del instalador.", permisos: salvo(["tecnica"]) },
  { nombre: "Camarero", descripcion: "Solo operativa (TPV); sin backoffice.", permisos: salvo(["panel.admin", "panel.compras", "panel.herramientas", "panel.informes"]) },
  { nombre: "Informes", descripcion: "Solo la sección de Informes.", permisos: salvo(["panel.operativa", "panel.admin", "panel.compras", "panel.herramientas"]) },
];
