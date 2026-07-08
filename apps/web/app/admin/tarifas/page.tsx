"use client";

// Tarifas de plataforma (consola). Gluuh fija el precio: cuota base + por tipo
// de dispositivo + por módulo. El mensual de cada empresa se calcula de aquí
// (base + dispositivos conectados × su tarifa + módulos contratados × su precio).
import { useEffect, useState } from "react";
import { Tags } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Tarifa { clave: string; etiqueta: string; precio: number }

export default function Tarifas() {
  const sb = supabaseBrowser();
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sb.from("tarifa_plataforma").select("clave,etiqueta,precio").then(({ data }) => setTarifas((data as Tarifa[] | null) ?? []));
    /* eslint-disable-next-line */
  }, []);

  const set = (clave: string, precio: string) => setTarifas((t) => t.map((x) => (x.clave === clave ? { ...x, precio: Number(precio) || 0 } : x)));

  async function guardar() {
    setBusy(true);
    const { error } = await sb.from("tarifa_plataforma").upsert(tarifas.map((t) => ({ clave: t.clave, etiqueta: t.etiqueta, precio: t.precio, updated_at: new Date().toISOString() })), { onConflict: "clave" });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Tarifas guardadas.");
  }

  const grupo = (titulo: string, filtro: (c: string) => boolean) => {
    const items = tarifas.filter((t) => filtro(t.clave));
    if (!items.length) return null;
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((t) => (
            <div key={t.clave} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2">
              <span className="text-[13px]">{t.etiqueta}</span>
              <div className="flex items-center gap-1">
                <Input type="number" min={0} step="0.01" value={String(t.precio)} onChange={(e) => set(t.clave, e.target.value)} className="h-8 w-24 text-right" />
                <span className="text-[13px] text-muted-foreground">€</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-muted"><Tags className="h-4.5 w-4.5 text-muted-foreground" aria-hidden /></span>
        <div>
          <h1 className="text-lg font-semibold">Tarifas</h1>
          <p className="text-[13px] text-muted-foreground">Precio mensual = base (Básica, incluye 1 TPV y 1 impresora) + dispositivos extra × tarifa + módulos contratados × precio.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Precios (mensuales)</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {grupo("Cuota base", (c) => c === "BASE")}
          {grupo("Por dispositivo conectado", (c) => c.startsWith("DISPOSITIVO_"))}
          {grupo("Por módulo contratado", (c) => c.startsWith("MODULO_"))}
          <div className="border-t border-border-muted pt-3">
            <Button onClick={guardar} disabled={busy}>{busy ? "Guardando…" : "Guardar tarifas"}</Button>
            <p className="mt-2 text-[11px] text-muted-foreground">El mensual de cada empresa se recalcula al momento. Trimestral = ×3, anual = ×12 (aplica descuento a mano si quieres).</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
