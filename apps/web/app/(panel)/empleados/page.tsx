"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

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
      <div>
        <h1 className="text-2xl font-semibold">Empleados</h1>
        <p className="text-slate-500">Crea camareros y cocina con su PIN. Cada acción quedará registrada a su nombre.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista */}
        <div className="card lg:col-span-2 overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr><th className="px-4 py-3 font-medium">Nombre</th><th className="px-4 py-3 font-medium">Rol</th><th className="px-4 py-3 font-medium">Estado</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Aún no hay empleados. Crea el primero →</td></tr>}
              {lista.map((emp) => (
                <tr key={emp.id}>
                  <td className="px-4 py-3"><div className="font-medium">{emp.nombre}</div>{emp.email && <div className="text-xs text-slate-400">{emp.email}</div>}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{emp.rol}</span></td>
                  <td className="px-4 py-3">{emp.activo ? <span className="text-emerald-600">Activo</span> : <span className="text-slate-400">Inactivo</span>}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => toggle(emp)} className="text-xs text-brand-600 hover:underline">{emp.activo ? "Desactivar" : "Activar"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Alta */}
        <form className="card space-y-3 self-start" onSubmit={crear}>
          <h2 className="flex items-center gap-2 font-medium"><UserPlus className="h-4 w-4" /> Nuevo empleado</h2>
          <div><label className="label">Nombre</label><input className="input" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ana García" /></div>
          <div><label className="label">Email (opcional)</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Rol</label><select className="input" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>{ROLES.map((r) => <option key={r.v} value={r.v}>{r.t}</option>)}</select></div>
          <div><label className="label">PIN (4+ dígitos)</label><input className="input" required minLength={4} inputMode="numeric" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} placeholder="1234" /></div>
          <button className="btn-primary w-full" disabled={guardando}>{guardando ? "Creando…" : "Crear empleado"}</button>
          {msg && <p className={`text-sm ${msg.tipo === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.txt}</p>}
        </form>
      </div>
    </div>
  );
}
