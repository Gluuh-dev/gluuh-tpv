"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";

interface Empleado { id: string; nombre: string; email: string | null; rol: string; activo: boolean }

const ROLES = [
  { v: "CAMARERO", t: "Camarero/a" },
  { v: "COCINA", t: "Cocina" },
  { v: "ENCARGADO", t: "Encargado/a" },
];

export default function Empleados() {
  const sb = supabaseBrowser();
  const [lista, setLista] = useState<Empleado[]>([]);
  const [form, setForm] = useState({ nombre: "", email: "", rol: "CAMARERO", pin: "" });
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; txt: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    const { data } = await sb.from("app_user").select("id,nombre,email,rol,activo").order("nombre");
    setLista((data as Empleado[]) ?? []);
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMsg(null);
    const { error } = await sb.rpc("crear_empleado", {
      p_nombre: form.nombre, p_email: form.email, p_rol: form.rol, p_pin: form.pin,
    });
    setGuardando(false);
    if (error) { setMsg({ tipo: "error", txt: error.message }); return; }
    setMsg({ tipo: "ok", txt: `Empleado "${form.nombre}" creado con su PIN.` });
    setForm({ nombre: "", email: "", rol: "CAMARERO", pin: "" });
    cargar();
  }

  async function toggle(emp: Empleado) {
    await sb.from("app_user").update({ activo: !emp.activo }).eq("id", emp.id);
    cargar();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Empleados"
        description="Crea camareros y cocina con su PIN. Cada acción quedará registrada a su nombre."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista */}
        <Card className="lg:col-span-2">
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Nombre</TableHead><TableHead>Rol</TableHead><TableHead>Estado</TableHead><TableHead></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {lista.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Aún no hay empleados. Crea el primero →</TableCell></TableRow>}
                {lista.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell><div className="font-medium">{emp.nombre}</div>{emp.email && <div className="text-xs text-muted-foreground">{emp.email}</div>}</TableCell>
                    <TableCell><Badge variant="secondary">{emp.rol}</Badge></TableCell>
                    <TableCell>{emp.activo ? <span className="text-emerald-600">Activo</span> : <span className="text-muted-foreground">Inactivo</span>}</TableCell>
                    <TableCell className="text-right"><button onClick={() => toggle(emp)} className="text-xs text-primary hover:underline">{emp.activo ? "Desactivar" : "Activar"}</button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Alta */}
        <Card className="self-start">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" /> Nuevo empleado</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={crear}>
              <div className="space-y-1.5"><Label>Nombre</Label><Input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ana García" /></div>
              <div className="space-y-1.5"><Label>Email (opcional)</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Rol</Label>
                <Select value={form.rol} onValueChange={(v) => setForm({ ...form, rol: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r.v} value={r.v}>{r.t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>PIN (4+ dígitos)</Label><Input required minLength={4} inputMode="numeric" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} placeholder="1234" /></div>
              <Button className="w-full" disabled={guardando}>{guardando ? "Creando…" : "Crear empleado"}</Button>
              {msg && <p className={`text-sm ${msg.tipo === "ok" ? "text-emerald-600" : "text-destructive"}`}>{msg.txt}</p>}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
