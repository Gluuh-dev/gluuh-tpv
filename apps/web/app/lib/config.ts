"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  DE DÓNDE SACA LA APP SU CONFIGURACIÓN
//
//  Las `NEXT_PUBLIC_*` se incrustan AL COMPILAR. Eso vale para la nube (una URL, una
//  clave, una build), pero no para los nodos: cada bar tiene su propia IP y su propio
//  secreto (y por tanto su propia clave). Habría que compilar una web por cliente.
//
//  Así que en el nodo la configuración llega EN TIEMPO DE EJECUCIÓN: el propio nodo sirve
//  la web y le inyecta sus datos en el HTML (ver `app/layout.tsx`). Una sola compilación
//  vale para todos los bares.
//
//  Y como la web la sirve el MISMO servidor que los datos, el TPV habla con su propio
//  origen: no hay ninguna IP que teclear en cada terminal. Antes había que poner cuatro
//  variables en un `.env.local` por máquina, y equivocarse en una —poner la clave de la
//  nube donde va la del nodo— dejaba a los camareros fuera sin decir por qué.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfigGluuh {
  /** ¿Estamos contra el servidor del local en vez de contra la nube? */
  nodo: boolean;
  /** Origen de los datos. Vacío en el nodo = el mismo origen desde el que se sirve la web. */
  url: string;
  /** La clave pública (publishable en la nube, anon en el nodo). */
  clave: string;
  /** La URL REAL de Supabase. En el nodo sigue haciendo falta: es la que se guarda en la
   *  base de datos al subir una foto (la canónica). Ver `urlFoto`. */
  urlNube: string;
}

declare global {
  interface Window {
    __GLUUH__?: ConfigGluuh;
  }
}

let _cache: ConfigGluuh | null = null;

export function config(): ConfigGluuh {
  if (_cache) return _cache;

  // El nodo lo inyecta en el HTML. Si está, manda.
  if (typeof window !== "undefined" && window.__GLUUH__) {
    _cache = {
      ...window.__GLUUH__,
      url: window.__GLUUH__.url || window.location.origin,
    };
    return _cache;
  }

  // La nube: lo de siempre, incrustado al compilar.
  _cache = {
    nodo: false,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    clave: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    urlNube: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  };
  return _cache;
}

/** ¿Estamos en el servidor del local? */
export const esNodo = (): boolean => config().nodo;
