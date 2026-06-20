"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ASSETS, SUELOS, assetPorId, mesaPorCapacidad, dim, type PlanoAsset } from "../../lib/plano-assets";

interface Room { id: string; nombre: string; orden: number; suelo: string | null }
interface Mesa { id: string; nombre: string; room_id: string; estado: string; pos_x: number | null; pos_y: number | null; capacidad: number }
interface Elem { id: string; room_id: string; tipo: string; etiqueta: string | null; icono: string | null; pos_x: number; pos_y: number; ancho: number; alto: number }

type Sel = { kind: "mesa" | "elem"; id: string } | null;

const snap = (v: number) => Math.round(v / 40) * 40;

export default function Sala() {
  const sb = supabaseBrowser();
  const [locationId, setLocationId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [elems, setElems] = useState<Elem[]>([]);
  const [nuevaSala, setNuevaSala] = useState("");
  const [salaActiva, setSalaActiva] = useState<string>("");
  const [sel, setSel] = useState<Sel>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "mesa" | "elem"; id: string; offX: number; offY: number } | null>(null);

  async function cargar() {
    const { data: loc } = await sb.from("location").select("id").limit(1).maybeSingle();
    const lid = loc?.id ?? null;
    setLocationId(lid);
    if (!lid) return;
    const [{ data: r }, { data: m }, { data: e }] = await Promise.all([
      sb.from("room").select("id,nombre,orden,suelo").eq("location_id", lid).order("orden"),
      sb.from("restaurant_table").select("id,nombre,room_id,estado,pos_x,pos_y,capacidad"),
      sb.from("plano_elemento").select("id,room_id,tipo,etiqueta,icono,pos_x,pos_y,ancho,alto"),
    ]);
    const rr = (r as Room[]) ?? [];
    setRooms(rr);
    setMesas((m as Mesa[]) ?? []);
    setElems((e as Elem[]) ?? []);
    setSalaActiva((prev) => prev || rr[0]?.id || "");
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  /* ── Salas ── */
  async function addSala(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaSala.trim() || !locationId) return;
    const { data } = await sb.from("room").insert({ location_id: locationId, nombre: nuevaSala.trim(), orden: rooms.length }).select("id").single();
    setNuevaSala("");
    await cargar();
    if (data) setSalaActiva((data as { id: string }).id);
  }
  async function delSala(id: string) {
    if (!confirm("¿Eliminar sala y sus mesas/elementos?")) return;
    await sb.from("room").delete().eq("id", id);
    setSalaActiva((prev) => (prev === id ? "" : prev));
    cargar();
  }
  async function setSuelo(id: string, suelo: string) {
    setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, suelo } : r)));
    await sb.from("room").update({ suelo: suelo || null }).eq("id", id);
  }

  /* ── Mesas ── */
  async function addMesa() {
    if (!salaActiva) return;
    const n = mesas.length + 1;
    await sb.from("restaurant_table").insert({ room_id: salaActiva, nombre: `Mesa ${n}`, estado: "LIBRE", pos_x: 80, pos_y: 80, capacidad: 4 });
    cargar();
  }
  async function delMesa(id: string) { await sb.from("restaurant_table").delete().eq("id", id); setSel(null); cargar(); }
  async function setCapacidad(id: string, cap: number) {
    const c = Math.max(1, Math.min(12, cap));
    setMesas((ms) => ms.map((m) => (m.id === id ? { ...m, capacidad: c } : m)));
    await sb.from("restaurant_table").update({ capacidad: c }).eq("id", id);
  }

  /* ── Elementos (a partir de un asset SVG) ── */
  async function addElem(a: PlanoAsset) {
    if (!salaActiva) return;
    const d = dim(a);
    const tipo = a.tipo === "barra" ? "BARRA" : a.tipo === "separador" ? "PARED" : "PLANTA";
    await sb.from("plano_elemento").insert({ room_id: salaActiva, tipo, etiqueta: a.nombre, icono: a.id, pos_x: 80, pos_y: 80, ancho: d.w, alto: d.h });
    cargar();
  }
  async function delElem(id: string) { await sb.from("plano_elemento").delete().eq("id", id); setSel(null); cargar(); }

  /* ── Drag ── */
  function onDown(e: React.PointerEvent, kind: "mesa" | "elem", id: string, x: number, y: number) {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { kind, id, offX: e.clientX - rect.left - x, offY: e.clientY - rect.top - y };
    setSel({ kind, id });
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current; if (!d) return;
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    const x = Math.max(0, e.clientX - rect.left - d.offX);
    const y = Math.max(0, e.clientY - rect.top - d.offY);
    if (d.kind === "mesa") setMesas((ms) => ms.map((m) => (m.id === d.id ? { ...m, pos_x: x, pos_y: y } : m)));
    else setElems((es) => es.map((el) => (el.id === d.id ? { ...el, pos_x: x, pos_y: y } : el)));
  }
  async function onUp() {
    const d = drag.current; if (!d) return;
    drag.current = null;
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

  const roomActiva = rooms.find((r) => r.id === salaActiva);
  const mesasSala = mesas.filter((m) => m.room_id === salaActiva);
  const elemsSala = elems.filter((e) => e.room_id === salaActiva);
  const mesaSel = sel?.kind === "mesa" ? mesas.find((m) => m.id === sel.id) : null;
  const bg = roomActiva?.suelo
    ? { backgroundImage: `url(/plano/${roomActiva.suelo}.svg)`, backgroundRepeat: "repeat" }
    : { backgroundImage: "radial-gradient(rgba(120,120,120,0.12) 1px, transparent 1px)", backgroundSize: "40px 40px" };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Sala · plano"
        description="Crea salas, añade mesas y elementos, y arrástralos para colocarlos. El TPV usa este plano."
        actions={
          <form onSubmit={addSala} className="flex gap-2">
            <Input className="w-44" placeholder="Nueva sala (Terraza…)" value={nuevaSala} onChange={(e) => setNuevaSala(e.target.value)} />
            <Button className="whitespace-nowrap"><Plus className="h-4 w-4" /> Sala</Button>
          </form>
        }
      />

      {rooms.length === 0 ? (
        <EmptyState title="Sin salas todavía" description="Crea tu primera sala (p. ej. «Salón» o «Terraza»)." />
      ) : (
        <>
          {/* Pestañas de sala + suelo */}
          <div className="flex flex-wrap items-center gap-2">
            {rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => { setSalaActiva(r.id); setSel(null); }}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${salaActiva === r.id ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent"}`}
              >
                {r.nombre}
                {salaActiva === r.id && <Trash2 onClick={(e) => { e.stopPropagation(); delSala(r.id); }} className="h-3.5 w-3.5 opacity-70 hover:opacity-100" />}
              </button>
            ))}
            {roomActiva && (
              <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                Suelo
                <select value={roomActiva.suelo ?? ""} onChange={(e) => setSuelo(roomActiva.id, e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
                  {SUELOS.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </label>
            )}
          </div>

          {/* Paleta: añadir mesa + elementos (SVG) */}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={addMesa} disabled={!salaActiva}><Plus className="h-4 w-4" /> Mesa</Button>
            <span className="mx-1 text-muted-foreground">|</span>
            {ASSETS.filter((a) => a.tipo !== "mesa").map((a) => (
              <button key={a.id} onClick={() => addElem(a)} disabled={!salaActiva} title={a.nombre} className="flex h-12 w-14 items-center justify-center rounded-md border border-border bg-card p-1 hover:bg-accent disabled:opacity-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/plano/${a.file}`} alt={a.nombre} className="max-h-full max-w-full" />
              </button>
            ))}
            {sel && (
              <Button size="sm" variant="outline" className="ml-auto text-destructive" onClick={() => (sel.kind === "mesa" ? delMesa(sel.id) : delElem(sel.id))}>
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            )}
          </div>

          {mesaSel && (
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <b>{mesaSel.nombre}</b>
              <span className="text-muted-foreground">Capacidad:</span>
              <button onClick={() => setCapacidad(mesaSel.id, (mesaSel.capacidad || 4) - 1)} className="grid h-7 w-7 place-items-center rounded border border-border">−</button>
              <span className="w-6 text-center tabular-nums">{mesaSel.capacidad}</span>
              <button onClick={() => setCapacidad(mesaSel.id, (mesaSel.capacidad || 4) + 1)} className="grid h-7 w-7 place-items-center rounded border border-border">+</button>
            </div>
          )}

          {/* Lienzo */}
          <div
            ref={canvasRef}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            className="relative h-[620px] w-full touch-none select-none overflow-auto rounded-xl border border-border bg-muted/20"
            style={{ minWidth: 1000, ...bg }}
            onPointerDown={(e) => { if (e.target === canvasRef.current) setSel(null); }}
          >
            <div className="pointer-events-none absolute inset-3 rounded-2xl border-2 border-foreground/15" />

            {/* Elementos */}
            {elemsSala.map((el) => {
              const a = assetPorId(el.icono);
              const isSel = sel?.kind === "elem" && sel.id === el.id;
              return (
                <div
                  key={el.id}
                  style={{ left: el.pos_x, top: el.pos_y, width: el.ancho, height: el.alto }}
                  onPointerDown={(e) => onDown(e, "elem", el.id, el.pos_x, el.pos_y)}
                  className={`absolute cursor-move ${isSel ? "rounded ring-2 ring-primary" : ""}`}
                >
                  {a
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={`/plano/${a.file}`} alt="" draggable={false} className="pointer-events-none h-full w-full" />
                    : <div className="grid h-full w-full place-items-center rounded bg-foreground/20 text-xs">{el.icono ?? el.etiqueta}</div>}
                </div>
              );
            })}

            {/* Mesas */}
            {mesasSala.map((m) => {
              const a = mesaPorCapacidad(m.capacidad || 4);
              const d = dim(a);
              const isSel = sel?.kind === "mesa" && sel.id === m.id;
              const x = m.pos_x ?? 80, y = m.pos_y ?? 80;
              return (
                <div
                  key={m.id}
                  style={{ left: x, top: y, width: d.w, height: d.h }}
                  onPointerDown={(e) => onDown(e, "mesa", m.id, x, y)}
                  className={`absolute grid cursor-move place-items-center ${isSel ? "rounded-lg ring-2 ring-primary" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/plano/${a.file}`} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
                  <span className="relative text-xs font-bold text-foreground">{m.nombre.replace("Mesa ", "M")}</span>
                </div>
              );
            })}

            {mesasSala.length === 0 && elemsSala.length === 0 && (
              <p className="absolute inset-0 grid place-items-center text-muted-foreground">Añade mesas y elementos, y arrástralos aquí.</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Arrastra para colocar (se ajusta a la rejilla de 40px). Toca una mesa para su capacidad o eliminar.</p>
        </>
      )}
    </div>
  );
}
