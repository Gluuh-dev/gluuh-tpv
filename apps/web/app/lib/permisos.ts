// Catálogo de permisos de perfil, estilo Ágora: permiso = (Aplicación, acción).
// El CATÁLOGO es igual para todos los clientes → vive en código (no en BD).
// El conjunto CONCEDIDO vive en `perfil.permisos` (plantilla, editable en /perfiles)
// y el EFECTIVO en `app_user.permisos` (se copia del perfil al asignarlo; lo leen
// el TPV y el panel). Semántica heredada de 0041: ausente o true = PERMITIDO;
// `false` explícito = BLOQUEADO (por eso un empleado nuevo, con {}, puede todo).
//
// Empezamos por los permisos que YA se aplican de verdad:
//  · "Punto de venta": los 5 flags que el TPV respeta (0041).
//  · "Acceso al panel": una entrada por zona del menú (lib/nav id) — el layout
//    oculta la zona si su permiso es false. Se añaden más grupos conforme se cablean.

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
    grupo: "Acceso al panel",
    permisos: [
      { id: "panel.operativa", label: "Operativa (TPV, pantallas, caja)" },
      { id: "panel.admin", label: "Administración (empresa, catálogo, usuarios…)" },
      { id: "panel.compras", label: "Compras y stocks" },
      { id: "panel.herramientas", label: "Herramientas y zona técnica" },
      { id: "panel.informes", label: "Informes" },
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
