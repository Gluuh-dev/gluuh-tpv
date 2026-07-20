// Estado del NODO (el servidor del bar) para el Visor. Lo sirve el gateway en
// `/nodo/estado` (apps/nodo/estado.mjs): servicios vivos, dispositivos, lo de hoy
// y las copias. Es detallado, así que el nodo solo lo da si la petición es LOCAL
// o trae token de la instalación; si responde 401/no hay nodo, el Visor enseña la
// demo MARCADA como ejemplo (nada de datos fingidos como reales).

export interface Servicio { clave: string; nombre: string; puerto: number; up: boolean }
export interface Dispositivo {
  nombre: string; tipo: string; estacion?: string | null; version?: string | null;
  ultimaConexion: string | null; conectado: boolean;
}
export interface EstadoNodo {
  servicios: Servicio[];
  contenido?: { productos: number; categorias: number; mesas: number; usuarios: number; pedidos: number; pedidosAbiertos: number };
  hoy?: { pedidos: number; mesasAbiertas: number; mesasLibres: number; caja?: number };
  dispositivos?: Dispositivo[];
  copias?: { hay: number; ultima: string | null; ocupa: number; carpeta?: string };
}

// MISMO ORIGEN que el resto (ver `lib/nodo`): en dev el proxy de Vite reenvía
// `/nodo` al gateway. Antes esto apuntaba al :54321 absoluto y el navegador lo
// bloqueaba por CORS — el Visor no podía leer el estado del nodo nunca.
import { BASE } from "../../lib/nodo";

/** Estado real del nodo, o null si no hay nodo / no autoriza (→ demo). */
export async function cargarEstadoNodo(): Promise<EstadoNodo | null> {
  try {
    const r = await fetch(`${BASE}/nodo/estado`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const d = (await r.json()) as EstadoNodo;
    return Array.isArray(d.servicios) ? d : null;
  } catch {
    return null;
  }
}

// Los siete servicios del nodo, con los puertos de verdad (docs/estado/AHORA.md).
export const ESTADO_DEMO: EstadoNodo = {
  servicios: [
    { clave: "datos", nombre: "Datos", puerto: 55433, up: true },
    { clave: "auth", nombre: "Usuarios", puerto: 55434, up: true },
    { clave: "realtime", nombre: "Avisos en vivo", puerto: 55435, up: true },
    { clave: "imagenes", nombre: "Imágenes de la carta", puerto: 55436, up: true },
    { clave: "web", nombre: "Panel y TPV", puerto: 3100, up: true },
    { clave: "gateway", nombre: "Puerta de la barra", puerto: 54321, up: true },
  ],
  contenido: { productos: 128, categorias: 14, mesas: 24, usuarios: 4, pedidos: 3182, pedidosAbiertos: 12 },
  hoy: { pedidos: 63, mesasAbiertas: 12, mesasLibres: 12, caja: 1486.3 },
  dispositivos: [
    { nombre: "TERMINAL 01", tipo: "TPV", estacion: "Barra", version: "v3.2.0", ultimaConexion: new Date().toISOString(), conectado: true },
    { nombre: "TERMINAL 02", tipo: "TPV", estacion: "Salón", version: "v3.2.0", ultimaConexion: new Date().toISOString(), conectado: true },
    { nombre: "Comandera Ana", tipo: "COMANDERA", estacion: "Terraza", version: "v3.1.8", ultimaConexion: new Date().toISOString(), conectado: true },
    { nombre: "Cocina KDS", tipo: "COCINA", estacion: "Cocina", version: "v3.2.0", ultimaConexion: null, conectado: false },
  ],
  copias: { hay: 14, ultima: new Date(Date.now() - 7 * 3600_000).toISOString(), ocupa: 486_000_000, carpeta: "C:\\Gluuh\\copias" },
};
