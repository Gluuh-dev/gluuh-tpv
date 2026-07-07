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
    grupo: "Áreas sensibles (dentro de Administración)",
    permisos: [
      { id: "admin.usuarios", label: "Usuarios, perfiles y puntos de venta" },
      { id: "admin.catalogo", label: "Catálogo (familias, productos, precios)" },
      { id: "admin.fiscal", label: "Impuestos, series y VERI·FACTU" },
      { id: "tecnica", label: "Zona técnica (impresión, módulos, copias)" },
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
