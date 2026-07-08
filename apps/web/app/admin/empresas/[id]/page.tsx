"use client";

// Ficha de empresa (consola de plataforma). Todo lo de una empresa en un sitio:
// datos, suscripción/caducidad, módulos, uso (productos/usuarios/dispositivos),
// dispositivos vinculados y acciones de soporte (reset password, renovar
// licencia, regenerar código de instalación). Reusa /api/admin/empresa.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, KeyRound, Package, Users, MonitorSmartphone, Puzzle, CreditCard, RefreshCw } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { MODULOS, type DefModulo } from "@/app/lib/modulos";
import { estadoSuscripcion, fechaCorta, type ResumenEmpresa } from "@/app/lib/admin-empresas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Disp { id: string; nombre: string; tipo: string; modulo: string | null; vinculado_at: string | null; ultima_conexion: string | null; version: string | null }
const MODULOS_PREMIUM = (Object.entries(MODULOS) as [string, DefModulo][]).filter(([, d]) => d.requiereLicencia).map(([k, d]) => ({ k, nombre: d.nombre }));
const nombreModulo = (k: string) => (MODULOS as Record<string, DefModulo>)[k]?.nombre ?? k;

function online(iso: string | null): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() < 180_000;
}
function haceCuanto(iso: string | null): string {
  if (!iso) return "nunca";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 3) return "en línea";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
}

