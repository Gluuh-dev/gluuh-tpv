"use client";

import { useEffect, useState } from "react";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Lock } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

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
  useEffect(() => { (async () => { await cargar(); setLoading(false); })(); /* eslint-disable-next-line */ }, []);

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    await sb.from("cash_session").insert({ tenant_id: tenantId, location_id: locationId, abierta_por: userId, fondo_inicial: Number(fondo) || 0 });
    setFondo(""); cargar();
  }
  async function addMov(e: React.FormEvent) {
    e.preventDefault();
    if (!sesion || !mov.importe) return;
    await sb.from("cash_move").insert({ tenant_id: tenantId, cash_session_id: sesion.id, tipo: mov.tipo, importe: Number(mov.importe), motivo: mov.motivo || null });
    setMov({ tipo: "SALIDA", importe: "", motivo: "" }); cargar();
  }

  const entradas = movs.filter((m) => m.tipo === "ENTRADA").reduce((s, m) => s + Number(m.importe), 0);
  const salidas = movs.filter((m) => m.tipo === "SALIDA").reduce((s, m) => s + Number(m.importe), 0);
  const teorico = (sesion?.fondo_inicial ?? 0) + entradas - salidas; // ponytail: solo efectivo; ventas por forma de pago al integrar cobro

  async function cerrar() {
    if (!sesion) return;
    const txt = prompt(`Efectivo contado en caja (teórico: ${eur(teorico)})`, teorico.toFixed(2));
    if (txt === null) return;
    const contado = Number(txt.replace(",", ".")) || 0;
    await sb.from("cash_session").update({ cerrada_en: new Date().toISOString(), total_efectivo: contado, descuadre: contado - teorico }).eq("id", sesion.id);
    cargar();
  }

  if (loading) return <div className="text-muted-foreground">Cargando…</div>;

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
        actions={<Button variant="destructive" onClick={cerrar}><Lock className="h-4 w-4" /> Cerrar caja (Z)</Button>} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Wallet className="h-4 w-4" />} label="Fondo inicial" value={eur(sesion.fondo_inicial)} />
        <StatCard icon={<ArrowDownToLine className="h-4 w-4" />} label="Entradas" value={eur(entradas)} />
        <StatCard icon={<ArrowUpFromLine className="h-4 w-4" />} label="Salidas" value={eur(salidas)} />
        <StatCard icon={<Wallet className="h-4 w-4" />} label="Efectivo teórico" value={eur(teorico)} />
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
    </div>
  );
}
