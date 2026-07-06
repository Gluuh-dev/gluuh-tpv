"use client";

// Tabla de listado estilo Ágora para el panel:
// - scroll horizontal y vertical DENTRO de la tabla, con cabecera fija;
// - ordenación pulsando la cabecera (asc → desc → sin orden);
// - columna # y checks de selección con barra inferior de EXPORTAR (CSV) e imprimir;
// - acciones (editar/eliminar) junto a la primera celda, al pasar el ratón o seleccionar;
// - helper <IrA/> para celdas que referencian otra entidad (botón de "ir").
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, ExternalLink, Pencil, Printer, Trash2 } from "lucide-react";
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

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 w-9 border-b border-border bg-surface px-2 py-2">
                <input
                  type="checkbox"
                  checked={todasSel}
                  onChange={toggleTodas}
                  aria-label="Seleccionar todo"
                  className="align-middle"
                />
              </th>
              <th className="sticky top-0 z-10 w-10 border-b border-border bg-surface px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">#</th>
              {columnas.map((c) => {
                const activa = orden?.clave === c.clave;
                let Icono = ArrowUpDown;
                if (activa) Icono = orden!.dir === 1 ? ArrowUp : ArrowDown;
                return (
                  <th key={c.clave} className={`sticky top-0 z-10 border-b border-border bg-surface px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${alinClase(c.alinear)}`}>
                    <button
                      type="button"
                      onClick={() => pulsarCabecera(c.clave)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      title={`Ordenar por ${c.titulo}`}
                    >
                      {c.titulo}
                      <Icono className={`h-3 w-3 ${activa ? "text-foreground" : "opacity-40"}`} aria-hidden />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={columnas.length + 2} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>
            )}
            {!cargando && ordenadas.length === 0 && (
              <tr><td colSpan={columnas.length + 2} className="px-4 py-8 text-center text-muted-foreground">{vacio ?? "Sin registros."}</td></tr>
            )}
            {!cargando && ordenadas.map((f, i) => {
              const id = idDe(f);
              const marcada = sel.has(id);
              return (
                <tr
                  key={id}
                  onClick={onAbrir ? () => onAbrir(f) : undefined}
                  className={`group ${onAbrir ? "cursor-pointer" : ""} ${marcada ? "bg-brand/10" : "hover:bg-surface-overlay"}`}
                >
                  <td className="border-b border-border px-2 py-2">
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={() => toggleUna(id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Seleccionar fila"
                      className="align-middle"
                    />
                  </td>
                  <td className="border-b border-border px-2 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  {columnas.map((c, ci) => (
                    <td key={c.clave} className={`border-b border-border px-3 py-2 ${alinClase(c.alinear)}`}>
                      {ci === 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          {c.render ? c.render(f) : String(c.valor(f) ?? "—")}
                          {/* Acciones junto al nombre (estilo Ágora), visibles al pasar/seleccionar */}
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
      {/* Barra inferior: selección + exportar (estilo Ágora, botones abajo) */}
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
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
