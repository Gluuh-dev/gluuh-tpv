"use client";

// Tabla de listado reutilizable del panel (familias, categorías, productos,
// grupos mayores, series…). Diseño profesional estilo Ágora:
// - BARRA superior con Nuevo · Duplicar · Editar · Eliminar (según selección) y
//   un buscador genérico a la derecha; opcional `filtros` (p. ej. un desplegable);
// - ocupa SIEMPRE el 100% del alto de su columna flex (aunque haya 3 filas);
// - scroll interno con cabecera fija; cabecera/barra/footer en color distinto;
// - filas cebra (una sí, otra no) + hover + selección;
// - ordenación por cabecera: el chevron se oculta hasta hover/focus y muestra
//   el sentido; si la columna ya ordena, queda resaltado (blanco) siempre;
// - checks de selección + exportar (CSV) e imprimir; <IrA/> para referencias.
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Copy, Download, ExternalLink, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";

type ValorCelda = string | number | boolean | null;

export interface ColumnaDatos<T> {
  clave: string;
  titulo: string;
  alinear?: "centro" | "der";
  /** Valor plano de la celda: se usa para ordenar, buscar y exportar. */
  valor: (fila: T) => ValorCelda;
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

// Normaliza para buscar/ordenar sin acentos ni mayúsculas.
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function TablaDatos<T>({
  columnas,
  filas,
  idDe,
  onNuevo,
  onAbrir,
  onCopiar,
  onEliminar,
  filtros,
  exportarNombre,
  cargando = false,
  vacio,
}: Readonly<{
  columnas: ColumnaDatos<T>[];
  filas: T[];
  idDe: (fila: T) => string;
  /** «Nuevo» de la barra superior (crear un registro). */
  onNuevo?: () => void;
  /** «Editar» / clic en la fila (abrir un registro). */
  onAbrir?: (fila: T) => void;
  /** «Duplicar»: copia una fila (la página inserta la copia y recarga). */
  onCopiar?: (fila: T) => void | Promise<void>;
  /** «Eliminar»: borra una fila SIN confirmar (la barra confirma en bloque). */
  onEliminar?: (fila: T) => void | Promise<void>;
  /** Controles extra en la barra (p. ej. un desplegable de filtro). */
  filtros?: ReactNode;
  /** Nombre base del fichero exportado (sin extensión). */
  exportarNombre: string;
  cargando?: boolean;
  /** Texto cuando no hay filas (tras filtrar). */
  vacio?: string;
}>) {
  const [orden, setOrden] = useState<{ clave: string; dir: 1 | -1 } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  // Búsqueda genérica: coincide en cualquier columna (texto sin acentos).
  const filtradas = useMemo(() => {
    const term = norm(q.trim());
    if (!term) return filas;
    return filas.filter((f) => columnas.some((c) => norm(String(c.valor(f) ?? "")).includes(term)));
  }, [filas, q, columnas]);

  const ordenadas = useMemo(() => {
    if (!orden) return filtradas;
    const col = columnas.find((c) => c.clave === orden.clave);
    if (!col) return filtradas;
    return [...filtradas].sort((a, b) => {
      const va = col.valor(a);
      const vb = col.valor(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * orden.dir;
      if (typeof va === "boolean" && typeof vb === "boolean") return (Number(va) - Number(vb)) * orden.dir;
      return String(va).localeCompare(String(vb), "es", { numeric: true, sensitivity: "base" }) * orden.dir;
    });
  }, [filtradas, orden, columnas]);

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

  // Filas seleccionadas resueltas contra el total (aunque la búsqueda las oculte).
  const seleccionadas = () => filas.filter((f) => sel.has(idDe(f)));

  async function duplicarSel() {
    if (!onCopiar) return;
    for (const f of seleccionadas()) await onCopiar(f);
    setSel(new Set());
  }
  function editarSel() {
    const s = seleccionadas();
    if (onAbrir && s.length === 1) onAbrir(s[0]!);
  }
  async function eliminarSel() {
    if (!onEliminar) return;
    const s = seleccionadas();
    if (s.length === 0) return;
    if (!window.confirm(`¿Eliminar ${s.length} registro${s.length === 1 ? "" : "s"}? No se puede deshacer.`)) return;
    for (const f of s) await onEliminar(f);
    setSel(new Set());
  }

  const aExportar = () => (sel.size ? seleccionadas() : ordenadas);

  function exportarCsv() {
    const filasExp = aExportar();
    const esc = (v: ValorCelda) => {
      const s = v == null ? "" : String(v);
      return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
    };
    const cabecera = columnas.map((c) => esc(c.titulo)).join(";");
    const cuerpo = filasExp.map((f) => columnas.map((c) => esc(c.valor(f))).join(";")).join("\n");
    const csv = `﻿${cabecera}\n${cuerpo}`; // BOM + ; → Excel es-ES
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportarNombre}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function imprimir() {
    const filasExp = aExportar();
    const esc = (s: ValorCelda) => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;");
    const filas2 = filasExp.map((f) => `<tr>${columnas.map((c) => `<td>${esc(c.valor(f))}</td>`).join("")}</tr>`).join("");
    const html = `<!doctype html><title>${esc(exportarNombre)}</title>
<style>body{font:12px system-ui;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}th{background:#f2f2f2}</style>
<h3>${esc(exportarNombre)} · ${filasExp.length} registro${filasExp.length === 1 ? "" : "s"}</h3>
<table><thead><tr>${columnas.map((c) => `<th>${esc(c.titulo)}</th>`).join("")}</tr></thead><tbody>${filas2}</tbody></table>`;
    const w = window.open("", "_blank", "width=1000,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  const selCount = sel.size;
  // Cabecera (sticky arriba) con divisores verticales. Las 3 primeras columnas
  // (check · # · Nombre) se fijan también a la IZQUIERDA al hacer scroll lateral.
  const thBase = "sticky top-0 z-10 border-b border-r border-border bg-surface-muted px-3 py-2.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
  const tdBase = "border-b border-r border-border-muted px-3 py-2 align-middle";
  const hayBarra = onNuevo || onCopiar || onAbrir || onEliminar || filtros;

  return (
    // flex-1 + min-h-0: la tabla llena el alto de su columna flex (la página
    // debe ser `flex h-full flex-col`). Con pocas filas, el cuerpo se estira igual.
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
      {/* Barra superior: acciones (izq.) + filtros + buscador (der.) */}
      {hayBarra && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {onNuevo && (
              <Button size="sm" onClick={onNuevo}><Plus className="h-4 w-4" /> Nuevo</Button>
            )}
            {onCopiar && (
              <Button size="sm" variant="secondary" disabled={selCount === 0} onClick={duplicarSel} title="Duplica la(s) fila(s) seleccionada(s)">
                <Copy className="h-4 w-4" /> Duplicar
              </Button>
            )}
            {onAbrir && (
              <Button size="sm" variant="secondary" disabled={selCount !== 1} onClick={editarSel} title="Edita la fila seleccionada">
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            )}
            {onEliminar && (
              <Button size="sm" variant="destructive" disabled={selCount === 0} onClick={eliminarSel} title="Elimina la(s) fila(s) seleccionada(s)">
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            )}
            {filtros}
          </div>
          <div className="ml-auto">
            <SearchInput value={q} onChange={setQ} placeholder="Buscar…" className="w-64" />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className={`${thBase} sticky left-0 z-30 w-9 text-center`}>
                <input
                  type="checkbox"
                  checked={todasSel}
                  onChange={toggleTodas}
                  aria-label="Seleccionar todo"
                  className="block h-4 w-4 accent-brand"
                />
              </th>
              <th className={`${thBase} left-9 z-30 w-10`}>#</th>
              {columnas.map((c, ci) => {
                const activa = orden?.clave === c.clave;
                // Activa: chevron del sentido actual, resaltado y siempre visible.
                // Inactiva: chevron del próximo clic (asc), oculto hasta hover/focus.
                const bajada = activa && orden?.dir === -1;
                const Chevron = bajada ? ChevronDown : ChevronUp;
                // La primera columna (Nombre) también se fija a la izquierda.
                const fija = ci === 0 ? "left-[76px] z-30" : "";
                return (
                  <th key={c.clave} className={`${thBase} ${fija} ${alinClase(c.alinear)}`}>
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
              <tr><td colSpan={columnas.length + 2} className="px-4 py-10 text-center text-muted-foreground">{q.trim() ? `Sin resultados para «${q}».` : (vacio ?? "Sin registros.")}</td></tr>
            )}
            {!cargando && ordenadas.map((f, i) => {
              const id = idDe(f);
              const marcada = sel.has(id);
              // Cebra: base según paridad; selección manda por encima.
              let fondo = i % 2 === 0 ? "bg-surface" : "bg-surface-overlay";
              if (marcada) fondo = "bg-brand/10";
              // Las celdas fijas necesitan fondo opaco para tapar lo que scrolla debajo.
              const fijaTd = `sticky z-20 ${fondo} group-hover:bg-surface-muted`;
              return (
                <tr
                  key={id}
                  onClick={onAbrir ? () => onAbrir(f) : undefined}
                  className={`group ${fondo} ${onAbrir ? "cursor-pointer" : ""} hover:bg-surface-muted`}
                >
                  <td className={`${tdBase} left-0 w-9 px-2 text-center ${fijaTd}`}>
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={() => toggleUna(id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Seleccionar fila"
                      className="mx-auto block h-4 w-4 accent-brand"
                    />
                  </td>
                  <td className={`${tdBase} left-9 w-10 px-2 tabular-nums text-muted-foreground ${fijaTd}`}>{i + 1}</td>
                  {columnas.map((c, ci) => (
                    <td key={c.clave} className={`${tdBase} ${alinClase(c.alinear)} ${ci === 0 ? `left-[76px] ${fijaTd}` : ""}`}>
                      {c.render ? c.render(f) : <span className={c.valor(f) == null ? "text-muted-foreground" : undefined}>{String(c.valor(f) ?? "—")}</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Barra inferior (color distinto): recuento + exportar/imprimir. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-surface-muted px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {selCount > 0 ? `${selCount} seleccionada${selCount === 1 ? "" : "s"} · ` : ""}
          {q.trim() ? `${filtradas.length} de ${filas.length}` : filas.length} registro{filas.length === 1 ? "" : "s"}
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
