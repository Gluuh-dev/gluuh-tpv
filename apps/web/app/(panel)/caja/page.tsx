"use client";

import { useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Lock, AlertTriangle } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { getSetting } from "../../lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

interface Sesion { id: string; fondo_inicial: number; abierta_en: string; cerrada_en: string | null; total_efectivo: number | null; descuadre: number | null }
interface Mov { id: string; tipo: "ENTRADA" | "SALIDA"; importe: number; motivo: string | null; created_at: string }
const eur = (n: number) => Number(n).toFixed(2) + " €";

export default function Caja() {
  const sb = supabaseBrowser();
  const [tenantId, setTenantId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [fondo, setFondo] = useState("");
  const [mov, setMov] = useState({ tipo: "SALIDA" as "ENTRADA" | "SALIDA", importe: "", motivo: "" });
  const [loading, setLoading] = useState(true);
  // Ajustes de "Configuración de caja" (setting GLOBAL) que guían el cierre.
  const [arqueoCiego, setArqueoCiego] = useState(false);
  const [umbral, setUmbral] = useState<number | null>(null); // null = sin umbral
  const [cerrarOpen, setCerrarOpen] = useState(false);
  const [contado, setContado] = useState("");

  async function cargar() {
    const { data: { session } } = await sb.auth.getSession();
    const [{ data: t }, { data: loc }, { data: u }] = await Promise.all([
      sb.from("tenant").select("id").limit(1).maybeSingle(),
      sb.from("location").select("id").limit(1).maybeSingle(),
      session ? sb.from("app_user").select("id").eq("auth_user_id", session.user.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setTenantId((t as { id: string } | null)?.id ?? "");
    setLocationId((loc as { id: string } | null)?.id ?? "");
    setUserId((u as { id: string } | null)?.id ?? null);
    const { data: s } = await sb.from("cash_session").select("id,fondo_inicial,abierta_en,cerrada_en,total_efectivo,descuadre").is("cerrada_en", null).order("abierta_en", { ascending: false }).limit(1).maybeSingle();
    setSesion((s as Sesion | null) ?? null);
    if (s) {
      const { data: m } = await sb.from("cash_move").select("id,tipo,importe,motivo,created_at").eq("cash_session_id", (s as Sesion).id).order("created_at");
      setMovs((m as Mov[]) ?? []);
    } else setMovs([]);
  }
  useEffect(() => { (async () => {
    await cargar();
    // Ajustes de "Configuración de caja": fondo por defecto, arqueo ciego y umbral.
    const [f, ciego, u] = await Promise.all([
      getSetting<number>("caja.fondo_inicial").catch(() => null),
      getSetting<boolean>("caja.arqueo_ciego").catch(() => null),
      getSetting<number>("caja.umbral_descuadre").catch(() => null),
    ]);
    if (f !== null) setFondo(String(f)); // precarga editable de la apertura
    setArqueoCiego(ciego ?? false);
    setUmbral(u);
    setLoading(false);
  })(); /* eslint-disable-next-line */ }, []);

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    await sb.from("cash_session").insert({ tenant_id: tenantId, location_id: locationId, abierta_por: userId, fondo_inicial: Number(fondo) || 0 });
    setFondo(""); cargar(); toast.success("Caja abierta");
  }
  async function addMov(e: React.FormEvent) {
    e.preventDefault();
    if (!sesion || !mov.importe) return;
    await sb.from("cash_move").insert({ tenant_id: tenantId, cash_session_id: sesion.id, tipo: mov.tipo, importe: Number(mov.importe), motivo: mov.motivo || null });
    setMov({ tipo: "SALIDA", importe: "", motivo: "" }); cargar();
  }

  const entradas = movs.filter((m) => m.tipo === "ENTRADA").reduce((s, m) => s + Number(m.importe), 0);
  const salidas = movs.filter((m) => m.tipo === "SALIDA").reduce((s, m) => s + Number(m.importe), 0);
  // ponytail: el efectivo esperado del arqueo solo cuenta fondo + cash_move (efectivo).
  // Cuando el cobro registre el método por pago, sumar aquí solo los pagos cuya
  // payment_method.cuenta_arqueo = true; los métodos con cuenta_arqueo = false no arquean.
  const teorico = (sesion?.fondo_inicial ?? 0) + entradas - salidas;

  // Cierre Z guiado por ajustes: arqueo ciego (oculta esperado hasta contar) y umbral de descuadre.
  const contadoNum = Number(contado.replace(",", ".")) || 0;
  const contadoIntroducido = contado.trim() !== "";
  const descuadre = contadoNum - teorico;
  const mostrarEsperado = !arqueoCiego || contadoIntroducido;
  const superaUmbral = contadoIntroducido && umbral !== null && Math.abs(descuadre) > umbral;

  async function confirmarCierre() {
    if (!sesion || !contadoIntroducido) return;
    await sb.from("cash_session").update({ cerrada_en: new Date().toISOString(), total_efectivo: contadoNum, descuadre }).eq("id", sesion.id);
    setCerrarOpen(false); setContado("");
    cargar();
    toast.success(`Cierre Z guardado · descuadre ${eur(descuadre)}`);
  }

  if (loading) return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Caja" description="Control de caja y arqueo del turno." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[76px] w-full" />)}
      </div>
      <TableSkeleton rows={4} />
    </div>
  );

  if (!sesion) return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Caja" description="Abre la caja con el fondo inicial para empezar el turno." />
      <Card><CardContent className="pt-6">
        <form onSubmit={abrir} className="flex items-end gap-3">
          <div className="space-y-1.5"><label className="text-sm font-medium">Fondo inicial (efectivo)</label><Input className="w-40" inputMode="decimal" placeholder="0,00 €" value={fondo} onChange={(e) => setFondo(e.target.value)} /></div>
          <Button><Wallet className="h-4 w-4" /> Abrir caja</Button>
        </form>
      </CardContent></Card>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Caja abierta" description={`Desde ${new Date(sesion.abierta_en).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
        actions={<Button variant="destructive" onClick={() => { setContado(""); setCerrarOpen(true); }}><Lock className="h-4 w-4" /> Cerrar caja (Z)</Button>} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Wallet className="h-4 w-4" />} label="Fondo inicial" value={eur(sesion.fondo_inicial)} />
        <StatCard icon={<ArrowDownToLine className="h-4 w-4" />} label="Entradas" value={eur(entradas)} />
        <StatCard icon={<ArrowUpFromLine className="h-4 w-4" />} label="Salidas" value={eur(salidas)} />
        {/* Con arqueo ciego el esperado no se muestra hasta contar en el cierre. */}
        <StatCard icon={<Wallet className="h-4 w-4" />} label="Efectivo teórico" value={arqueoCiego ? "—" : eur(teorico)} hint={arqueoCiego ? "Oculto por arqueo ciego" : undefined} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Movimiento de efectivo</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={addMov} className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-input p-0.5">
              {(["ENTRADA", "SALIDA"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setMov({ ...mov, tipo: t })}
                  className={`rounded px-3 py-1.5 text-sm ${mov.tipo === t ? "bg-accent font-medium" : "text-muted-foreground"}`}>{t === "ENTRADA" ? "Entrada" : "Salida"}</button>
              ))}
            </div>
            <Input className="w-28" inputMode="decimal" placeholder="Importe €" value={mov.importe} onChange={(e) => setMov({ ...mov, importe: e.target.value })} />
            <Input className="w-56" placeholder="Motivo (compra hielo, propina…)" value={mov.motivo} onChange={(e) => setMov({ ...mov, motivo: e.target.value })} />
            <Button>Registrar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Movimientos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {movs.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted-foreground">Sin movimientos de efectivo.</p>}
          <div className="divide-y divide-border">
            {movs.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-normal">{m.tipo === "ENTRADA" ? "Entrada" : "Salida"}</Badge>
                  <span className="text-muted-foreground">{m.motivo || "—"}</span>
                </div>
                <span className={`tabular-nums ${m.tipo === "ENTRADA" ? "text-emerald-600" : "text-destructive"}`}>{m.tipo === "ENTRADA" ? "+" : "−"}{eur(Number(m.importe))}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={cerrarOpen} onOpenChange={setCerrarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cierre de caja (Z)</DialogTitle>
            <DialogDescription>
              {arqueoCiego
                ? "Arqueo ciego: cuenta el efectivo y anótalo. No verás el total esperado hasta introducirlo."
                : "Introduce el efectivo contado para calcular el descuadre."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="cierre-contado" className="text-sm font-medium">Efectivo contado (€)</label>
              <Input id="cierre-contado" autoFocus inputMode="decimal" placeholder="0,00 €" value={contado} onChange={(e) => setContado(e.target.value)} />
            </div>

            {mostrarEsperado && (
              <div className="space-y-1 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Efectivo teórico</span><span className="tabular-nums">{eur(teorico)}</span></div>
                {contadoIntroducido && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Descuadre</span>
                    <span className={`font-medium tabular-nums ${descuadre === 0 ? "" : descuadre > 0 ? "text-emerald-600" : "text-destructive"}`}>{descuadre > 0 ? "+" : ""}{eur(descuadre)}</span>
                  </div>
                )}
              </div>
            )}

            {superaUmbral && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Descuadre de {eur(Math.abs(descuadre))} supera el límite ({eur(umbral ?? 0)}). Revisa el efectivo antes de confirmar el cierre.</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCerrarOpen(false)}>Cancelar</Button>
            <Button variant={superaUmbral ? "destructive" : undefined} disabled={!contadoIntroducido} onClick={confirmarCierre}>
              <Lock className="h-4 w-4" /> {superaUmbral ? "Confirmar cierre con descuadre" : "Cerrar caja (Z)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
