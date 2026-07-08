"use client";

import { useEffect, useState } from "react";
import { Building2, UserPlus, KeyRound } from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { MODULOS, type DefModulo } from "../lib/modulos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Empresa { id: string; nombre: string; plan: string; email_admin: string | null; created_at: string; codigo_instalacion: string | null; licencia_hasta: string | null }
interface Lead { id: string; nombre: string | null; email: string | null; telefono: string | null; mensaje: string | null; created_at: string }

// Módulos premium que se venden por licencia (marcados en lib/modulos.ts).
const MODULOS_PREMIUM = (Object.entries(MODULOS) as [string, DefModulo][])
  .filter(([, d]) => d.requiereLicencia)
  .map(([k, d]) => ({ k, nombre: d.nombre }));

export default function Admin() {
  const sb = supabaseBrowser();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [f, setF] = useState({ empresa: "", usuario: "", emailContacto: "", cif: "", direccion: "", poblacion: "", provincia: "", codigoPostal: "", telefono: "", meses: "12", modulos: [] as string[], importar: ["catalogo", "impuestos", "formas_pago", "tickets"] as string[] });
  // El usuario se autogenera del nombre ("Bar Pepe" → barpepe) hasta que se toque a mano.
  const [usrManual, setUsrManual] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; x: string } | null>(null);
  // Pack de entrega del alta (usuario+password, código de instalación, clave técnica):
  // se enseña UNA vez en grande — la password no se vuelve a mostrar.
  const [alta, setAlta] = useState<{ codigo: string | null; clave: string | null; usuario: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lic, setLic] = useState<{ tenantId: string; meses: string; modulos: string[] }>({ tenantId: "", meses: "12", modulos: [] });
  const [licBusy, setLicBusy] = useState(false);
  const [licCodigo, setLicCodigo] = useState<string | null>(null);
  const [licErr, setLicErr] = useState<string | null>(null);
  // Resultado de una acción de soporte sobre una empresa (reset pass / código / renovar).
  const [acc, setAcc] = useState<{ t: "ok" | "err"; x: string } | null>(null);

  async function cargar() {
    const [{ data: e }, { data: l }] = await Promise.all([
      sb.from("tenant").select("id,nombre,plan,email_admin,created_at,codigo_instalacion,licencia_hasta").order("created_at", { ascending: false }),
      sb.from("contact_request").select("id,nombre,email,telefono,mensaje,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    setEmpresas((e as Empresa[]) ?? []);
    setLeads((l as Lead[]) ?? []);
  }

  // La sesión y el gate es_admin_plataforma los resuelve la consola
  // (ConsolaPlataforma en admin/layout.tsx); aquí solo se cargan los datos.
  useEffect(() => { void cargar(); /* eslint-disable-next-line */ }, []);

  // "Bar Pepe" → "barpepe" (minúsculas, sin acentos, solo a-z0-9).
  const normalizarUsuario = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setAlta(null);
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch("/api/admin/crear-empresa", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ ...f, meses: Number(f.meses) }),
    });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg({ t: "err", x: out.error ?? "Error" }); return; }
    setMsg({ t: "ok", x: `Empresa "${f.empresa}" creada. Operarios sembrados: tecnico/1212 · admin/1111 · camarero/2222.` });
    setAlta({ codigo: out.codigoInstalacion ?? null, clave: out.claveTecnica ?? null, usuario: out.usuario ?? "", password: out.passwordInicial ?? "" });
    setF({ empresa: "", usuario: "", emailContacto: "", cif: "", direccion: "", poblacion: "", provincia: "", codigoPostal: "", telefono: "", meses: "12", modulos: [], importar: ["catalogo", "impuestos", "formas_pago", "tickets"] });
    setUsrManual(false);
    cargar();
  }

  const toggleMod = (k: string) => setLic((s) => ({
    ...s,
    modulos: s.modulos.includes(k) ? s.modulos.filter((m) => m !== k) : [...s.modulos, k],
  }));

  const toggleModAlta = (k: string) => setF((s) => ({
    ...s,
    modulos: s.modulos.includes(k) ? s.modulos.filter((m) => m !== k) : [...s.modulos, k],
  }));

  // Qué se importa de la plantilla base al crear la empresa.
  const IMPORTABLES = [
    { k: "catalogo", nombre: "Familias y productos" },
    { k: "impuestos", nombre: "Impuestos" },
    { k: "formas_pago", nombre: "Formas de pago" },
    { k: "tickets", nombre: "Plantillas de ticket" },
  ];
  const toggleImportar = (k: string) => setF((s) => ({
    ...s,
    importar: s.importar.includes(k) ? s.importar.filter((m) => m !== k) : [...s.importar, k],
  }));

  async function generarLicencia() {
    if (!lic.tenantId) { setLicErr("Elige una empresa."); return; }
    setLicBusy(true); setLicErr(null); setLicCodigo(null);
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch("/api/admin/generar-licencia", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ tenantId: lic.tenantId, meses: Number(lic.meses), modulos: lic.modulos }),
    });
    const out = await res.json();
    setLicBusy(false);
    if (!res.ok) { setLicErr(out.error ?? "Error"); return; }
    setLicCodigo(out.codigo);
  }

  // Acción de soporte sobre una empresa (reset password / regenerar código /
  // renovar licencia directa). Devuelve el dato sensible una sola vez.
  async function accionEmpresa(accion: string, tenantId: string, extra?: Record<string, unknown>) {
    setAcc(null);
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch("/api/admin/empresa", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ accion, tenantId, ...extra }),
    });
    const out = await res.json();
    if (!res.ok) { setAcc({ t: "err", x: out.error ?? "Error" }); return; }
    if (out.passwordInicial) setAcc({ t: "ok", x: `Nueva password (apúntala, la cambia al entrar): ${out.passwordInicial}` });
    else if (out.codigoInstalacion) setAcc({ t: "ok", x: `Nuevo código de instalación: ${out.codigoInstalacion}` });
    else if (out.licenciaHasta) setAcc({ t: "ok", x: `Licencia renovada hasta ${new Date(out.licenciaHasta).toLocaleDateString("es-ES")}` });
    else setAcc({ t: "ok", x: "Hecho." });
    cargar();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" /> Nueva empresa</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={crear} className="space-y-3">
                <div className="space-y-1.5"><Label>Nombre de la empresa</Label><Input required value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value, ...(usrManual ? {} : { usuario: normalizarUsuario(e.target.value) }) })} /></div>
                <div className="space-y-1.5">
                  <Label>Usuario de acceso (backoffice)</Label>
                  <Input required minLength={3} value={f.usuario} placeholder="barpepe"
                    onChange={(e) => { setUsrManual(true); setF({ ...f, usuario: normalizarUsuario(e.target.value) }); }} />
                  <p className="text-[11px] text-muted-foreground">Con él entra el cliente (sin email). La password inicial se genera sola y la cambia en su primer acceso.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Email de contacto <span className="text-muted-foreground">(opcional)</span></Label>
                  <Input type="email" value={f.emailContacto} onChange={(e) => setF({ ...f, emailContacto: e.target.value })} placeholder="avisos de caducidad — no es para entrar" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>CIF/NIF</Label><Input value={f.cif} onChange={(e) => setF({ ...f, cif: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Teléfono</Label><Input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5"><Label>Dirección</Label><Input value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5 col-span-2"><Label>Población</Label><Input value={f.poblacion} onChange={(e) => setF({ ...f, poblacion: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>C. P.</Label><Input value={f.codigoPostal} onChange={(e) => setF({ ...f, codigoPostal: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5"><Label>Provincia</Label><Input value={f.provincia} onChange={(e) => setF({ ...f, provincia: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>Duración de la licencia</Label>
                  <Select value={f.meses} onValueChange={(v) => setF({ ...f, meses: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">12 meses</SelectItem>
                      <SelectItem value="24">24 meses</SelectItem>
                      <SelectItem value="36">36 meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Módulos contratados</Label>
                  <div className="flex flex-wrap gap-2">
                    {MODULOS_PREMIUM.map(({ k, nombre }) => (
                      <label key={k} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
                        <input type="checkbox" checked={f.modulos.includes(k)} onChange={() => toggleModAlta(k)} className="accent-primary" />
                        {nombre}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Importar de la plantilla base</Label>
                  <div className="flex flex-wrap gap-2">
                    {IMPORTABLES.map(({ k, nombre }) => (
                      <label key={k} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
                        <input type="checkbox" checked={f.importar.includes(k)} onChange={() => toggleImportar(k)} className="accent-primary" />
                        {nombre}
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Se clona de «Plantilla base». Los usuarios (admin/camarero/técnico) y perfiles se crean siempre.</p>
                </div>
                <Button className="w-full" disabled={busy}>{busy ? "Creando…" : "Crear empresa"}</Button>
                {msg && <p className={`text-sm ${msg.t === "ok" ? "text-emerald-600" : "text-destructive"}`}>{msg.x}</p>}
                {alta && (
                  <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-4">
                    <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Pack de entrega — apúntalo, no se vuelve a mostrar</p>
                    <div className="grid gap-1 text-sm">
                      <p>Usuario backoffice: <span className="font-mono font-semibold">{alta.usuario}</span></p>
                      <p>Password inicial: <span className="font-mono font-semibold">{alta.password}</span> <span className="text-xs text-muted-foreground">(la cambia al entrar)</span></p>
                      {alta.codigo && <p>Código de instalación: <span className="font-mono font-semibold tracking-wider">{alta.codigo}</span></p>}
                      {alta.clave && <p>Clave técnica: <span className="font-mono font-semibold">{alta.clave}</span></p>}
                    </div>
                    <p className="text-center text-xs text-muted-foreground">El código activa cada equipo del cliente en /instalar; el usuario+password es su acceso al backoffice.</p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" /> Empresas ({empresas.length})</CardTitle></CardHeader>
            <CardContent className="px-0">
              {acc && <p className={`mx-6 mb-2 rounded-md px-3 py-2 text-sm ${acc.t === "ok" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>{acc.x}</p>}
              <Table>
                <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Contacto</TableHead><TableHead>Código de instalación</TableHead><TableHead>Licencia</TableHead><TableHead>Soporte</TableHead></TableRow></TableHeader>
                <TableBody>
                  {empresas.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.nombre}</TableCell>
                      <TableCell className="text-muted-foreground">{e.email_admin}</TableCell>
                      <TableCell className="font-mono text-xs">{e.codigo_instalacion ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.licencia_hasta ? `hasta ${new Date(e.licencia_hasta).toLocaleDateString("es-ES")}` : "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => accionEmpresa("reset-password", e.id)}>Reset pass</Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => accionEmpresa("regenerar-codigo", e.id)}>Código</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Generar licencia</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Select value={lic.tenantId} onValueChange={(v) => setLic({ ...lic, tenantId: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Elige empresa…" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Duración</Label>
                <Select value={lic.meses} onValueChange={(v) => setLic({ ...lic, meses: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12 meses</SelectItem>
                    <SelectItem value="24">24 meses</SelectItem>
                    <SelectItem value="36">36 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Módulos incluidos</Label>
              <div className="flex flex-wrap gap-2">
                {MODULOS_PREMIUM.map(({ k, nombre }) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
                    <input type="checkbox" checked={lic.modulos.includes(k)} onChange={() => toggleMod(k)} className="accent-primary" />
                    {nombre}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!lic.tenantId} onClick={() => accionEmpresa("renovar-licencia", lic.tenantId, { meses: Number(lic.meses), modulos: lic.modulos })}>Aplicar a la empresa</Button>
              <Button variant="outline" disabled={licBusy || !lic.tenantId} onClick={generarLicencia}>{licBusy ? "Generando…" : "Generar código canjeable"}</Button>
            </div>
            <p className="text-xs text-muted-foreground">«Aplicar» renueva la licencia al momento (el cliente no hace nada). «Código canjeable» genera un GLUH-… que el cliente activa en Módulos.</p>
            {licErr && <p className="text-sm text-destructive">{licErr}</p>}
            {licCodigo && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-center">
                <p className="font-mono text-2xl font-bold tracking-widest">{licCodigo}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Apúntalo y dáselo al cliente: lo activa en «Módulos». No se vuelve a mostrar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

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
  );
}
