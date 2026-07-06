"use client";

// Sección "Etiquetas" de la ficha de producto (0067): chips de colores del
// catálogo etiqueta_producto (se gestiona en /etiquetas), asignadas por m2m
// product_etiqueta. Sirven para filtrar y para la carta digital.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/app/lib/toast";
import { Tags, X } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { BuscarAnadir } from "@/components/buscar-anadir";
import { Card, CardContent } from "@/components/ui/card";

interface Etiqueta { id: string; nombre: string; color: string | null }

export function EtiquetasProducto({ refId }: Readonly<{ refId: string }>) {
  const sb = supabaseBrowser();
  const [cargando, setCargando] = useState(true);
  const [sin0067, setSin0067] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<Etiqueta[]>([]);
  const [asignadas, setAsignadas] = useState<string[]>([]);

  const cargar = useCallback(async () => {
    const [{ data: t }, cat, rel] = await Promise.all([
      sb.from("tenant").select("id").limit(1).maybeSingle(),
      sb.from("etiqueta_producto").select("id,nombre,color").order("nombre"),
      sb.from("product_etiqueta").select("etiqueta_id").eq("product_id", refId),
    ]);
    if (rel.error) { setSin0067(true); setCargando(false); return; }
    setTenantId((t as { id: string } | null)?.id ?? null);
    setCatalogo((cat.data as Etiqueta[] | null) ?? []);
    setAsignadas(((rel.data as { etiqueta_id: string }[] | null) ?? []).map((r) => r.etiqueta_id));
    setCargando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refId]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function anadir(etiquetaId: string) {
    const { error } = await sb.from("product_etiqueta")
      .upsert({ tenant_id: tenantId, product_id: refId, etiqueta_id: etiquetaId }, { onConflict: "product_id,etiqueta_id", ignoreDuplicates: true });
    if (error) { toast.error(`No se pudo añadir la etiqueta: ${error.message}`); return; }
    await cargar();
  }
  async function quitar(etiquetaId: string) {
    const { error } = await sb.from("product_etiqueta").delete().eq("product_id", refId).eq("etiqueta_id", etiquetaId);
    if (error) { toast.error(`No se pudo quitar la etiqueta: ${error.message}`); return; }
    await cargar();
  }

  if (sin0067) return null; // sin la 0067 la sección simplemente no aparece

  const chips = catalogo.filter((e) => asignadas.includes(e.id));
  const candidatas = catalogo.filter((e) => !asignadas.includes(e.id)).map((e) => ({ id: e.id, etiqueta: e.nombre }));

  return (
    <Card className="p-4">
      <div>
        <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Tags className="h-4 w-4" aria-hidden /> Etiquetas
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Para filtrar y para la carta digital (vegano, picante, novedad…). El catálogo se gestiona en{" "}
          <Link href="/etiquetas" className="underline underline-offset-2">Etiquetas de productos</Link>.
        </p>
      </div>
      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((e) => (
                <span key={e.id} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-sm"
                  style={e.color ? { borderColor: e.color, color: e.color, backgroundColor: `${e.color}1a` } : undefined}>
                  {e.nombre}
                  <button type="button" onClick={() => quitar(e.id)} aria-label={`Quitar ${e.nombre}`}
                    className="opacity-70 transition-opacity hover:opacity-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {candidatas.length > 0
            ? <BuscarAnadir opciones={candidatas} onAnadir={anadir} placeholder="Buscar y añadir etiqueta…" />
            : catalogo.length === 0 && <p className="text-sm text-muted-foreground">No hay etiquetas creadas todavía.</p>}
        </>
      )}
    </Card>
  );
}
