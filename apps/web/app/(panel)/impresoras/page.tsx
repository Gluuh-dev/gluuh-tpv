"use client";

// Impresoras y enrutado (guía 15 §6). Se declaran las impresoras del local una
// vez; el equipo con cada una la despacha desde la cola print_job. El enrutado
// (estación × zona → impresora) decide qué sale por dónde en cada barra.
//   · impresoras: CRUD sobre printer + "Probar" (encola un print_job de test)
//   · enrutado:   CRUD sobre print_route (estación + zona → impresora)
import { useEffect, useState } from "react";
import { Printer as PrinterIcon, UserPlus, X, Trash2, Play } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { ESTACIONES, ESTACION_LABEL, type Estacion } from "../../lib/estaciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Printer {
  id: string; nombre: string; rol: string; transporte: string; destino: string | null;
  ancho: number; tipo: string; device_id: string | null; activa: boolean;
}
interface Ruta { id: string; estacion: string; room_id: string | null; printer_id: string }
interface Dispositivo { id: string; nombre: string }
interface Zona { id: string; nombre: string }

const ROLES = [
  { v: "TICKETS", t: "Tickets (cobro)" },
  { v: "COCINA", t: "Cocina" },
  { v: "BARRA", t: "Barra" },
  { v: "ETIQUETAS", t: "Etiquetas" },
];
const rolT = (v: string) => ROLES.find((r) => r.v === v)?.t ?? v;
const CUALQUIERA = "__cualquiera__";
const NINGUNO = "__ninguno__";
const ESTAC = ESTACIONES.filter((e) => e !== "NINGUNA");

type Borrador = { nombre: string; rol: string; transporte: string; destino: string; ancho: number; tipo: string; device_id: string | null; activa: boolean };
const NUEVO: Borrador = { nombre: "", rol: "TICKETS", transporte: "RED", destino: "", ancho: 48, tipo: "EPSON", device_id: null, activa: true };
type Editor = { modo: "alta" } | { modo: "editar"; id: string };

