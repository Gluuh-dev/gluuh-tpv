"use client";

// Pestaña Suscripción de la empresa (consola de plataforma): licencia y
// renovación, módulos contratados, mensual calculado con desglose, ciclo y
// forma de pago, registrar pagos e historial. Solo suscripción; el resto de
// la empresa vive en la ficha (../) y el análisis en ../uso.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CreditCard, Puzzle } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { MODULOS, type DefModulo } from "@/app/lib/modulos";
import { accionEmpresa, buscarEmpresa, estadoSuscripcion, fechaCorta, type ResumenEmpresa } from "@/app/lib/admin-empresas";
import { EncabezadoEmpresa } from "../encabezado";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eur } from "@/app/lib/money";

interface Disp { id: string; tipo: string; vinculado_at: string | null }
const MODULOS_PREMIUM = (Object.entries(MODULOS) as [string, DefModulo][]).filter(([, d]) => d.requiereLicencia).map(([k, d]) => ({ k, nombre: d.nombre }));
const nombreModulo = (k: string) => (MODULOS as Record<string, DefModulo>)[k]?.nombre ?? k;
const CICLOS = [{ v: "MENSUAL", t: "Mensual" }, { v: "TRIMESTRAL", t: "Trimestral" }, { v: "ANUAL", t: "Anual" }];
const FORMAS = [{ v: "TRANSFERENCIA", t: "Transferencia" }, { v: "EFECTIVO", t: "Efectivo" }, { v: "DOMICILIADO", t: "Domiciliado" }, { v: "STRIPE", t: "Stripe (próximamente)" }];

