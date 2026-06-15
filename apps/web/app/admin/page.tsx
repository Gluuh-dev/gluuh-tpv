"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, UserPlus, LogOut } from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  if (estado === "cargando") return <div className="grid min-h-screen place-items-center text-muted-foreground">Cargando…</div>;
  if (estado === "no-auth") return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <Card className="max-w-sm p-6"><h1 className="text-lg font-semibold">Acceso restringido</h1><p className="mt-2 text-muted-foreground">Esta zona es solo para el administrador de Gluuh.</p><Button className="mt-4" onClick={() => router.replace("/login")}>Iniciar sesión</Button></Card>
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-3">
        <div className="flex items-center gap-2 font-semibold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 font-bold text-white">G</span> Gluuh · Administración de plataforma</div>
        <Button variant="ghost" onClick={async () => { await sb.auth.signOut(); router.replace("/login"); }}><LogOut className="h-4 w-4" /> Salir</Button>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" /> Nueva empresa</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={crear} className="space-y-3">
                <div className="space-y-1.5"><Label>Nombre de la empresa</Label><Input required value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Email de acceso</Label><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Contraseña inicial</Label><PasswordInput required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
                <Button className="w-full" disabled={busy}>{busy ? "Creando…" : "Crear empresa"}</Button>
                {msg && <p className={`text-sm ${msg.t === "ok" ? "text-emerald-600" : "text-destructive"}`}>{msg.x}</p>}
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" /> Empresas ({empresas.length})</CardTitle></CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Acceso</TableHead><TableHead>Plan</TableHead><TableHead>Alta</TableHead></TableRow></TableHeader>
                <TableBody>
                  {empresas.map((e) => (
                    <TableRow key={e.id}><TableCell className="font-medium">{e.nombre}</TableCell><TableCell className="text-muted-foreground">{e.email_admin}</TableCell><TableCell>{e.plan}</TableCell><TableCell className="text-muted-foreground">{new Date(e.created_at).toLocaleDateString("es-ES")}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Solicitudes de acceso ({leads.length})</CardTitle></CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Contacto</TableHead><TableHead>Mensaje</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader>
              <TableBody>
                {leads.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Sin solicitudes.</TableCell></TableRow>}
                {leads.map((l) => (
                  <TableRow key={l.id}><TableCell>{l.nombre}</TableCell><TableCell className="text-muted-foreground">{l.email} {l.telefono}</TableCell><TableCell>{l.mensaje}</TableCell><TableCell className="text-muted-foreground">{new Date(l.created_at).toLocaleDateString("es-ES")}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
