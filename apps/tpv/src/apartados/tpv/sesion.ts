import type { Rol } from "../../lib/nav";

// MOTOR DE SESIÓN DEL TERMINAL (Capa 1). Puro y sin React a propósito: es la ruta
// del dinero (quién abre y quién cobra queda en la factura y en los informes por
// camarero), así que la lógica se prueba sola, sin montar la pantalla.
//
// El modelo NO es login/logout. Un TPV de barra tiene veinte operarios por turno
// y no puede quedarse abierto con la sesión de nadie, pero tampoco pedir PIN en
// cada toque. Igual que Glop/Ágora:
//
//   dormido ──identificar(PIN)──▶ activo ──bloquear──▶ velado
//      ▲                            │                    │
//      └────────── salir ───────────┴── desbloquear(PIN)─┘
//
// «Cerrar sesión» = bajar el VELO (velado): tapa la pantalla pero CONSERVA la
// cuenta. Desbloquear con OTRO PIN cambia de camarero sin cerrar la mesa.

export interface Operario { id: string; nombre: string; rol: Rol }

export type EstadoTerminal =
  | { fase: "dormido" }                        // nadie identificado (arranque, o tras "Salir")
  | { fase: "activo"; operario: Operario }     // operando: sus acciones se le atribuyen
  | { fase: "velado"; operario: Operario };    // bloqueado; recuerda quién estaba para no perder el hilo

export type AccionSesion =
  | { tipo: "identificar"; operario: Operario }   // dormido → activo (el PIN dice quién eres)
  | { tipo: "bloquear" }                          // activo → velado (botón, inactividad o tras cobro)
  | { tipo: "desbloquear"; operario: Operario }   // velado → activo (el MISMO, o CAMBIO de camarero)
  | { tipo: "salir" };                            // cualquiera → dormido (fin de turno)

export const DORMIDO: EstadoTerminal = { fase: "dormido" };

export function reducirSesion(estado: EstadoTerminal, accion: AccionSesion): EstadoTerminal {
  switch (accion.tipo) {
    case "identificar":
      // Solo desde dormido: si ya hay alguien activo, identificarse no lo expulsa
      // sin pasar por el velo (así no se roba una sesión por accidente).
      return estado.fase === "dormido" ? { fase: "activo", operario: accion.operario } : estado;
    case "bloquear":
      // Velar SOLO recuerda quién estaba. No toca la cuenta: el reducer ni la
      // conoce, así que por construcción el velo no puede perder trabajo.
      return estado.fase === "activo" ? { fase: "velado", operario: estado.operario } : estado;
    case "desbloquear":
      // Desde el velo, el PIN que entra manda: el mismo sigue, otro toma el relevo.
      return estado.fase === "velado" ? { fase: "activo", operario: accion.operario } : estado;
    case "salir":
      return DORMIDO;
  }
}

/** El operario activo, o null si el terminal está dormido o velado. */
export function operarioActivo(estado: EstadoTerminal): Operario | null {
  return estado.fase === "activo" ? estado.operario : null;
}

// ── Atribución por línea ────────────────────────────────────────────────────
// Quién metió cada línea de la comanda. La invariante que protege esto: cambiar
// de camarero NO reescribe lo anterior. Si al pasar de María a Berto las líneas
// de María se volvieran de Berto, las ventas y las propinas por camarero
// mentirían — y ese informe se usa para pagar.
//
// ponytail: atribución por CLAVE de comanda (quién la creó), no por unidad. Si
// Berto suma una caña a una línea que abrió María, la línea sigue siendo de
// María. El detalle por unidad exige un modelo de líneas-evento que la comanda
// (Record<id,uds>) aún no tiene; se sube a eso si un bar lo pide.

export type Atribucion = Record<string, string>;   // clave de línea → operario.id

/**
 * Sella las líneas ACTUALES con el operario: las nuevas pasan a ser suyas, las
 * que ya tenían dueño se quedan como estaban, y las que ya no existen (línea
 * anulada) se olvidan para que el mapa no crezca sin fin.
 */
export function sellarAtribucion(
  previa: Atribucion,
  clavesActuales: readonly string[],
  operarioId: string,
): Atribucion {
  const sellada: Atribucion = {};
  for (const clave of clavesActuales) {
    sellada[clave] = previa[clave] ?? operarioId;
  }
  return sellada;
}
