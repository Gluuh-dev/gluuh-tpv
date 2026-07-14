"use client";

// Ordenar productos dentro de cada categoría (columna product.orden, migración 0046).
// Si la migración aún no está aplicada, la página cae a solo lectura con aviso.
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, TriangleAlert } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { eur } from "@/app/lib/money";

interface Categoria { id: string; nombre: string; orden: number }
interface Producto { id: string; nombre: string; precio: number; category_id: string | null; orden: number }


export default function OrdenarProductos() {
  const sb = supabaseBrowser();
  const [cats, setCats] = useState<Categoria[]>([]);
  const [prods, setProds] = useState<Producto[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const [soloLectura, setSoloLectura] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: c } = await sb.from("category").select("id,nombre,orden").order("orden");
      const cs = (c as Categoria[]) ?? [];
      setCats(cs);
      setSel(cs[0]?.id ?? null);
      // Con orden; si la columna no existe aún (0046 sin aplicar) → solo lectura.
      const conOrden = await sb.from("product").select("id,nombre,precio,category_id,orden").order("orden").order("nombre");
      if (conOrden.error) {
        const { data: p } = await sb.from("product").select("id,nombre,precio,category_id").order("nombre");
        setProds((((p as Omit<Producto, "orden">[]) ?? []).map((x) => ({ ...x, orden: 0 }))));
        setSoloLectura(true);
      } else {
        setProds((conOrden.data as Producto[]) ?? []);
      }
      setCargado(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lista = prods
    .filter((p) => p.category_id === sel)
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));

  // Mueve el producto i de la lista visible una posición; reindexa 0..n-1 y
  // persiste solo lo que cambia (cubre el caso de `orden` duplicado a 0).
  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= lista.length) return;
    const nueva = [...lista];
    const a = nueva[i], b = nueva[j];
    if (!a || !b) return;
    nueva[i] = b; nueva[j] = a;
    const cambios: { id: string; orden: number }[] = [];
    nueva.forEach((p, idx) => { if (p.orden !== idx) cambios.push({ id: p.id, orden: idx }); });
    const porId = new Map(cambios.map((c) => [c.id, c.orden]));
    setProds((prev) => prev.map((p) => (porId.has(p.id) ? { ...p, orden: porId.get(p.id)! } : p)));
    await Promise.all(cambios.map((c) => sb.from("product").update({ orden: c.orden }).eq("id", c.id)));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Ordenar productos"
        description="Orden de los productos dentro de cada categoría en la botonera del TPV."
      />

      {soloLectura && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Falta aplicar la migración <strong>0046</strong> (columna <code>product.orden</code>) en la base
            de datos. Mientras tanto, los productos se muestran en orden alfabético y la lista es de solo lectura.
          </p>
        </div>
      )}

      {cargado && cats.length === 0 ? (
        <EmptyState
          title="Sin categorías"
          description="Crea categorías y productos en la página Carta para poder ordenarlos aquí."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSel(c.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  sel === c.id
                    ? "bg-brand text-brand-foreground"
                    : "border border-border bg-input/30 text-muted-foreground hover:bg-input/50 hover:text-foreground"
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden py-0">
            <CardContent className="p-0">
              {/* `cargado &&`: la bandera ya existía y no se usaba aquí. Sin ella, decía «No
                  hay productos en esta categoría» mientras los estaba cargando. */}
              {cargado && lista.length === 0 && (
                <p className="px-5 py-4 text-sm text-muted-foreground">No hay productos en esta categoría.</p>
              )}
              <div className="divide-y divide-border">
                {lista.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                    <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                    <span className="flex-1">{p.nombre}</span>
                    <span className="tabular-nums text-muted-foreground">{eur(p.precio)}</span>
                    {!soloLectura && (
                      <span className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => void mover(i, -1)}
                          disabled={i === 0}
                          aria-label={`Subir ${p.nombre}`}
                          className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void mover(i, 1)}
                          disabled={i === lista.length - 1}
                          aria-label={`Bajar ${p.nombre}`}
                          className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
