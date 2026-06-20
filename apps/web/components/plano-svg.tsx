"use client";

import { useEffect, useState } from "react";

// Inserta un SVG de /public/plano EN LÍNEA (no <img>) para que herede las
// variables CSS --mesa-fill / --silla-fill y se pueda recolorear. Cachea el
// texto por archivo. El <svg> interno se fuerza a ocupar el 100% del contenedor.
const cache = new Map<string, string>();

export function PlanoSvg({ file, className, style }: { file: string; className?: string; style?: React.CSSProperties }) {
  const [html, setHtml] = useState(cache.get(file) ?? "");
  useEffect(() => {
    const c = cache.get(file);
    if (c !== undefined) { setHtml(c); return; }
    let alive = true;
    fetch(`/plano/${file}`)
      .then((r) => r.text())
      .then((t) => { cache.set(file, t); if (alive) setHtml(t); })
      .catch(() => {});
    return () => { alive = false; };
  }, [file]);
  return (
    <span
      className={`[&>svg]:h-full [&>svg]:w-full ${className ?? ""}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
