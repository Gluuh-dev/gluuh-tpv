"use client";

import { useEffect, useState } from "react";
import { PLANO_VER } from "@/app/lib/plano-assets";

// Inserta un SVG de /public/plano EN LÍNEA (no <img>) para que herede las
// variables CSS --mesa-fill / --silla-fill y se pueda recolorear. Cachea el
// texto por archivo (con versión, para no servir SVG antiguos). El <svg> interno
// se fuerza a ocupar el 100% del contenedor.
const cache = new Map<string, string>();

export function PlanoSvg({ file, className, style }: { file: string; className?: string; style?: React.CSSProperties }) {
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