function Switch({ checked, onChange, label }: Readonly<{ checked: boolean; onChange(): void; label: string }>) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} onClick={onChange}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${checked ? "bg-brand" : "bg-muted"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function Impresoras() {
  const sb = supabaseBrowser();
  const [lista, setLista] = useState<Printer[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [b, setB] = useState<Borrador>(NUEVO);
  const [guardando, setGuardando] = useState(false);
  const [rutaNueva, setRutaNueva] = useState<{ estacion: string; room_id: string; printer_id: string }>({ estacion: "COCINA", room_id: CUALQUIERA, printer_id: "" });

  async function cargar() {
    const [{ data: p }, { data: r }, { data: d }, { data: z }] = await Promise.all([
      sb.from("printer").select("id,nombre,rol,transporte,destino,ancho,tipo,device_id,activa").order("nombre"),
      sb.from("print_route").select("id,estacion,room_id,printer_id"),
      sb.from("device").select("id,nombre").order("nombre"),
      sb.from("room").select("id,nombre").order("orden"),
    ]);
    setLista((p as Printer[]) ?? []);
    setRutas((r as Ruta[]) ?? []);
    setDispositivos((d as Dispositivo[]) ?? []);
    setZonas((z as Zona[]) ?? []);
  }
  useEffect(() => { void cargar(); /* eslint-disable-next-line */ }, []);

  const emp = editor?.modo === "editar" ? lista.find((e) => e.id === editor.id) ?? null : null;
  const nombreImp = (id: string) => lista.find((p) => p.id === id)?.nombre ?? "—";
  const nombreZona = (id: string | null) => (id ? zonas.find((z) => z.id === id)?.nombre ?? "—" : "Cualquiera");

  function abrirAlta() { setB(NUEVO); setEditor({ modo: "alta" }); }
  function abrirEditar(p: Printer) {
    setB({ nombre: p.nombre, rol: p.rol, transporte: p.transporte, destino: p.destino ?? "", ancho: p.ancho, tipo: p.tipo, device_id: p.device_id, activa: p.activa });
    setEditor({ modo: "editar", id: p.id });
  }
  function cerrar() { setEditor(null); }

  async function guardar() {
    if (!editor) return;
    if (!b.nombre.trim()) { toast.error("El nombre es obligatorio."); return; }
    setGuardando(true);
    const fila = { nombre: b.nombre.trim(), rol: b.rol, transporte: b.transporte, destino: b.destino.trim() || null, ancho: b.ancho, tipo: b.tipo, device_id: b.device_id, activa: b.activa };
    const { error } = editor.modo === "alta"
      ? await sb.from("printer").insert(fila)
      : await sb.from("printer").update(fila).eq("id", editor.id);
    setGuardando(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editor.modo === "alta" ? "Impresora añadida." : "Cambios guardados.");
    await cargar(); cerrar();
  }

  async function eliminar(p: Printer) {
    const { error } = await sb.from("printer").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    setLista((prev) => prev.filter((x) => x.id !== p.id));
  }

  // Encola un ticket de prueba para esa impresora (lo despacha el equipo que la
  // tiene; en navegador puro queda ENCOLADO hasta que un Desktop lo recoja).
  async function probar(p: Printer) {
    const payload = { lineas: ["*** PRUEBA GLUUH ***", p.nombre, new Date().toLocaleString("es-ES"), "", "Si lees esto, imprime bien.", ""], cortar: true };
    const { error } = await sb.from("print_job").insert({ printer_id: p.id, payload, estado: "ENCOLADO" });
    if (error) { toast.error(error.message); return; }
    toast.success(`Prueba encolada para «${p.nombre}».`);
  }

  async function anadirRuta() {
    if (!rutaNueva.printer_id) { toast.error("Elige una impresora."); return; }
    const { error } = await sb.from("print_route").insert({
      estacion: rutaNueva.estacion,
      room_id: rutaNueva.room_id === CUALQUIERA ? null : rutaNueva.room_id,
      printer_id: rutaNueva.printer_id,
    });
    if (error) { toast.error(error.message); return; }
    setRutaNueva({ estacion: "COCINA", room_id: CUALQUIERA, printer_id: "" });
    await cargar();
  }
  async function borrarRuta(id: string) {
    const { error } = await sb.from("print_route").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRutas((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Impresoras"
        description="Las impresoras del local y qué sale por cada una. Cualquier terminal imprime en cualquier impresora vía la cola compartida."
        actions={<Button onClick={abrirAlta}><UserPlus aria-hidden /> Nueva impresora</Button>}
      />

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead><TableHead>Rol</TableHead><TableHead>Conexión</TableHead>
              <TableHead>Despacha</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Aún no hay impresoras. Añade la primera con «Nueva impresora».</TableCell></TableRow>
            )}
            {lista.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => abrirEditar(p)}>
                <TableCell className="font-medium">{p.nombre}</TableCell>
                <TableCell><Badge variant="secondary">{rolT(p.rol)}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{p.transporte === "RED" ? (p.destino || "IP sin fijar") : "USB"}</TableCell>
                <TableCell className="text-muted-foreground">{p.device_id ? (dispositivos.find((d) => d.id === p.device_id)?.nombre ?? "—") : "cualquiera"}</TableCell>
                <TableCell><Badge variant={p.activa ? "success" : "secondary"}>{p.activa ? "Activa" : "Inactiva"}</Badge></TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" className="h-7 px-2" title="Imprimir prueba" onClick={() => void probar(p)}><Play className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" title="Eliminar" onClick={() => void eliminar(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Enrutado: estación × zona → impresora */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PrinterIcon className="h-4 w-4" aria-hidden /> Enrutado por barra</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[13px] text-muted-foreground">Qué impresora recibe cada estación según la zona de la mesa. Sin regla para una estación, cae en la impresora por defecto de ese rol.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label className="text-xs">Estación</Label>
              <Select value={rutaNueva.estacion} onValueChange={(v) => setRutaNueva((s) => ({ ...s, estacion: v }))}>
                <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{ESTAC.map((e) => <SelectItem key={e} value={e}>{ESTACION_LABEL[e as Estacion]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Zona</Label>
              <Select value={rutaNueva.room_id} onValueChange={(v) => setRutaNueva((s) => ({ ...s, room_id: v }))}>
                <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={CUALQUIERA}>Cualquier zona</SelectItem>
                  {zonas.map((z) => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Impresora</Label>
              <Select value={rutaNueva.printer_id} onValueChange={(v) => setRutaNueva((s) => ({ ...s, printer_id: v }))}>
                <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Elige…" /></SelectTrigger>
                <SelectContent>{lista.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="h-9" onClick={() => void anadirRuta()}>Añadir regla</Button>
          </div>

          {rutas.length > 0 && (
            <div className="divide-y divide-border-muted rounded-md border border-border">
              {rutas.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                  <span><Badge variant="secondary">{ESTACION_LABEL[r.estacion as Estacion] ?? r.estacion}</Badge> en <strong>{nombreZona(r.room_id)}</strong> → {nombreImp(r.printer_id)}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => void borrarRuta(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel lateral de alta/edición de impresora */}
      {editor && (editor.modo === "alta" || emp) && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={cerrar} aria-hidden="true" />
          <aside role="dialog" aria-modal="true" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background">
            <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-3">
              <span className="flex-1 truncate text-[13px] font-semibold">{editor.modo === "alta" ? "Nueva impresora" : emp!.nombre}</span>
              <button type="button" onClick={cerrar} aria-label="Cerrar" className="grid h-7 w-7 place-items-center rounded text-foreground/80 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="space-y-1.5"><Label>Nombre</Label><Input value={b.nombre} onChange={(e) => setB({ ...b, nombre: e.target.value })} placeholder="Barra 1 / Cocina" /></div>
              <div className="space-y-1.5"><Label>Rol</Label>
                <Select value={b.rol} onValueChange={(v) => setB({ ...b, rol: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r.v} value={r.v}>{r.t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Conexión</Label>
                  <Select value={b.transporte} onValueChange={(v) => setB({ ...b, transporte: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="RED">Red (IP)</SelectItem><SelectItem value="USB">USB</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Ancho</Label>
                  <Select value={String(b.ancho)} onValueChange={(v) => setB({ ...b, ancho: Number(v) })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="48">80 mm (48)</SelectItem><SelectItem value="32">58 mm (32)</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{b.transporte === "RED" ? "IP y puerto" : "Ruta/ID USB"}</Label>
                <Input value={b.destino} onChange={(e) => setB({ ...b, destino: e.target.value })} placeholder={b.transporte === "RED" ? "192.168.1.201:9100" : "USB001 / nombre del sistema"} />
              </div>
              <div className="space-y-1.5"><Label>Marca</Label>
                <Select value={b.tipo} onValueChange={(v) => setB({ ...b, tipo: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="EPSON">Epson (ESC/POS)</SelectItem><SelectItem value="STAR">Star</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Equipo que la despacha</Label>
                <Select value={b.device_id ?? NINGUNO} onValueChange={(v) => setB({ ...b, device_id: v === NINGUNO ? null : v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Cualquiera / el principal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NINGUNO}>Cualquiera (el equipo principal)</SelectItem>
                    {dispositivos.map((d) => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">USB: el equipo donde está enchufada. Red: normalmente el principal.</p>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                <Label className="text-[13px]">Impresora activa</Label>
                <Switch checked={b.activa} onChange={() => setB({ ...b, activa: !b.activa })} label="Activar / desactivar" />
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border p-3">
              <Button variant="ghost" size="sm" onClick={cerrar}>Cerrar</Button>
              <Button size="sm" disabled={guardando} onClick={() => void guardar()}>{guardando ? "Guardando…" : editor.modo === "alta" ? "Añadir" : "Guardar"}</Button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
