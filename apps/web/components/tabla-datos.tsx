"use client";

// Tabla de listado reutilizable del panel (familias, categorías, productos,
// grupos mayores, series…). Diseño profesional:
// - ocupa SIEMPRE el 100% del alto de su columna flex (aunque haya 3 filas);
// - scroll interno con cabecera fija; cabecera y footer en color distinto;
// - filas cebra (una sí, otra no) + hover + selección;
// - ordenación por cabecera: el chevron se oculta hasta hover/focus y muestra
//   el sentido; si la columna ya ordena, queda resaltado (blanco) siempre;
// - columna # y checks con barra inferior de exportar (CSV) e imprimir;
// - acciones (editar/eliminar) junto a la primera celda; <IrA/> para referencias.
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Download, ExternalLink, Pencil, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ColumnaDatos<T> {
  clave: string;
  titulo: string;
  alinear?: "centro" | "der";
  /** Valor plano de la celda: se usa para ordenar y exportar. */
  valor: (fila: T) => string | number | boolean | null;
  /** Pintado de la celda; por defecto, el valor. */
  render?: (fila: T) => ReactNode;
}

/** Botón "ir a" para celdas que apuntan a otra entidad (familia, categoría…). */
export function IrA({ href, titulo }: Readonly<{ href: string; titulo: string }>) {
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Ir a ${titulo}`}
      title={`Ir a ${titulo}`}
      className="ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-card align-middle text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
    >
      <ExternalLink className="h-3 w-3" />
    </Link>
  );
}

const alinClase = (a?: "centro" | "der") => {
  if (a === "centro") return "text-center";
  if (a === "der") return "text-right";
  return "text-left";
};

export function TablaDatos<T>({
  columnas,
  filas,
  idDe,
  onAbrir,
  onEliminar,
  exportarNombre,
  cargando = false,
  vacio,
}: Readonly<{
  columnas: ColumnaDatos<T>[];
  filas: T[];
  idDe: (fila: T) => string;
  onAbrir?: (fila: T) => void;
  onEliminar?: (fila: T) => void;
  /** Nombre base del fichero exportado (sin extensión). */
  exportarNombre: string;
  cargando?: boolean;
  /** Texto cuando no hay filas (tras filtrar). */
  vacio?: string;
}>) {
  const [orden, setOrden] = useState<{ clave: string; dir: 1 | -1 } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const ordenadas = useMemo(() => {
    if (!orden) return filas;
    const col = columnas.find((c) => c.clave === orden.clave);
    if (!col) return filas;
    return [...filas].sort((a, b) => {
      const va = col.valor(a);
      const vb = col.valor(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * orden.dir;
      if (typeof va === "boolean" && typeof vb === "boolean") return (Number(va) - Number(vb)) * orden.dir;
      return String(va).localeCompare(String(vb), "es", { numeric: true, sensitivity: "base" }) * orden.dir;
    });
  }, [filas, orden, columnas]);

  function pulsarCabecera(clave: string) {
    setOrden((o) => {
      if (o?.clave !== clave) return { clave, dir: 1 };
      if (o.dir === 1) return { clave, dir: -1 };
      return null;
    });
  }

  const todasSel = ordenadas.length > 0 && ordenadas.every((f) => sel.has(idDe(f)));
  function toggleTodas() {
    setSel(todasSel ? new Set() : new Set(ordenadas.map(idDe)));
  }
  function toggleUna(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const aExportar = () => (sel.size ? ordenadas.filter((f) => sel.has(idDe(f))) : ordenadas);

  function exportarCsv() {
    const filasExp = aExportar();
    const esc = (v: string | number | boolean | null) => {
      const s = v == null ? "" : String(v);
      return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
    };
    // BOM + separador ; → abre bien en Excel es-ES.
    const csv = "﻿"
      + columnas.map((c) => esc(c.titulo)).join(";") + "\n"
      + filasExp.map((f) => columnas.map((c) => esc(c.valor(f))).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportarNombre}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function imprimir() {
    const filasExp = aExportar();
    const esc = (s: string | number | boolean | null) =>
      String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;");
    const html = `<!doctype html><title>${esc(exportarNombre)}</title>
<style>body{font:12px system-ui;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}th{background:#f2f2f2}</style>
<h3>${esc(exportarNombre)} · ${filasExp.length} registro${filasExp.length === 1 ? "" : "s"}</h3>
<table><thead><tr>${columnas.map((c) => `<th>${esc(c.titulo)}</th>`).join("")}</tr></thead>
<tbody>${filasExp.map((f) => `<tr>${columnas.map((c) => `<td>${esc(c.valor(f))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    const w = window.open("", "_blank", "width=1000,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  const thBase = "sticky top-0 z-10 border-b border-border bg-surface-muted px-3 py-2.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    // flex-1 + min-h-0: la tabla llena el alto de su columna flex (la página
    // debe ser `flex h-full flex-col`). Con pocas filas, el cuerpo se estira igual.
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className={`${thBase} w-9 text-center`}>
                <input
                  type="checkbox"
                  checked={todasSel}
                  onChange={toggleTodas}
                  aria-label="Seleccionar todo"
                  className="block h-4 w-4 accent-brand"
                />
              </th>
              <th className={`${thBase} w-10`}>#</th>
              {columnas.map((c) => {
                const activa = orden?.clave === c.clave;
                // Activa: chevron del sentido actual, resaltado y siempre visible.
                // Inactiva: chevron del sentido del PRÓXIMO clic (asc), oculto
                // hasta hover/focus.
                const Chevron = activa && orden!.dir === -1 ? ChevronDown : ChevronUp;
                return (
                  <th key={c.clave} className={`${thBase} ${alinClase(c.alinear)}`}>
                    <button
                      type="button"
                      onClick={() => pulsarCabecera(c.clave)}
                      className="group/sort inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:text-foreground"
                      title={`Ordenar por ${c.titulo}`}
                      aria-label={`Ordenar por ${c.titulo}`}
                    >
                      {c.titulo}
                      <Chevron
                        className={`h-3.5 w-3.5 transition-opacity ${
                          activa
                            ? "text-foreground opacity-100"
                            : "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60"
                        }`}
                        aria-hidden
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={columnas.length + 2} className="px-4 py-10 text-center text-muted-foreground">Cargando…</td></tr>
            )}
            {!cargando && ordenadas.length === 0 && (
              <tr><td colSpan={columnas.length + 2} className="px-4 py-10 text-center text-muted-foreground">{vacio ?? "Sin registros."}</td></tr>
            )}
            {!cargando && ordenadas.map((f, i) => {
              const id = idDe(f);
              const marcada = sel.has(id);
              // Cebra: base según paridad; selección y hover mandan por encima.
              let fondo = i % 2 === 0 ? "bg-surface" : "bg-surface-overlay";
              if (marcada) fondo = "bg-brand/10";
              return (
                <tr
                  key={id}
                  onClick={onAbrir ? () => onAbrir(f) : undefined}
                  className={`group ${fondo} ${onAbrir ? "cursor-pointer" : ""} hover:bg-surface-muted`}
                >
                  <td className="border-b border-border-muted px-2 py-2 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={() => toggleUna(id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Seleccionar fila"
                      className="mx-auto block h-4 w-4 accent-brand"
                    />
                  </td>
                  <td className="border-b border-border-muted px-2 py-2 align-middle tabular-nums text-muted-foreground">{i + 1}</td>
                  {columnas.map((c, ci) => (
                    <td key={c.clave} className={`border-b border-border-muted px-3 py-2 align-middle ${alinClase(c.alinear)}`}>
                      {ci === 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          {c.render ? c.render(f) : String(c.valor(f) ?? "—")}
                          {/* Acciones junto al nombre, visibles al pasar/seleccionar */}
                          {(onAbrir || onEliminar) && (
                            <span className={`inline-flex items-center gap-0.5 transition-opacity ${marcada ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                              {onAbrir && (
                                <Button variant="outline" size="icon" className="h-6 w-6" aria-label="Editar"
                                  onClick={(e) => { e.stopPropagation(); onAbrir(f); }}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                              {onEliminar && (
                                <Button variant="outline" size="icon" className="h-6 w-6 text-destructive" aria-label="Eliminar"
                                  onClick={(e) => { e.stopPropagation(); onEliminar(f); }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </span>
                          )}
                        </span>
                      ) : (
                        c.render ? c.render(f) : <span className={c.valor(f) == null ? "text-muted-foreground" : undefined}>{String(c.valor(f) ?? "—")}</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Barra inferior (color distinto): selección + exportar/imprimir. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-surface-muted px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {sel.size > 0 ? `${sel.size} seleccionada${sel.size === 1 ? "" : "s"} · ` : ""}
          {filas.length} registro{filas.length === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={imprimir} title="Imprimir listado">
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportarCsv} title={sel.size ? "Exportar las filas seleccionadas" : "Exportar todo el listado"}>
            <Download className="h-3.5 w-3.5" /> Exportar{sel.size ? ` (${sel.size})` : ""}
          </Button>
        </span>
      </div>
    </div>
  );
}
