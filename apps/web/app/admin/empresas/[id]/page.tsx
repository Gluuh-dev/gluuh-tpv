"use client";

// Ficha de empresa (consola de plataforma), pestaña general: uso a vistazo,
// acceso e instalación (password, código, límites, suspender) y dispositivos.
// La suscripción/facturación vive en ./suscripcion y el análisis en ./uso.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound, Package, Users, MonitorSmartphone, RefreshCw } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { accionEmpresa, buscarEmpresa, type ResumenEmpresa } from "@/app/lib/admin-empresas";
import { EncabezadoEmpresa } from "./encabezado";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Disp { id: string; nombre: string; tipo: string; modulo: string | null; vinculado_at: string | null; ultima_conexion: string | null; version: string | null }

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
  const [lim, setLim] = useState<{ dispositivos: string; usuarios: string }>({ dispositivos: "", usuarios: "" });
  // Orden de instalación (F3, 0116): el código en claro solo existe en esta
  // respuesta — se enseña una vez y no se vuelve a poder consultar (en BD vive
  // su hash). Un solo uso, ligada al local, caduca a los 30 días.
  const [orden, setOrden] = useState<string | null>(null);

  async function cargar() {
    const sb = supabaseBrowser();
    // El parámetro de la URL es el slug (o el UUID en enlaces antiguos).
    const { data: r } = await sb.rpc("admin_resumen_empresas");
    const fila = buscarEmpresa(((r as ResumenEmpresa[] | null) ?? []), id);
    setEmp(fila);
    if (!fila) { setCargando(false); return; }
    setLim({ dispositivos: fila.licencia_limites?.dispositivos ? String(fila.licencia_limites.dispositivos) : "", usuarios: fila.licencia_limites?.usuarios ? String(fila.licencia_limites.usuarios) : "" });
    const { data: d } = await sb.rpc("admin_dispositivos_empresa", { p_tenant: fila.id });
    setDisp((d as Disp[] | null) ?? []);
    setCargando(false);
  }
  useEffect(() => { void cargar();   }, [id]);

  async function accion(a: string, extra?: Record<string, unknown>) {
    setMsg(null);
    const r = await accionEmpresa(emp?.id ?? id, a, extra);
    setMsg({ t: r.ok ? "ok" : "err", x: r.msg });
    if (r.ok) cargar();
  }

  async function emitirOrden() {
    setMsg(null);
    const { data: { session } } = await supabaseBrowser().auth.getSession();
    const res = await fetch("/api/admin/orden-instalacion", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ tenant_id: emp?.id }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    if (!res?.ok) { setMsg({ t: "err", x: j?.error ?? "No se pudo emitir la orden" }); return; }
    setOrden(j.codigo as string);
    setMsg({ t: "ok", x: "Orden emitida: UN solo uso, caduca en 30 días. Cópiala ahora — no se puede volver a consultar." });
  }

  if (cargando) return <div className="grid h-64 place-items-center text-muted-foreground">Cargando…</div>;
  if (!emp) return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Empresas</Link>
      <p className="rounded-lg border border-border bg-surface p-6 text-center text-muted-foreground">No se encontró la empresa.</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <EncabezadoEmpresa emp={emp} tab="ficha" />

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
              <Button size="sm" onClick={emitirOrden}>Emitir orden de instalación</Button>
            </div>
          </div>
          {orden && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Orden de instalación (un solo uso · 30 días · solo se muestra ahora)</div>
              <div className="select-all font-mono text-lg font-semibold tracking-wider">{orden}</div>
            </div>
          )}
          {emp.email_admin && <p className="text-[12px] text-muted-foreground">Contacto: {emp.email_admin}</p>}

          {/* Límites: 0/vacío = sin límite. El uso actual se ve arriba. */}
          <div className="grid gap-3 border-t border-border-muted pt-3 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">Límite de dispositivos ({emp.n_dispositivos} usados)</Label>
              <Input type="number" min={0} value={lim.dispositivos} onChange={(e) => setLim((s) => ({ ...s, dispositivos: e.target.value }))} placeholder="sin límite" /></div>
            <div className="space-y-1"><Label className="text-xs">Límite de usuarios ({emp.n_usuarios} usados)</Label>
              <Input type="number" min={0} value={lim.usuarios} onChange={(e) => setLim((s) => ({ ...s, usuarios: e.target.value }))} placeholder="sin límite" /></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => accion("limites", { dispositivos: Number(lim.dispositivos) || 0, usuarios: Number(lim.usuarios) || 0 })}>Guardar límites</Button>
            <Button size="sm" variant={emp.activo ? "outline" : "default"} className={emp.activo ? "text-destructive" : ""}
              onClick={() => accion("suspender", { activo: !emp.activo })}>
              {emp.activo ? "Suspender empresa" : "Reactivar empresa"}
            </Button>
          </div>
          {!emp.activo && <p className="text-[12px] text-amber-500">Suspendida: los operarios no pueden entrar y no se activan equipos nuevos.</p>}
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
