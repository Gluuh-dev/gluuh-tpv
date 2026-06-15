"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, UserPlus, LogOut } from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

interface Empresa { id: string; nombre: string; plan: string; email_admin: string | null; created_at: string }
interface Lead { id: string; nombre: string | null; email: string | null; telefono: string | null; mensaje: string | null; created_at: string }

export default function Admin() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [estado, setEstado] = useState<"cargando" | "no-auth" | "ok">("cargando");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [f, setF] = useState({ empresa: "", email: "", password: "" });
  const [msg, setMsg] = useState<{ t: "ok" | "err"; x: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function cargar() {
    const [{ data: e }, { data: l }] = await Promise.all([
      sb.from("tenant").select("id,nombre,plan,email_admin,created_at").order("created_at", { ascending: false }),
      sb.from("contact_request").select("id,nombre,email,telefono,mensaje,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    setEmpresas((e as Empresa[]) ?? []);
    setLeads((l as Lead[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data: esAdmin } = await sb.rpc("es_admin_plataforma");
      if (!esAdmin) { setEstado("no-auth"); return; }
      await cargar();
      setEstado("ok");
    })();
    /* eslint-disable-next-line */
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch("/api/admin/crear-empresa", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(f),
    });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg({ t: "err", x: out.error ?? "Error" }); return; }
    setMsg({ t: "ok", x: `Empresa "${f.empresa}" creada. Comparte el acceso: ${f.email}` });
    setF({ empresa: "", email: "", password: "" });
    cargar();
  }

  if (estado === "cargando") return <div className="grid min-h-screen place-items-center text-slate-500">Cargando…</div>;
  if (estado === "no-auth") return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div className="card max-w-sm"><h1 className="text-lg font-semibold">Acceso restringido</h1><p className="mt-2 text-slate-500">Esta zona es solo para el administrador de Gluuh.</p><a href="/login" className="btn-primary mt-4 inline-flex">Iniciar sesión</a></div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2 font-semibold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 font-bold text-white">G</span> Gluuh · Administración de plataforma</div>
        <button className="btn-ghost" onClick={async () => { await sb.auth.signOut(); router.replace("/login"); }}><LogOut className="h-4 w-4" /> Salir</button>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <form onSubmit={crear} className="card space-y-3">
            <h2 className="flex items-center gap-2 font-medium"><UserPlus className="h-4 w-4" /> Nueva empresa</h2>
            <div><label className="label">Nombre de la empresa</label><input className="input" required value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value })} /></div>
            <div><label className="label">Email de acceso</label><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div><label className="label">Contraseña inicial</label><input className="input" required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
            <button className="btn-primary w-full" disabled={busy}>{busy ? "Creando…" : "Crear empresa"}</button>
            {msg && <p className={`text-sm ${msg.t === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.x}</p>}
          </form>

          <div className="card lg:col-span-2 overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 font-medium"><Building2 className="h-4 w-4" /> Empresas ({empresas.length})</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-2 font-medium">Empresa</th><th className="px-4 py-2 font-medium">Acceso</th><th className="px-4 py-2 font-medium">Plan</th><th className="px-4 py-2 font-medium">Alta</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {empresas.map((e) => (
                  <tr key={e.id}><td className="px-4 py-2">{e.nombre}</td><td className="px-4 py-2 text-slate-500">{e.email_admin}</td><td className="px-4 py-2">{e.plan}</td><td className="px-4 py-2 text-slate-400">{new Date(e.created_at).toLocaleDateString("es-ES")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="border-b border-slate-100 px-4 py-3 font-medium">Solicitudes de acceso ({leads.length})</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-2 font-medium">Nombre</th><th className="px-4 py-2 font-medium">Contacto</th><th className="px-4 py-2 font-medium">Mensaje</th><th className="px-4 py-2 font-medium">Fecha</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {leads.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Sin solicitudes.</td></tr>}
              {leads.map((l) => (
                <tr key={l.id}><td className="px-4 py-2">{l.nombre}</td><td className="px-4 py-2 text-slate-500">{l.email} {l.telefono}</td><td className="px-4 py-2">{l.mensaje}</td><td className="px-4 py-2 text-slate-400">{new Date(l.created_at).toLocaleDateString("es-ES")}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
