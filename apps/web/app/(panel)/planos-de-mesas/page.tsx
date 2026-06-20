"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, ArrowLeft, Brush, LayoutGrid } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { ASSETS, SUELOS, assetPorId, mesaPorCapacidad, dim, type PlanoAsset } from "../../lib/plano-assets";
import { leerBranding, BRANDING_DEFAULT, type Branding } from "../../lib/branding";
import { PlanoSvg } from "@/components/plano-svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

interface Room { id: string; nombre: string; orden: number; suelo: string | null }
interface Mesa { id: string; nombre: string; room_id: string; pos_x: number | null; pos_y: number | null; capacidad: number; rotacion: number }
interface Elem { id: string; room_id: string; tipo: string; etiqueta: string | null; icono: string | null; pos_x: number; pos_y: number; ancho: number; alto: number; rotacion: number }
type Sel = { kind: "mesa" | "elem"; id: string } | null;

const snap = (v: number) => Math.round(v / 20) * 20;   // rejilla fina (más cuadrados)
const MESAS_CAT = [
  { label: "Taburete", cap: 1 }, { label: "Mesa 2", cap: 2 }, { label: "Mesa 4", cap: 4 },
  { label: "Mesa 6", cap: 6 }, { label: "Mesa 8", cap: 8 },
];

