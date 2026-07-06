"use client";

// Página informativa: los 14 alérgenos oficiales (Reglamento UE 1169/2011) y
// qué productos de la carta los llevan. La lista legal es fija — constante
// ALERGENOS de lib/alergenos.ts — y cada producto guarda los suyos en
// product.alergenos (se editan en la ficha de producto, en Carta).
// ponytail: la tabla `alergeno` de la BD (0020) queda sin uso desde aquí; no se
// borra porque eso es una decisión SQL del usuario.

import * as React from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { ALERGENOS } from "@/lib/alergenos";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

const EMOJI: Record<string, string> = {
  gluten: "🌾", crustaceos: "🦐", huevos: "🥚", pescado: "🐟",
  cacahuetes: "🥜", soja: "🌱", lacteos: "🥛", frutos_cascara: "🌰",
  apio: "🥬", mostaza: "🌼", sesamo: "🥯", sulfitos: "🍷",
  altramuces: "🫘", moluscos: "🦪",
};

interface Producto { id: string; nombre: string; alergenos: string[] | null }

export default function Alergenos() {
  const sb = supabaseBrowser();
  const [prods, setProds] = React.useState<Producto[]>([]);
  const [cargado, setCargado] = React.useState(false);
  const [sel, setSel] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      const { data } = await sb.from("product").select("id,nombre,alergenos").order("nombre");
      setProds((data as Producto[]) ?? []);
      setCargado(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productosCon = (v: string) => prods.filter((p) => p.alergenos?.includes(v));
  const selInfo = ALERGENOS.find((a) => a.v === sel);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Alérgenos"
        description="Los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011) y los productos de tu carta que los llevan."
      />

      <div className="flex items-start gap-2 rounded-lg bg-sky-500/15 px-4 py-3 text-sm text-sky-600 dark:text-sky-500">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          Los alérgenos se asignan en la ficha de cada producto (
          <Link href="/carta" className="font-medium underline underline-offset-2">Carta</Link>
          ). Esta página es solo de consulta.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {ALERGENOS.map((a) => {
          const n = productosCon(a.v).length;
          const activo = sel === a.v;
          return (
            <button
              key={a.v}
              type="button"
              aria-pressed={activo}
              onClick={() => setSel(activo ? null : a.v)}
              className={`rounded-lg border p-3 text-center transition-colors ${
                activo ? "border-brand bg-brand/10" : "border-border bg-card hover:bg-accent"
              }`}
            >
              <span className="block text-2xl" aria-hidden>{EMOJI[a.v] ?? "⚠️"}</span>
              <span className="mt-1 block text-xs font-medium">{a.t}</span>
              <span className="block text-[11px] text-muted-foreground">
                {cargado ? `${n} producto${n === 1 ? "" : "s"}` : "…"}
              </span>
            </button>
          );
        })}
      </div>

      {selInfo && (
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            <p className="border-b border-border px-5 py-3 text-sm font-medium">
              <span aria-hidden>{EMOJI[selInfo.v]}</span> Productos con {selInfo.t.toLowerCase()}
            </p>
            {productosCon(selInfo.v).length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">
                Ningún producto de la carta lleva este alérgeno.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {productosCon(selInfo.v).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-2 text-sm">
                    <span className="truncate">{p.nombre}</span>
                    <span
                      className="shrink-0 text-base"
                      title={(p.alergenos ?? [])
                        .map((v) => ALERGENOS.find((a) => a.v === v)?.t)
                        .filter(Boolean)
                        .join(", ")}
                    >
                      {(p.alergenos ?? []).map((v) => EMOJI[v]).filter(Boolean).join(" ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