export default function FichaEmpresa() {
  const { id } = useParams<{ id: string }>();
  const [emp, setEmp] = useState<ResumenEmpresa | null>(null);
  const [disp, setDisp] = useState<Disp[]>([]);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; x: string } | null>(null);
  const [ren, setRen] = useState<{ meses: string; modulos: string[] }>({ meses: "12", modulos: [] });

  async function cargar() {
    const sb = supabaseBrowser();
    const [{ data: r }, { data: d }] = await Promise.all([
      sb.rpc("admin_resumen_empresas"),
      sb.rpc("admin_dispositivos_empresa", { p_tenant: id }),
    ]);
    const fila = ((r as ResumenEmpresa[] | null) ?? []).find((e) => e.id === id) ?? null;
    setEmp(fila);
    if (fila) setRen({ meses: "12", modulos: fila.licencia_modulos ?? [] });
    setDisp((d as Disp[] | null) ?? []);
    setCargando(false);
  }
  useEffect(() => { void cargar(); /* eslint-disable-next-line */ }, [id]);

  async function accion(accion: string, extra?: Record<string, unknown>) {
    setMsg(null);
    const { data: { session } } = await supabaseBrowser().auth.getSession();
    const res = await fetch("/api/admin/empresa", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ accion, tenantId: id, ...extra }),
    });
    const out = await res.json();
    if (!res.ok) { setMsg({ t: "err", x: out.error ?? "Error" }); return; }
    if (out.passwordInicial) setMsg({ t: "ok", x: `Nueva password (apúntala): ${out.passwordInicial}` });
    else if (out.codigoInstalacion) setMsg({ t: "ok", x: `Nuevo código de instalación: ${out.codigoInstalacion}` });
    else if (out.licenciaHasta) setMsg({ t: "ok", x: `Licencia renovada hasta ${fechaCorta(out.licenciaHasta)}` });
    else setMsg({ t: "ok", x: "Hecho." });
    cargar();
  }

  const toggleMod = (k: string) => setRen((s) => ({ ...s, modulos: s.modulos.includes(k) ? s.modulos.filter((m) => m !== k) : [...s.modulos, k] }));

  if (cargando) return <div className="grid h-64 place-items-center text-muted-foreground">Cargando…</div>;
  if (!emp) return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Empresas</Link>
      <p className="rounded-lg border border-border bg-surface p-6 text-center text-muted-foreground">No se encontró la empresa.</p>
    </div>
  );

  const sub = estadoSuscripcion(emp.licencia_hasta);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Empresas</Link>

      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-surface-muted"><Building2 className="h-5 w-5 text-muted-foreground" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">{emp.nombre} {emp.es_plantilla && <Badge variant="info">Plantilla</Badge>}</h1>
          <p className="text-[13px] text-muted-foreground">{emp.cif ? `CIF ${emp.cif} · ` : ""}Alta {fechaCorta(emp.created_at)}</p>
        </div>
        <Badge variant={sub.variant}>{sub.texto}</Badge>
      </div>

      {msg && <p className={`rounded-md px-3 py-2 text-sm ${msg.t === "ok" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>{msg.x}</p>}

      {/* Uso */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Package, l: "Productos", v: emp.n_productos },
          { icon: Users, l: "Usuarios", v: emp.n_usuarios },
          { icon: MonitorSmartphone, l: "Dispositivos", v: `${emp.n_dispositivos_online}/${emp.n_dispositivos}`, sub: "en línea/total" },
        ].map((x) => (
          <div key={x.l} className="rounded-lg border border-border bg-surface p-3.5">
            <x.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
            <div className="mt-1.5 text-2xl font-semibold tabular-nums">{x.v}</div>
            <div className="text-[11px] text-muted-foreground">{x.sub ?? x.l}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Suscripción */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4" aria-hidden /> Suscripción</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">Caduca</span>
              <span className={`font-medium ${sub.variant === "destructive" ? "text-destructive" : sub.variant === "warning" ? "text-amber-500" : ""}`}>{fechaCorta(emp.licencia_hasta)}</span>
            </div>
            <div className="space-y-2 border-t border-border-muted pt-3">
              <Label className="text-xs">Renovar / cambiar</Label>
              <div className="flex items-center gap-2">
                <Select value={ren.meses} onValueChange={(v) => setRen((s) => ({ ...s, meses: v }))}>
                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="12">12 meses</SelectItem><SelectItem value="24">24 meses</SelectItem><SelectItem value="36">36 meses</SelectItem></SelectContent>
                </Select>
                <Button size="sm" onClick={() => accion("renovar-licencia", { meses: Number(ren.meses), modulos: ren.modulos })}>Aplicar</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Módulos */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Puzzle className="h-4 w-4" aria-hidden /> Módulos contratados</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {MODULOS_PREMIUM.map(({ k, nombre }) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-[13px]">
                  <input type="checkbox" checked={ren.modulos.includes(k)} onChange={() => toggleMod(k)} className="accent-primary" />
                  {nombre}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Marca y pulsa «Aplicar» en Suscripción para guardarlos.</p>
            {emp.licencia_modulos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {emp.licencia_modulos.map((m) => <Badge key={m} variant="success">{nombreModulo(m)}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Acceso */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" aria-hidden /> Acceso e instalación</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Código de instalación</div>
              <div className="font-mono font-semibold tracking-wider">{emp.codigo_instalacion ?? "—"}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => accion("reset-password")}>Resetear password</Button>
              <Button size="sm" variant="outline" onClick={() => accion("regenerar-codigo")}><RefreshCw className="h-3.5 w-3.5" /> Nuevo código</Button>
            </div>
          </div>
          {emp.email_admin && <p className="text-[12px] text-muted-foreground">Contacto: {emp.email_admin}</p>}
        </CardContent>
      </Card>

      {/* Dispositivos */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MonitorSmartphone className="h-4 w-4" aria-hidden /> Dispositivos ({disp.length})</CardTitle></CardHeader>
        <CardContent className="px-0">
          {disp.length === 0 ? (
            <p className="px-6 py-3 text-[13px] text-muted-foreground">Sin dispositivos vinculados.</p>
          ) : (
            <div className="divide-y divide-border-muted">
              {disp.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 px-6 py-2.5 text-[13px]">
                  <div className="min-w-0">
                    <div className="font-medium">{d.nombre} <span className="text-[11px] font-normal text-muted-foreground">{d.modulo ?? d.tipo}</span></div>
                    <div className="text-[11px] text-muted-foreground">{d.version ? `v${d.version} · ` : ""}{haceCuanto(d.ultima_conexion)}</div>
                  </div>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${online(d.ultima_conexion) ? "bg-emerald-500" : "bg-border-strong"}`} title={online(d.ultima_conexion) ? "En línea" : "Desconectado"} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
