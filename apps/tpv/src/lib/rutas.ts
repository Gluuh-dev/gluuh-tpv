import { useEffect, useState } from "react";
import type { Vista } from "./nav";

// ============================================================================
// RUTAS DE LA SPA — `/config/productos` en vez de un estado escondido.
//
// Para qué sirve de verdad en un bar: poder decirle a alguien por teléfono
// «entra en /config/impresoras», dejar un acceso directo en el escritorio del
// terminal de cocina, y que el botón Atrás haga lo que todo el mundo espera.
//
// Router propio y diminuto en vez de una librería: son seis vistas y un
// segmento. `react-router` traería un modelo entero (loaders, outlets) para
// resolver un `split("/")`.
//
// ⚠ EL CONTROL DE ACCESO NO VIVE AQUÍ. La URL solo dice qué se PIDE; quién
// puede entrar lo sigue decidiendo App con la credencial. Escribir /admin a mano
// pide PIN igual — y recargar, también.
// ============================================================================

export interface Ruta {
  vista: Vista;
  /** Sección dentro del apartado (hoy solo Configuración: `productos`, `impresoras`…). */
  seccion?: string;
  /** El registro concreto: `/config/productos/<id>` abre esa ficha. */
  id?: string;
}

const VISTAS: readonly Vista[] = ["inicio", "tpv", "config", "analisis", "admin", "nodo"];

/** `/config/productos/<id>` → `{ vista: "config", seccion: "productos", id }`. */
export function rutaDeUrl(pathname: string): Ruta {
  const [primero, segundo, tercero] = pathname.split("/").filter(Boolean);
  // Una vista desconocida cae a inicio y no a una pantalla en blanco: un enlace
  // viejo o una errata dejan al camarero en un sitio del que sabe salir.
  if (!primero || !(VISTAS as readonly string[]).includes(primero)) return { vista: "inicio" };
  const vista = primero as Vista;
  if (!segundo) return { vista };
  return tercero ? { vista, seccion: segundo, id: tercero } : { vista, seccion: segundo };
}

/** `{ vista: "config", seccion: "productos", id }` → `/config/productos/<id>`. */
export function urlDeRuta(r: Ruta): string {
  if (r.vista === "inicio") return "/";
  // Un `id` sin `seccion` no significa nada, así que se ignora en vez de
  // fabricar un `/config//abc` que luego no se sabe leer.
  if (!r.seccion) return `/${r.vista}`;
  return r.id ? `/${r.vista}/${r.seccion}/${r.id}` : `/${r.vista}/${r.seccion}`;
}

/**
 * Cambia la URL sin recargar.
 *
 * `reemplazar` para los cambios que NO son un paso de navegación (elegir sección
 * dentro del mismo apartado al arrancar): si cada uno apilara historial, salir
 * del apartado pediría catorce veces Atrás.
 */
export function navegar(r: Ruta, reemplazar = false): void {
  const url = urlDeRuta(r);
  if (url === window.location.pathname) return;
  if (reemplazar) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
  // `popstate` NO se dispara al empujar tú mismo: sin este aviso, quien escucha
  // la ruta no se enteraría de los cambios que provoca la propia app.
  window.dispatchEvent(new Event("gluuh:ruta"));
}

/** La ruta de la barra de direcciones, al día (botones Atrás/Adelante incluidos). */
export function useRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(() => rutaDeUrl(window.location.pathname));
  useEffect(() => {
    const releer = () => setRuta(rutaDeUrl(window.location.pathname));
    window.addEventListener("popstate", releer);
    window.addEventListener("gluuh:ruta", releer);
    return () => {
      window.removeEventListener("popstate", releer);
      window.removeEventListener("gluuh:ruta", releer);
    };
  }, []);
  return ruta;
}
