"use client";

// Ordenar familias y categorías de la carta. Los botones ↑/↓ reordenan y se
// persiste la columna `orden` (family/category) reindexando la lista; la UI
// se actualiza de forma optimista y recarga si falla el guardado.
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Familia { id: string; nombre: string; orden: number; color: string }
interface Categoria { id: string; nombre: string; orden: number; family_id: string | null }

const SIN_FAMILIA = "__none__";

export default function OrdenarFamiliasYCategorias() {
  const sb = supabaseBrowser();
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [sel, setSel] = useState<string>(SIN_FAMILIA); // familia seleccionada (o "Sin familia")
  const [cargado, setCargado] = useState(false);

  async function cargar() {
    const [{ data: fam }, { data: c }] = await Promise.all([
      sb.from("family").select("id,nombre,orden,color").order("orden"),
      sb.from("category").select("id,nombre,orden,family_id").order("orden"),
    ]);
    const fs = (fam as Familia[]) ?? [];
    setFamilias(fs);
    setCats((c as Categoria[]) ?? []);
    setSel((s) => (s === SIN_FAMILIA && fs[0] ? fs[0].id : s));
    setCargado(true);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void cargar(); }, []);

  /** Persiste el nuevo `orden` (solo filas que cambian); recarga si algo falla. */
  async function persistirOrden(
    tabla: "family" | "category",
    filas: { id: string; orden: number }[],
    previas: { id: string; orden: number }[],
  ) {
    const antes = new Map(previas.map((x) => [x.id, x.orden]));
    const cambios = filas.filter((x) => antes.get(x.id) !== x.orden);
    const res = await Promise.all(cambios.map((x) => sb.from(tabla).update({ orden: x.orden }).eq("id", x.id)));
    const err = res.find((r) => r.error)?.error;
    if (err) { toast.error(`No se pudo guardar el orden: ${err.message}`); void cargar(); }
  }

  function moverFamilia(i: number, dir: -1 | 1) {
    const j = i + dir;
    const a = familias[i]; const b = familias[j];
    if (!a || !b) return;
    const arr = [...familias];
    arr[i] = b; arr[j] = a;
    // Reindexar 0..n-1 (más robusto que intercambiar valores: cubre órdenes duplicados a 0)
    const re = arr.map((f, idx) => ({ ...f, orden: idx }));
    setFamilias(re);
    void persistirOrden("family", re, familias);
  }

  // Categorías del grupo seleccionado, en su orden actual
  const grupo = cats
    .filter((c) => (sel === SIN_FAMILIA ? !c.family_id : c.family_id === sel))
    .slice()
    .sort((x, y) => x.orden - y.orden);

  function moverCategoria(i: number, dir: -1 | 1) {
    const j = i + dir;
    const a = grupo[i]; const b = grupo[j];
    if (!a || !b) return;
    const arr = [...grupo];
    arr[i] = b; arr[j] = a;
    const nuevo = new Map(arr.map((c, idx) => [c.id, idx]));
    const re = cats.map((c) => (nuevo.has(c.id) ? { ...c, orden: nuevo.get(c.id)! } : c));
    setCats(re);
    void persistirOrden(
      "category",
      arr.map((c, idx) => ({ id: c.id, orden: idx })),
      grupo.map((c) => ({ id: c.id, orden: c.orden })),
    );
  }

  const famSel = familias.find((f) => f.id === sel) ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Ordenar familias y categorías"
        description="El orden que fijes aquí es el de la botonera del TPV. Usa las flechas para subir o bajar cada elemento."
      />

      {cargado && familias.length === 0 && cats.length === 0 ? (
        <EmptyState
          title="Aún no hay carta"
          description="Crea primero familias y categorías en la página Carta; después podrás ordenarlas aquí."
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Familias */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Familias</CardTitle>
                <CardDescription>Selecciona una familia para ordenar sus categorías a la derecha.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {familias.map((f, i) => (
                  <div
                    key={f.id}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${sel === f.id ? "bg-muted" : "hover:bg-muted/50"}`}
                  >
                    <button type="button" onClick={() => setSel(f.id)} className="flex flex-1 items-center gap-2 text-left">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: f.color }} aria-hidden />
                      <span className="flex-1">{f.nombre}</span>
                      <span className="text-xs text-muted-foreground">
                        {cats.filter((c) => c.family_id === f.id).length} cat.
                      </span>
                    </button>
                    <Flechas
                      arriba={i > 0}
                      abajo={i < familias.length - 1}
                      onArriba={() => moverFamilia(i, -1)}
                      onAbajo={() => moverFamilia(i, 1)}
                      etiqueta={f.nombre}
                    />
                  </div>
                ))}
                {/* Bloque fijo "Sin familia" (no se ordena, pero sus categorías sí) */}
                <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${sel === SIN_FAMILIA ? "bg-muted" : "hover:bg-muted/50"}`}>
                  <button type="button" onClick={() => setSel(SIN_FAMILIA)} className="flex flex-1 items-center gap-2 text-left">
                    <span className="h-3 w-3 shrink-0 rounded-full bg-border" aria-hidden />
                    <span className="flex-1 text-muted-foreground">Sin familia</span>
                    <span className="text-xs text-muted-foreground">{cats.filter((c) => !c.family_id).length} cat.</span>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Categorías de la familia seleccionada */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  Categorías de{" "}
                  {famSel ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full" style={{ background: famSel.color }} aria-hidden />
                      {famSel.nombre}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Sin familia</span>
                  )}
                </CardTitle>
                <CardDescription>Este es el orden en que aparecerán dentro de la familia.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {grupo.length === 0 && <p className="text-sm text-muted-foreground">No hay categorías en este grupo.</p>}
                {grupo.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                    <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                    <span className="flex-1">{c.nombre}</span>
                    <Flechas
                      arriba={i > 0}
                      abajo={i < grupo.length - 1}
                      onArriba={() => moverCategoria(i, -1)}
                      onAbajo={() => moverCategoria(i, 1)}
                      etiqueta={c.nombre}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Vista previa de la botonera */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vista previa de la botonera</CardTitle>
              <CardDescription>Así quedarán las familias y, debajo, las categorías de la familia seleccionada.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {familias.map((f) => (
                  <span
                    key={f.id}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium text-white ${sel === f.id ? "ring-2 ring-ring" : ""}`}
                    style={{ background: f.color }}
                  >
                    {f.nombre}
                  </span>
                ))}
                {cats.some((c) => !c.family_id) && (
                  <span className={`rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground ${sel === SIN_FAMILIA ? "ring-2 ring-ring" : ""}`}>
                    Sin familia
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {grupo.map((c) => (
                  <span key={c.id} className="rounded-md border border-border bg-input/30 px-3 py-1.5 text-xs">
                    {c.nombre}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ponytail: solo flechas ↑/↓; arrastrar con pointer events queda para cuando
// alguna carta real tenga tantas filas que las flechas se hagan pesadas.
function Flechas({ arriba, abajo, onArriba, onAbajo, etiqueta }: {
  arriba: boolean; abajo: boolean; onArriba: () => void; onAbajo: () => void; etiqueta: string;
}) {
  return (
    <span className="flex shrink-0 gap-0.5">
      <Button type="button" variant="ghost" size="icon-xs" disabled={!arriba} onClick={onArriba} aria-label={`Subir ${etiqueta}`} title="Subir">
        <ArrowUp aria-hidden />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" disabled={!abajo} onClick={onAbajo} aria-label={`Bajar ${etiqueta}`} title="Bajar">
        <ArrowDown aria-hidden />
      </Button>
    </span>
  );
}
