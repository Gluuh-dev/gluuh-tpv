"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Armchair } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

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
      <PageHeader
        title="Sala"
        description="Define tus salas y mesas. El TPV y la comandera trabajan sobre ellas."
        actions={
          <form onSubmit={addSala} className="flex gap-2">
            <Input className="w-48" placeholder="Nueva sala (Terraza…)" value={nuevaSala} onChange={(e) => setNuevaSala(e.target.value)} />
            <Button className="whitespace-nowrap"><Plus className="h-4 w-4" /> Sala</Button>
          </form>
        }
      />

      {rooms.length === 0 && (
        <EmptyState
          title="Sin salas todavía"
          description="Crea tu primera sala (p. ej. «Salón» o «Terraza») para añadir mesas."
        />
      )}

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
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">{room.nombre} <span className="text-muted-foreground">· {mesas.length} mesas</span></h2>
        <button onClick={onDelete} className="text-muted-foreground/60 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>

      <div className="flex flex-wrap gap-2">
        {mesas.map((m) => (
          <div key={m.id} className="group relative grid h-16 w-16 place-items-center rounded-xl border border-border bg-muted/40 text-center text-xs font-medium">
            <Armchair className="absolute right-1 top-1 h-3 w-3 text-muted-foreground/40" />
            {m.nombre}
            <button onClick={() => delMesa(m.id)} className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 place-items-center rounded-full bg-destructive text-white group-hover:grid">×</button>
          </div>
        ))}
      </div>

      <form onSubmit={addMesa} className="mt-3 flex items-center gap-2">
        <Input className="w-40" placeholder="Mesa…" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Button><Plus className="h-4 w-4" /> Mesa</Button>
        <Button type="button" variant="outline" onClick={addVarias}>+ varias</Button>
      </form>
    </Card>
  );
}