export default function PlanosDeMesas() {
  const sb = supabaseBrowser();
  const [locationId, setLocationId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [elems, setElems] = useState<Elem[]>([]);
  const [marca, setMarca] = useState<Branding>(BRANDING_DEFAULT);
  const [nuevo, setNuevo] = useState("");

  const [edit, setEdit] = useState<string | null>(null);   // room_id en edición (null = listado)
  const [sel, setSel] = useState<Sel>(null);
  const [dialogo, setDialogo] = useState<null | "fondo" | "elemento">(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "mesa" | "elem"; id: string; offX: number; offY: number } | null>(null);
  const resize = useRef<{ id: string; sx: number; sy: number; sw: number; sh: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; kind: "mesa" | "elem"; id: string } | null>(null);
  const [movil, setMovil] = useState(false);
  const [movilPos, setMovilPos] = useState({ x: 60, y: 60 });
  const movilDrag = useRef<{ ox: number; oy: number } | null>(null);

  async function cargar() {
    const { data: loc } = await sb.from("location").select("id").limit(1).maybeSingle();
    const lid = loc?.id ?? null;
    setLocationId(lid);
    if (!lid) return;
    const [{ data: r }, { data: m }, { data: e }] = await Promise.all([
      sb.from("room").select("id,nombre,orden,suelo").eq("location_id", lid).order("orden"),
      sb.from("restaurant_table").select("id,nombre,room_id,pos_x,pos_y,capacidad,rotacion"),
      sb.from("plano_elemento").select("id,room_id,tipo,etiqueta,icono,pos_x,pos_y,ancho,alto,rotacion"),
    ]);
    setRooms((r as Room[]) ?? []);
    setMesas((m as Mesa[]) ?? []);
    setElems((e as Elem[]) ?? []);
    setMarca(await leerBranding(sb));
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);
  // Centrar el lienzo al abrir un plano
  useEffect(() => {
    if (!edit) return;
    const el = canvasRef.current;
    if (el) requestAnimationFrame(() => { el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2); });
  }, [edit]);
  // Atajos: Supr=eliminar · Ctrl/Cmd+D o C=clonar · R=rotar
  useEffect(() => {
    if (!edit) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!sel) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); borrarSel(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "c")) { e.preventDefault(); clonar(sel.kind, sel.id); }
      else if (e.key === "r" || e.key === "R") { e.preventDefault(); rotar(sel.kind, sel.id); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [edit, sel]);

  /* ── Planos (salas) ── */
  async function nuevoPlano(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevo.trim() || !locationId) return;
    const { data } = await sb.from("room").insert({ location_id: locationId, nombre: nuevo.trim(), orden: rooms.length }).select("id").single();
    setNuevo("");
    await cargar();
    if (data) setEdit((data as { id: string }).id);
  }
  async function renombrar(id: string, nombre: string) { setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, nombre } : r))); await sb.from("room").update({ nombre }).eq("id", id); }
  async function borrarPlano(id: string) { if (!confirm("¿Eliminar el plano y sus mesas/elementos?")) return; await sb.from("room").delete().eq("id", id); cargar(); }
  async function setSuelo(id: string, suelo: string) { setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, suelo } : r))); await sb.from("room").update({ suelo: suelo || null }).eq("id", id); }

  /* ── Añadir ── */
  async function addMesaCap(cap: number) {
    if (!edit) return;
    const n = mesas.length + 1;
    await sb.from("restaurant_table").insert({ room_id: edit, nombre: cap <= 1 ? `B${n}` : `Mesa ${n}`, estado: "LIBRE", pos_x: 80, pos_y: 80, capacidad: cap });
    setDialogo(null); cargar();
  }
  async function addElem(a: PlanoAsset) {
    if (!edit) return;
    const d = dim(a);
    const tipo = a.tipo === "barra" ? "BARRA" : a.tipo === "separador" ? "PARED" : a.tipo === "abertura" ? "PUERTA" : "PLANTA";
    await sb.from("plano_elemento").insert({ room_id: edit, tipo, etiqueta: a.nombre, icono: a.id, pos_x: 80, pos_y: 80, ancho: d.w, alto: d.h });
    setDialogo(null); cargar();
  }
  async function addSueloZona(sueloId: string) {
    if (!edit) return;
    await sb.from("plano_elemento").insert({ room_id: edit, tipo: "DECOR", etiqueta: "Suelo", icono: `suelo:${sueloId}`, pos_x: 80, pos_y: 80, ancho: 240, alto: 200 });
    setDialogo(null); cargar();
  }

  /* ── Editar / borrar seleccionado ── */
  async function setCapacidad(id: string, cap: number) { const c = Math.max(1, Math.min(12, cap)); setMesas((ms) => ms.map((m) => (m.id === id ? { ...m, capacidad: c } : m))); await sb.from("restaurant_table").update({ capacidad: c }).eq("id", id); }
  async function setNombreMesa(id: string, nombre: string) { setMesas((ms) => ms.map((m) => (m.id === id ? { ...m, nombre } : m))); await sb.from("restaurant_table").update({ nombre }).eq("id", id); }
  async function setTam(id: string, ancho: number, alto: number) { setElems((es) => es.map((e) => (e.id === id ? { ...e, ancho, alto } : e))); await sb.from("plano_elemento").update({ ancho, alto }).eq("id", id); }
  async function borrarSel() {
    if (!sel) return;
    if (sel.kind === "mesa") await sb.from("restaurant_table").delete().eq("id", sel.id);
    else await sb.from("plano_elemento").delete().eq("id", sel.id);
    setSel(null); cargar();
  }

  /* ── Drag / resize ── */
  function onDown(e: React.PointerEvent, kind: "mesa" | "elem", id: string, x: number, y: number) {
    if (e.button !== 0) return;                 // botón derecho → menú, no arrastrar
    e.preventDefault();
    setMenu(null);
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    drag.current = { kind, id, offX: e.clientX - rect.left - x, offY: e.clientY - rect.top - y };
    setSel({ kind, id });
  }
  function onResizeDown(e: React.PointerEvent, el: Elem) {
    e.stopPropagation(); e.preventDefault();
    resize.current = { id: el.id, sx: e.clientX, sy: e.clientY, sw: el.ancho, sh: el.alto };
  }
  function onMovilDown(e: React.PointerEvent) {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    movilDrag.current = { ox: e.clientX - rect.left - movilPos.x, oy: e.clientY - rect.top - movilPos.y };
  }
  function onMove(e: React.PointerEvent) {
    const mv = movilDrag.current;
    if (mv) {
      const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
      setMovilPos({ x: Math.max(0, e.clientX - rect.left - mv.ox), y: Math.max(0, e.clientY - rect.top - mv.oy) });
      return;
    }
    const r = resize.current;
    if (r) {
      const w = Math.max(20, r.sw + (e.clientX - r.sx));
      const h = Math.max(20, r.sh + (e.clientY - r.sy));
      setElems((es) => es.map((z) => (z.id === r.id ? { ...z, ancho: w, alto: h } : z)));
      return;
    }
    const d = drag.current; if (!d) return;
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    const x = Math.max(0, e.clientX - rect.left - d.offX);
    const y = Math.max(0, e.clientY - rect.top - d.offY);
    if (d.kind === "mesa") setMesas((ms) => ms.map((m) => (m.id === d.id ? { ...m, pos_x: x, pos_y: y } : m)));
    else setElems((es) => es.map((el) => (el.id === d.id ? { ...el, pos_x: x, pos_y: y } : el)));
  }
  async function onUp() {
    if (movilDrag.current) { movilDrag.current = null; return; }
    const r = resize.current;
    if (r) {
      resize.current = null;
      const el = elems.find((z) => z.id === r.id); if (!el) return;
      const w = snap(el.ancho), h = snap(el.alto);
      setElems((es) => es.map((z) => (z.id === r.id ? { ...z, ancho: w, alto: h } : z)));
      await sb.from("plano_elemento").update({ ancho: w, alto: h }).eq("id", r.id);
      return;
    }
    const d = drag.current; if (!d) return; drag.current = null;
    if (d.kind === "mesa") {
      const m = mesas.find((z) => z.id === d.id); if (!m) return;
      const x = snap(m.pos_x ?? 0), y = snap(m.pos_y ?? 0);
      setMesas((ms) => ms.map((z) => (z.id === d.id ? { ...z, pos_x: x, pos_y: y } : z)));
      await sb.from("restaurant_table").update({ pos_x: x, pos_y: y }).eq("id", d.id);
    } else {
      const el = elems.find((z) => z.id === d.id); if (!el) return;
      const x = snap(el.pos_x), y = snap(el.pos_y);
      setElems((es) => es.map((z) => (z.id === d.id ? { ...z, pos_x: x, pos_y: y } : z)));
      await sb.from("plano_elemento").update({ pos_x: x, pos_y: y }).eq("id", d.id);
    }
  }

  /* ── Menú contextual (botón derecho) ── */
  function onCtx(e: React.MouseEvent, kind: "mesa" | "elem", id: string) {
    e.preventDefault();
    setSel({ kind, id });
    setMenu({ x: e.clientX, y: e.clientY, kind, id });
  }
  async function clonar(kind: "mesa" | "elem", id: string) {
    setMenu(null);
    if (!edit) return;
    if (kind === "mesa") {
      const m = mesas.find((z) => z.id === id); if (!m) return;
      await sb.from("restaurant_table").insert({ room_id: edit, nombre: `${m.nombre} copia`, estado: "LIBRE", pos_x: (m.pos_x ?? 80) + 24, pos_y: (m.pos_y ?? 80) + 24, capacidad: m.capacidad, rotacion: m.rotacion });
    } else {
      const el = elems.find((z) => z.id === id); if (!el) return;
      await sb.from("plano_elemento").insert({ room_id: edit, tipo: el.tipo, etiqueta: el.etiqueta, icono: el.icono, pos_x: el.pos_x + 24, pos_y: el.pos_y + 24, ancho: el.ancho, alto: el.alto, rotacion: el.rotacion });
    }
    cargar();
  }
  async function rotar(kind: "mesa" | "elem", id: string) {
    setMenu(null);
    if (kind === "mesa") {
      const m = mesas.find((z) => z.id === id); if (!m) return;
      const rot = ((m.rotacion || 0) + 90) % 360;
      setMesas((ms) => ms.map((z) => (z.id === id ? { ...z, rotacion: rot } : z)));
      await sb.from("restaurant_table").update({ rotacion: rot }).eq("id", id);
    } else {
      const el = elems.find((z) => z.id === id); if (!el) return;
      const rot = ((el.rotacion || 0) + 90) % 360;
      setElems((es) => es.map((z) => (z.id === id ? { ...z, rotacion: rot } : z)));
      await sb.from("plano_elemento").update({ rotacion: rot }).eq("id", id);
    }
  }

  /* ───────── LISTADO ───────── */
  if (!edit) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <PageHeader
          title="Planos de mesas"
          description="Diseña la sala: arrastra mesas y elementos, elige el suelo y organiza interior y exterior."
          actions={
            <form onSubmit={nuevoPlano} className="flex gap-2">
              <Input className="w-44" placeholder="Nuevo plano (Salón…)" value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
              <Button className="whitespace-nowrap"><Plus className="h-4 w-4" /> Plano</Button>
            </form>
          }
        />
        {rooms.length === 0 ? (
          <EmptyState icon={<LayoutGrid className="h-8 w-8" />} title="Sin planos todavía" description="Crea tu primer plano (p. ej. «Salón» o «Terraza»)." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rooms.map((r) => {
              const nMesas = mesas.filter((m) => m.room_id === r.id).length;
              return (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <button onClick={() => { setEdit(r.id); setSel(null); }} className="min-w-0 flex-1 text-left">
                    <div className="font-medium">{r.nombre}</div>
                    <div className="text-xs text-muted-foreground">{nMesas} mesas · suelo: {SUELOS.find((s) => s.id === (r.suelo ?? ""))?.nombre ?? "liso"}</div>
                  </button>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEdit(r.id); setSel(null); }}><Pencil className="h-4 w-4" /> Editar</Button>
                    <button onClick={() => borrarPlano(r.id)} className="text-muted-foreground/60 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ───────── EDITOR ───────── */
  const room = rooms.find((r) => r.id === edit);
  const mesasSala = mesas.filter((m) => m.room_id === edit);
  const elemsSala = elems.filter((e) => e.room_id === edit);
  const mesaSel = sel?.kind === "mesa" ? mesas.find((m) => m.id === sel.id) : null;
  const elemSel = sel?.kind === "elem" ? elems.find((e) => e.id === sel.id) : null;
  const bg = room?.suelo
    ? { backgroundImage: `url(/plano/${room.suelo}.svg)`, backgroundRepeat: "repeat" as const }
    : { backgroundImage: "radial-gradient(rgba(120,120,120,0.12) 1px, transparent 1px)", backgroundSize: "20px 20px" };
  const canvasStyle = { minWidth: 1800, minHeight: 1100, ...bg, "--mesa-fill": marca.mesa_color, "--silla-fill": marca.silla_color } as unknown as React.CSSProperties;

  return (
    <div className="space-y-3">
      {/* Cabecera del editor */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => { setEdit(null); setSel(null); }}><ArrowLeft className="h-4 w-4" /> Planos</Button>
        <Input value={room?.nombre ?? ""} onChange={(e) => edit && renombrar(edit, e.target.value)} className="w-52 font-medium" />
        <Button variant="outline" size="sm" onClick={() => setDialogo("fondo")}><Brush className="h-4 w-4" /> Fondo</Button>
        <Button size="sm" onClick={() => setDialogo("elemento")}><Plus className="h-4 w-4" /> Añadir</Button>
        <Button variant={movil ? "default" : "outline"} size="sm" onClick={() => setMovil((v) => !v)}>📱 Móvil</Button>
        {sel && <Button variant="outline" size="sm" className="text-destructive" onClick={borrarSel}><Trash2 className="h-4 w-4" /> Eliminar</Button>}
        <span className="ml-auto text-xs text-muted-foreground">Clic derecho o teclado: Supr=borrar · Ctrl+D=clonar · R=rotar · tirador=redimensionar</span>
      </div>

      {/* Propiedades del elemento seleccionado */}
      {mesaSel && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Mesa nº</span>
          <Input value={mesaSel.nombre} onChange={(e) => setNombreMesa(mesaSel.id, e.target.value)} className="h-8 w-28" />
          <span className="text-muted-foreground">Capacidad</span>
          <button onClick={() => setCapacidad(mesaSel.id, (mesaSel.capacidad || 4) - 1)} className="grid h-7 w-7 place-items-center rounded border border-border">−</button>
          <span className="w-6 text-center tabular-nums">{mesaSel.capacidad}</span>
          <button onClick={() => setCapacidad(mesaSel.id, (mesaSel.capacidad || 4) + 1)} className="grid h-7 w-7 place-items-center rounded border border-border">+</button>
        </div>
      )}
      {elemSel && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{elemSel.etiqueta ?? "Elemento"}</span>
          <span className="text-muted-foreground">Ancho</span>
          <Input type="number" value={elemSel.ancho} onChange={(e) => setTam(elemSel.id, Number(e.target.value) || 1, elemSel.alto)} className="h-8 w-20" />
          <span className="text-muted-foreground">Alto</span>
          <Input type="number" value={elemSel.alto} onChange={(e) => setTam(elemSel.id, elemSel.ancho, Number(e.target.value) || 1)} className="h-8 w-20" />
        </div>
      )}

      {/* Lienzo */}
      <div
        ref={canvasRef}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onPointerDown={(e) => { if (e.target === canvasRef.current) setSel(null); }}
        className="relative h-[calc(100vh-170px)] w-full touch-none select-none overflow-auto rounded-xl border border-border bg-muted/20"
        style={canvasStyle}
      >
        <div className="pointer-events-none absolute inset-3 rounded-2xl border-2 border-foreground/15" />

        {/* Elementos (zonas de suelo al fondo) */}
        {elemsSala.slice().sort((a, b) => (b.icono?.startsWith("suelo:") ? 1 : 0) - (a.icono?.startsWith("suelo:") ? 1 : 0)).map((el) => {
          const a = assetPorId(el.icono);
          const isSel = sel?.kind === "elem" && sel.id === el.id;
          const esSuelo = el.icono?.startsWith("suelo:");
          return (
            <div
              key={el.id}
              style={{ left: el.pos_x, top: el.pos_y, width: el.ancho, height: el.alto, transform: el.rotacion ? `rotate(${el.rotacion}deg)` : undefined }}
              onPointerDown={(e) => onDown(e, "elem", el.id, el.pos_x, el.pos_y)}
              onContextMenu={(e) => onCtx(e, "elem", el.id)}
              className={`absolute cursor-move ${isSel ? "rounded ring-2 ring-primary" : ""}`}
            >
              {esSuelo
                ? <div className="h-full w-full rounded-md border border-foreground/10" style={{ backgroundImage: `url(/plano/${el.icono!.slice(6)}.svg)`, backgroundRepeat: "repeat" }} />
                /* eslint-disable-next-line @next/next/no-img-element */
                : a ? <img src={`/plano/${a.file}`} alt="" draggable={false} className="pointer-events-none h-full w-full" />
                : <div className="grid h-full w-full place-items-center rounded bg-foreground/20 text-xs">{el.etiqueta}</div>}
              {isSel && <span onPointerDown={(e) => onResizeDown(e, el)} className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-se-resize rounded-sm border border-primary bg-background" />}
            </div>
          );
        })}

        {/* Mesas */}
        {mesasSala.map((m) => {
          const a = mesaPorCapacidad(m.capacidad || 4); const d = dim(a);
          const isSel = sel?.kind === "mesa" && sel.id === m.id;
          const x = m.pos_x ?? 80, y = m.pos_y ?? 80;
          return (
            <div key={m.id} style={{ left: x, top: y, width: d.w, height: d.h }} onPointerDown={(e) => onDown(e, "mesa", m.id, x, y)} onContextMenu={(e) => onCtx(e, "mesa", m.id)} className={`absolute cursor-move ${isSel ? "rounded-lg ring-2 ring-primary" : ""}`}>
              <PlanoSvg file={a.file} style={{ transform: m.rotacion ? `rotate(${m.rotacion}deg)` : undefined }} className="pointer-events-none block h-full w-full" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-background/85 px-1 text-[11px] font-bold text-foreground">{m.nombre.replace("Mesa ", "")}</span>
            </div>
          );
        })}

        {mesasSala.length === 0 && elemsSala.length === 0 && (
          <p className="absolute inset-0 grid place-items-center text-muted-foreground">Pulsa «Añadir» para colocar mesas y elementos.</p>
        )}

        {/* Marco de vista móvil: lo que se ve en un teléfono (arrastra para situarlo) */}
        {movil && (
          <div style={{ left: movilPos.x, top: movilPos.y, width: 384, height: 760 }} className="pointer-events-none absolute z-20 rounded-[28px] border-[3px] border-dashed border-primary/80 bg-primary/5">
            <div onPointerDown={onMovilDown} className="pointer-events-auto absolute -top-7 left-0 cursor-move rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">📱 Vista móvil · arrastra</div>
          </div>
        )}
      </div>

      {/* ── Menú contextual (clonar/rotar/eliminar) ── */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div className="fixed z-50 min-w-36 overflow-hidden rounded-md border border-border bg-card py-1 text-sm shadow-lg" style={{ left: menu.x, top: menu.y }}>
            <button onClick={() => clonar(menu.kind, menu.id)} className="block w-full px-3 py-1.5 text-left hover:bg-accent">Clonar</button>
            <button onClick={() => rotar(menu.kind, menu.id)} className="block w-full px-3 py-1.5 text-left hover:bg-accent">Rotar 90°</button>
            <button onClick={() => { setMenu(null); borrarSel(); }} className="block w-full px-3 py-1.5 text-left text-destructive hover:bg-accent">Eliminar</button>
          </div>
        </>
      )}

      {/* ── Diálogo: Seleccionar Suelo ── */}
      {dialogo === "fondo" && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-foreground/40 p-4" onClick={() => setDialogo(null)}>
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Seleccionar suelo</h3>
            <div className="grid grid-cols-3 gap-2">
              {SUELOS.map((s) => (
                <button key={s.id || "liso"} onClick={() => { if (edit) setSuelo(edit, s.id); setDialogo(null); }} className="overflow-hidden rounded-md border border-border hover:ring-2 hover:ring-primary">
                  <div className="h-16 w-full" style={s.id ? { backgroundImage: `url(/plano/${s.id}.svg)`, backgroundRepeat: "repeat" } : { background: "var(--muted)" }} />
                  <div className="px-1 py-1 text-center text-xs">{s.nombre}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Diálogo: Seleccionar Elemento ── */}
      {dialogo === "elemento" && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-foreground/40 p-4" onClick={() => setDialogo(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Añadir elemento</h3>

            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mesas</p>
            <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {MESAS_CAT.map((mc) => (
                <button key={mc.cap} onClick={() => addMesaCap(mc.cap)} className="flex flex-col items-center gap-1 rounded-md border border-border p-2 hover:ring-2 hover:ring-primary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/plano/${mesaPorCapacidad(mc.cap).file}`} alt="" className="h-14 w-14 object-contain" />
                  <span className="text-xs">{mc.label}</span>
                </button>
              ))}
            </div>

            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mobiliario y plantas</p>
            <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {ASSETS.filter((a) => a.tipo === "barra" || a.tipo === "planta" || a.tipo === "separador").map((a) => (
                <button key={a.id} onClick={() => addElem(a)} title={a.nombre} className="flex flex-col items-center gap-1 rounded-md border border-border p-2 hover:ring-2 hover:ring-primary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/plano/${a.file}`} alt="" className="h-14 w-14 object-contain" />
                  <span className="text-center text-[11px] leading-tight">{a.nombre}</span>
                </button>
              ))}
            </div>

            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aberturas y marcas</p>
            <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {ASSETS.filter((a) => a.tipo === "abertura").map((a) => (
                <button key={a.id} onClick={() => addElem(a)} title={a.nombre} className="flex flex-col items-center gap-1 rounded-md border border-border p-2 hover:ring-2 hover:ring-primary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/plano/${a.file}`} alt="" className="h-14 w-14 object-contain" />
                  <span className="text-center text-[11px] leading-tight">{a.nombre}</span>
                </button>
              ))}
            </div>

            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zonas de suelo</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {SUELOS.filter((s) => s.id).map((s) => (
                <button key={s.id} onClick={() => addSueloZona(s.id)} className="overflow-hidden rounded-md border border-border hover:ring-2 hover:ring-primary">
                  <div className="h-14 w-full" style={{ backgroundImage: `url(/plano/${s.id}.svg)`, backgroundRepeat: "repeat" }} />
                  <div className="py-1 text-center text-[11px]">{s.nombre}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
