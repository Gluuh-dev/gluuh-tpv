"use client";

// Sección "Precios de venta" de la ficha de producto (patrón Ágora): una fila
// por tarifa (product_price, 0047) además del precio base. Vacío = sin precio
// en esa tarifa (se cobra el base). Guarda al salir del campo.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Euro } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Tarifa { id: string; nombre: string; precio: number | null; ppId: string | null }

export function PreciosTarifa({ refId, precioBase }: Readonly<{ refId: string; precioBase: string }>) {
  const sb = supabaseBrowser();
  const [cargando, setCargando] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);

  const cargar = useCallback(async () => {
    const [{ data: t }, tr, pp] = await Promise.all([
      sb.from("tenant").select("id").limit(1).maybeSingle(),
      sb.from("tarifa").select("id,nombre").order("nombre"),
      sb.from("product_price").select("id,tarifa_id,precio").eq("product_id", refId),
    ]);
    if (tr.error || pp.error) { setCargando(false); return; }
    setTenantId((t as { id: string } | null)?.id ?? null);
    const precios = new Map(((pp.data as { id: string; tarifa_id: string; precio: number }[] | null) ?? [])
      .map((r) => [r.tarifa_id, { id: r.id, precio: Number(r.precio) }]));
    setTarifas((((tr.data as { id: string; nombre: string }[] | null) ?? [])).map((x) => ({
      id: x.id, nombre: x.nombre,
      precio: precios.get(x.id)?.precio ?? null,
      ppId: precios.get(x.id)?.id ?? null,
    })));
    setCargando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refId]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function guardar(t: Tarifa, texto: string) {
    const limpio = texto.trim().replace(",", ".");
    if (limpio === "" || Number(limpio) === 0) {
      // Vacío o 0 = quitar el precio de tarifa (se cobra el base)
      if (t.ppId) {
        const { error } = await sb.from("product_price").delete().eq("id", t.ppId);
        if (error) { toast.error(`No se pudo quitar el precio: ${error.message}`); return; }
        await cargar();
      }
      return;
    }
    const v = Number(limpio);
    if (!Number.isFinite(v) || v < 0) return;
    if (v === t.precio) return;
    const { error } = t.ppId
      ? await sb.from("product_price").update({ precio: v }).eq("id", t.ppId)
      : await sb.from("product_price").insert({ tenant_id: tenantId, product_id: refId, tarifa_id: t.id, precio: v });
    if (error) { toast.error(`No se pudo guardar el precio: ${error.message}`); return; }
    await cargar();
  }

  if (!cargando && tarifas.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-2 pt-6">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Euro className="h-4 w-4" aria-hidden /> Precios de venta
          </h2>
          <p className="text-sm text-muted-foreground">
            Solo hay precio base. Crea tarifas en <Link href="/tarifas" className="underline underline-offset-2">Tarifas</Link> (terraza, happy hour…) para poner precios distintos por tarifa.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div>
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Euro className="h-4 w-4" aria-hidden /> Precios de venta
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Precio por tarifa (impuesto incluido). Vacío = se cobra el precio base.</p>
        </div>
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="divide-y divide-border">
            <div className="flex items-center gap-3 py-2 text-sm">
              <span className="w-40 font-medium">Base</span>
              <span className="w-28 text-right tabular-nums text-muted-foreground">{precioBase || "—"} €</span>
              <span className="text-xs text-muted-foreground">(el de la ficha)</span>
            </div>
            {tarifas.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-40 font-medium">{t.nombre}</span>
                <Input
                  key={`${t.id}-${t.precio ?? "null"}`}
                  className="h-8 w-28 text-right tabular-nums"
                  inputMode="decimal"
                  aria-label={`Precio en tarifa ${t.nombre}`}
                  defaultValue={t.precio != null ? t.precio.toFixed(2) : ""}
                  placeholder={precioBase || "0,00"}
                  onBlur={(e) => guardar(t, e.target.value)}
                />
                <span className="text-muted-foreground">€</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
