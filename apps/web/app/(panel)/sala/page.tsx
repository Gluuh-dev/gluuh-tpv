"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Armchair } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

interface Room { id: string; nombre: string; orden: number }
interface Mesa { id: string; nombre: string; room_id: string; estado: string }

export default function Sala() {
  const sb = supabaseBrowser();
  const [locationId, setLocationId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [nuevaSala, setNuevaSala] = useState("");

  async function cargar() {
    const { data: loc } = await sb.from("location").select("id").limit(1).maybeSingle();
    const lid = loc?.id ?? null;
    setLocationId(lid);
    if (!lid) return;
    const [{ data: r }, { data: m }] = await Promise.all([
      sb.from("room").select("id,nombre,orden").eq("location_id", lid).order("orden"),
      sb.from("restaurant_table").select("id,nombre,room_id,estado"),
    ]);
    setRooms((r as Room[]) ?? []);
    setMesas((m as Mesa[]) ?? []);
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  async function addSala(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaSala.trim() || !locationId) return;
    await sb.from("room").insert({ location_id: locationId, nombre: nuevaSala.trim(), orden: rooms.length });
    setNuevaSala("");
    cargar();
  }
  async function delSala(id: string) {
    if (!confirm("¿Eliminar sala y sus mesas?")) return;
    await sb.from("room").delete().eq("id", id);
    cargar();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Sala</h1>
          <p className="text-slate-500">Define tus salas y mesas. El TPV y la comandera trabajan sobre ellas.</p>
        </div>
        <form onSubmit={addSala} className="flex gap-2">
          <input className="input w-48" placeholder="Nueva sala (Terraza…)" value={nuevaSala} onChange={(e) => setNuevaSala(e.target.value)} />
          <button className="btn-primary whitespace-nowrap"><Plus className="h-4 w-4" /> Sala</button>
        </form>
      </div>

      {rooms.length === 0 && <div className="card text-slate-400">Crea tu primera sala (p. ej. «Salón» o «Terraza»).</div>}

      <div className="space-y-5">
        {rooms.map((room) => (
          <SalaCard key={room.id} room={room} mesas={mesas.filter((m) => m.room_id === room.id)} onDelete={() => delSala(room.id)} onChange={cargar} />
        ))}
      </div>
    </div>
  );
}

function SalaCard({ room, mesas, onDelete, onChange }: { room: Room; mesas: Mesa[]; onDelete: () => void; onChange: () => void }) {
  const sb = supabaseBrowser();
  const [nombre, setNombre] = useState("");

  async function addMesa(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    await sb.from("restaurant_table").insert({ room_id: room.id, nombre: nombre.trim(), estado: "LIBRE" });
    setNombre("");
    onChange();
  }
  async function addVarias() {
    const n = Number(prompt("¿Cuántas mesas numeradas añadir?", "6"));
    if (!n || n < 1) return;
    const base = mesas.length;
    const filas = Array.from({ length: n }, (_, i) => ({ room_id: room.id, nombre: `Mesa ${base + i + 1}`, estado: "LIBRE" }));
    await sb.from("restaurant_table").insert(filas);
    onChange();
  }
  async function delMesa(id: string) {
    await sb.from("restaurant_table").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">{room.nombre} <span className="text-slate-400">· {mesas.length} mesas</span></h2>
        <button onClick={onDelete} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
      </div>

      <div className="flex flex-wrap gap-2">
        {mesas.map((m) => (
          <div key={m.id} className="group relative grid h-16 w-16 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-center text-xs font-medium">
            <Armchair className="absolute right-1 top-1 h-3 w-3 text-slate-300" />
            {m.nombre}
            <button onClick={() => delMesa(m.id)} className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 place-items-center rounded-full bg-red-500 text-white group-hover:grid">×</button>
          </div>
        ))}
      </div>

      <form onSubmit={addMesa} className="mt-3 flex items-center gap-2">
        <input className="input w-40" placeholder="Mesa…" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <button className="btn-primary"><Plus className="h-4 w-4" /> Mesa</button>
        <button type="button" onClick={addVarias} className="btn-ghost">+ varias</button>
      </form>
    </div>
  );
}
