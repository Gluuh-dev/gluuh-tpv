"use client";

import { memo, useEffect, useState } from "react";
import { PLANO_VER } from "@/app/lib/plano-assets";

// Inserta un SVG de /public/plano EN LÍNEA (no <img>) para que herede las
// variables CSS --mesa-fill / --silla-fill y se pueda recolorear. Cachea el
// texto por archivo (con versión, para no servir SVG antiguos). El <svg> interno
// se fuerza a ocupar el 100% del contenedor.
const cache = new Map<string, string>();

interface PlanoSvgProps {
  file: string;
  className?: string;
  style?: React.CSSProperties;
}

function PlanoSvgBase({ file, className, style }: PlanoSvgProps) {
  const url = `/plano/${file}?v=${PLANO_VER}`;
  const [html, setHtml] = useState(cache.get(url) ?? "");
  useEffect(() => {
    const c = cache.get(url);
    if (c !== undefined) { setHtml(c); return; }
    let alive = true;
    fetch(url)
      .then((r) => r.text())
      .then((t) => { cache.set(url, t); if (alive) setHtml(t); })
      .catch(() => {});
    return () => { alive = false; };
  }, [url]);
  return (
    <span
      className={`[&>svg]:h-full [&>svg]:w-full ${className ?? ""}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Compara el `style` por VALOR: el plano lo construye inline (`{ "--mesa-fill": … }`),
// así que su identidad cambia en cada render aunque los colores sean los mismos.
function mismasProps(a: Readonly<PlanoSvgProps>, b: Readonly<PlanoSvgProps>): boolean {
  if (a.file !== b.file || a.className !== b.className) return false;
  const sa = (a.style ?? {}) as Record<string, unknown>;
  const sb = (b.style ?? {}) as Record<string, unknown>;
  const ka = Object.keys(sa);
  if (ka.length !== Object.keys(sb).length) return false;
  return ka.every((k) => sa[k] === sb[k]);
}

/**
 * MEMOIZADO — y no es cosmético.
 *
 * `dangerouslySetInnerHTML={{ __html: html }}` crea un objeto NUEVO en cada render,
 * así que React reinyecta y **reparsea el SVG entero** aunque no haya cambiado nada.
 * Con 21 mesas en el plano eso son 21 reparseos por render.
 *
 * Y desde la 0097 el plano se refresca en cuanto CUALQUIER terminal toca una mesa
 * (el comandero abre una, otro TPV cobra…). Sin este memo, cada comanda del bar
 * provocaría un reparseo de todo el plano: jank constante en la pantalla de entrada
 * del TPV. Con él, solo se re-renderiza la mesa que de verdad cambió de color/estado.
 */
export const PlanoSvg = memo(PlanoSvgBase, mismasProps);