export default function SuscripcionEmpresa() {
  const { id } = useParams<{ id: string }>();
  const [emp, setEmp] = useState<ResumenEmpresa | null>(null);
  const [disp, setDisp] = useState<Disp[]>([]);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; x: string } | null>(null);
  const [ren, setRen] = useState<{ meses: string; modulos: string[] }>({ meses: "12", modulos: [] });
  const [fac, setFac] = useState<{ ciclo: string; forma: string; precio: string; proximo: string }>({ ciclo: "", forma: "", precio: "", proximo: "" });
  const [pago, setPago] = useState<{ importe: string; concepto: string }>({ importe: "", concepto: "" });
  const [historial, setHistorial] = useState<{ id: string; fecha: string; importe: number; concepto: string | null; metodo: string | null }[]>([]);
  const [tarifas, setTarifas] = useState<Record<string, { etiqueta: string; precio: number }>>({});

  async function cargar() {
    const sb = supabaseBrowser();
    const { data: r } = await sb.rpc("admin_resumen_empresas");
    const fila = buscarEmpresa(((r as ResumenEmpresa[] | null) ?? []), id);
    setEmp(fila);
    if (!fila) { setCargando(false); return; }
    setRen({ meses: "12", modulos: fila.licencia_modulos ?? [] });
    setFac({ ciclo: fila.ciclo_pago ?? "", forma: fila.forma_pago ?? "", precio: fila.precio_periodo != null ? String(fila.precio_periodo) : "", proximo: fila.proximo_pago ?? "" });
    const [{ data: d }, { data: h }, { data: tf }] = await Promise.all([
      sb.rpc("admin_dispositivos_empresa", { p_tenant: fila.id }),
      // Historial de pagos (RLS: es_admin_plataforma permite leer pago_gluuh).
      sb.from("pago_gluuh").select("id,fecha,importe,concepto,metodo").eq("tenant_id", fila.id).order("fecha", { ascending: false }),
      sb.from("tarifa_plataforma").select("clave,etiqueta,precio"),
    ]);
    setDisp((d as Disp[] | null) ?? []);
    setHistorial((h as typeof historial | null) ?? []);
    setTarifas(Object.fromEntries(((tf as { clave: string; etiqueta: string; precio: number }[] | null) ?? []).map((t) => [t.clave, { etiqueta: t.etiqueta, precio: t.precio }])));
    setCargando(false);
  }
  useEffect(() => { void cargar();   }, [id]);

  async function accion(a: string, extra?: Record<string, unknown>) {
    setMsg(null);
    const r = await accionEmpresa(emp?.id ?? id, a, extra);
    setMsg({ t: r.ok ? "ok" : "err", x: r.msg });
    if (r.ok) cargar();
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

  // Desglose del mensual calculado: base + dispositivos vinculados por tipo + módulos.
  const tp = (clave: string) => tarifas[clave]?.precio ?? 0;
  const porTipo = new Map<string, number>();
  for (const dv of disp.filter((x) => x.vinculado_at)) porTipo.set(dv.tipo, (porTipo.get(dv.tipo) ?? 0) + 1);
  const lineasDisp = [...porTipo.entries()].map(([tipo, n]) => ({ etiqueta: tarifas[`DISPOSITIVO_${tipo}`]?.etiqueta ?? tipo, n, precio: tp(`DISPOSITIVO_${tipo}`) }));
  const lineasMod = emp.licencia_modulos.map((m) => ({ etiqueta: tarifas[`MODULO_${m}`]?.etiqueta ?? m, precio: tp(`MODULO_${m}`) })).filter((x) => x.precio > 0);
  const tieneTPV = porTipo.has("TPV");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <EncabezadoEmpresa emp={emp} tab="suscripcion" />

      {msg && <p className={`rounded-md px-3 py-2 text-sm ${msg.t === "ok" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>{msg.x}</p>}

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

      {/* Facturación / Pago a Gluuh */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4" aria-hidden /> Facturación · pago a Gluuh</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Mensual calculado (base + dispositivos + módulos) con desglose. */}
          <div className="rounded-lg border border-border bg-surface-muted/40 p-3.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-muted-foreground">Mensual calculado</span>
              <span className="text-xl font-semibold tabular-nums">{eur(emp.precio_calculado)}<span className="text-[13px] font-normal text-muted-foreground">/mes</span></span>
            </div>
            <div className="mt-2 space-y-0.5 text-[12px] text-muted-foreground">
              {tp("BASE") > 0 && <div className="flex justify-between"><span>{tarifas.BASE?.etiqueta ?? "Cuota base"}</span><span className="tabular-nums">{eur(tp("BASE"))}</span></div>}
              {lineasDisp.map((l) => <div key={l.etiqueta} className="flex justify-between"><span>{l.n} × {l.etiqueta}</span><span className="tabular-nums">{eur(l.n * l.precio)}</span></div>)}
              {/* El primer TPV va incluido en la cuota base (plan Básica, 0088). */}
              {tieneTPV && tp("DISPOSITIVO_TPV") > 0 && <div className="flex justify-between"><span>1er TPV incluido en la base</span><span className="tabular-nums">−{eur(tp("DISPOSITIVO_TPV"))}</span></div>}
              {lineasMod.map((l) => <div key={l.etiqueta} className="flex justify-between"><span>{l.etiqueta}</span><span className="tabular-nums">{eur(l.precio)}</span></div>)}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Trimestral {eur(emp.precio_calculado * 3)} · Anual {eur(emp.precio_calculado * 12)}. Tarifas en <a href="/admin/tarifas" className="underline">Tarifas</a>.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1"><Label className="text-xs">Ciclo</Label>
              <Select value={fac.ciclo || undefined} onValueChange={(v) => setFac((s) => ({ ...s, ciclo: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{CICLOS.map((c) => <SelectItem key={c.v} value={c.v}>{c.t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Forma de pago</Label>
              <Select value={fac.forma || undefined} onValueChange={(v) => setFac((s) => ({ ...s, forma: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{FORMAS.map((c) => <SelectItem key={c.v} value={c.v}>{c.t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Precio / periodo (€)</Label>
              <Input type="number" min={0} step="0.01" value={fac.precio} onChange={(e) => setFac((s) => ({ ...s, precio: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Próximo pago</Label>
              <Input type="date" value={fac.proximo} onChange={(e) => setFac((s) => ({ ...s, proximo: e.target.value }))} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => accion("config-pago", { ciclo: fac.ciclo, forma: fac.forma, precio: Number(fac.precio) || 0, proximo: fac.proximo })}>Guardar facturación</Button>
          </div>

          <div className="space-y-2 border-t border-border-muted pt-3">
            <Label className="text-xs">Registrar pago recibido</Label>
            <div className="flex flex-wrap items-end gap-2">
              <Input type="number" min={0} step="0.01" className="w-32" placeholder="Importe €" value={pago.importe} onChange={(e) => setPago((s) => ({ ...s, importe: e.target.value }))} />
              <Input className="w-48" placeholder="Concepto (opcional)" value={pago.concepto} onChange={(e) => setPago((s) => ({ ...s, concepto: e.target.value }))} />
              <Button size="sm" variant="outline" disabled={Number(pago.importe) <= 0} onClick={() => { void accion("registrar-pago", { importe: Number(pago.importe), concepto: pago.concepto, metodo: fac.forma }); setPago({ importe: "", concepto: "" }); }}>Registrar pago</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Al registrar, el próximo pago avanza según el ciclo.</p>
          </div>

          {historial.length > 0 && (
            <div className="border-t border-border-muted pt-3">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Historial de pagos</div>
              <div className="divide-y divide-border-muted">
                {historial.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
                    <span>{new Date(p.fecha).toLocaleDateString("es-ES")} <span className="text-muted-foreground">{p.concepto ?? p.metodo ?? ""}</span></span>
                    <span className="font-medium tabular-nums">{eur(p.importe)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
