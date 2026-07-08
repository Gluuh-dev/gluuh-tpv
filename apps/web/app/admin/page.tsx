"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Package, Users, MonitorSmartphone } from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { MODULOS, type DefModulo } from "../lib/modulos";
import { estadoSuscripcion, fechaCorta, type ResumenEmpresa } from "../lib/admin-empresas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Lead { id: string; nombre: string | null; email: string | null; telefono: string | null; mensaje: string | null; created_at: string }

// Módulos premium que se venden por licencia (marcados en lib/modulos.ts).
const MODULOS_PREMIUM = (Object.entries(MODULOS) as [string, DefModulo][])
  .filter(([, d]) => d.requiereLicencia)
  .map(([k, d]) => ({ k, nombre: d.nombre }));

export default function Admin() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [empresas, setEmpresas] = useState<ResumenEmpresa[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [f, setF] = useState({ empresa: "", usuario: "", emailContacto: "", cif: "", direccion: "", poblacion: "", provincia: "", codigoPostal: "", telefono: "", meses: "12", modulos: [] as string[], importar: ["catalogo", "impuestos", "formas_pago", "tickets"] as string[] });
  // El usuario se autogenera del nombre ("Bar Pepe" → barpepe) hasta que se toque a mano.
  const [usrManual, setUsrManual] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; x: string } | null>(null);
  // Pack de entrega del alta (usuario+password, código de instalación, clave técnica):
  // se enseña UNA vez en grande — la password no se vuelve a mostrar.
  const [alta, setAlta] = useState<{ codigo: string | null; clave: string | null; usuario: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function cargar() {
    const [{ data: e }, { data: l }] = await Promise.all([
      sb.rpc("admin_resumen_empresas"),
      sb.from("contact_request").select("id,nombre,email,telefono,mensaje,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    setEmpresas((e as ResumenEmpresa[]) ?? []);
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
            <CardHeader><CardTitle className="flex items-center gap-2 text-base">Empresas ({empresas.length})</CardTitle></CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Suscripción</TableHead><TableHead className="text-center">Prod.</TableHead><TableHead className="text-center">Usu.</TableHead><TableHead className="text-center">Disp.</TableHead></TableRow></TableHeader>
                <TableBody>
                  {empresas.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Aún no hay empresas. Crea la primera →</TableCell></TableRow>}
                  {empresas.map((e) => {
                    const sub = estadoSuscripcion(e.licencia_hasta);
                    return (
                      <TableRow key={e.id} className="cursor-pointer" onClick={() => router.push(`/admin/empresas/${e.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-2 font-medium">{e.nombre} {e.es_plantilla && <Badge variant="info">Plantilla</Badge>}</div>
                          <div className="text-[11px] text-muted-foreground">{e.codigo_instalacion ?? "sin código"}</div>
                        </TableCell>
                        <TableCell><Badge variant={sub.variant}>{sub.texto}</Badge> <span className="text-[11px] text-muted-foreground">{fechaCorta(e.licencia_hasta)}</span></TableCell>
                        <TableCell className="text-center tabular-nums text-muted-foreground"><Package className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />{e.n_productos}</TableCell>
                        <TableCell className="text-center tabular-nums text-muted-foreground"><Users className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />{e.n_usuarios}</TableCell>
                        <TableCell className="text-center tabular-nums text-muted-foreground"><MonitorSmartphone className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />{e.n_dispositivos_online}/{e.n_dispositivos}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="px-6 pt-2 text-[11px] text-muted-foreground">Pulsa una empresa para ver su ficha (suscripción, módulos, dispositivos y acciones).</p>
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
  );
}
