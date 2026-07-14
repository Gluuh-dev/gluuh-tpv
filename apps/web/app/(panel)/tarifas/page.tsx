"use client";

// Tarifas de precios: CRUD de tarifas + precio por producto y tarifa
// (tabla product_price, migración 0047). Sin fila = el producto usa su precio
// base. Los importes llevan el impuesto INCLUIDO, como toda la carta.
// Si la migración aún no está aplicada, el CRUD de tarifas sigue funcionando
// y los precios quedan en solo lectura con aviso.
// ponytail: el TPV aún no aplica tarifas al vender; el primer consumidor será
// Consumo propio (tarifa de empleado).
import { useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";
import { Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { eur } from "@/app/lib/money";

interface Tarifa { id: string; nombre: string }
interface Categoria { id: string; nombre: string; orden: number }
interface Producto { id: string; nombre: string; precio: number; category_id: string | null }


export default function Tarifas() {
  const sb = supabaseBrowser();
  const [tenantId, setTenantId] = useState("");
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [prods, setProds] = useState<Producto[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [sinMigracion, setSinMigracion] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  // Valor del input por producto y lo que hay persistido en product_price.
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [guardados, setGuardados] = useState<Record<string, number>>({});

  // ESTO SON LOS PRECIOS. Mientras cargaban, la página decía «Aún no hay tarifas» y «No hay
  // productos en la carta» — o sea, que el dueño abría sus precios y leía que no tenía
  // ninguno. Vacío no es lo mismo que "todavía no ha llegado".
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
      setTenantId((t as { id: string } | null)?.id ?? "");
      const { data: tf } = await sb.from("tarifa").select("id,nombre").order("nombre");
      const lista = (tf as Tarifa[]) ?? [];
      setTarifas(lista);
      setSelId(lista[0]?.id ?? null);
      const { data: c } = await sb.from("category").select("id,nombre,orden").order("orden");
      setCats((c as Categoria[]) ?? []);
      const { data: p } = await sb.from("product").select("id,nombre,precio,category_id").order("nombre");
      setProds((p as Producto[]) ?? []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Precios de la tarifa seleccionada; si product_price no existe (0047 sin
  // aplicar) → solo lectura con aviso.
  useEffect(() => {
    if (!selId) { setPrecios({}); setGuardados({}); return; }
    void (async () => {
      const { data, error } = await sb.from("product_price").select("product_id,precio").eq("tarifa_id", selId);
      if (error) { setSinMigracion(true); setPrecios({}); setGuardados({}); return; }
      setSinMigracion(false);
      const g: Record<string, number> = {};
      const s: Record<string, string> = {};
      for (const r of (data as { product_id: string; precio: number }[]) ?? []) {
        g[r.product_id] = Number(r.precio);
        s[r.product_id] = Number(r.precio).toFixed(2);
      }
      setGuardados(g);
      setPrecios(s);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);

  /* ── CRUD de tarifas ── */

  async function crearTarifa(e: React.FormEvent) {
    e.preventDefault();
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    const { data, error } = await sb.from("tarifa").insert({ tenant_id: tenantId, nombre }).select("id,nombre").single();
    if (error) { toast.error(error.message); return; }
    const t = data as Tarifa;
    setTarifas((prev) => [...prev, t].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setSelId(t.id);
    setNuevoNombre("");
  }

  async function renombrar(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    const nombre = editNombre.trim();
    if (!nombre) { setEditId(null); return; }
    const { error } = await sb.from("tarifa").update({ nombre }).eq("id", editId);
    if (error) { toast.error(error.message); return; }
    setTarifas((prev) => prev.map((t) => (t.id === editId ? { ...t, nombre } : t)));
    setEditId(null);
  }

  async function borrarTarifa(t: Tarifa) {
    if (!confirm(`¿Eliminar la tarifa "${t.nombre}" y sus precios?`)) return;
    const { error } = await sb.from("tarifa").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    setTarifas((prev) => {
      const resto = prev.filter((x) => x.id !== t.id);
      if (selId === t.id) setSelId(resto[0]?.id ?? null);
      return resto;
    });
  }

  /* ── Precio por producto en la tarifa ── */

  // Al salir del input: vacío = borrar la fila (vuelve al precio base);
  // número = upsert. Solo se persiste lo que cambia.
  async function commitPrecio(p: Producto) {
    if (!selId || sinMigracion) return;
    const raw = (precios[p.id] ?? "").trim().replace(",", ".");
    const actual = guardados[p.id];
    if (raw === "") {
      if (actual === undefined) return;
      const { error } = await sb.from("product_price").delete().eq("tarifa_id", selId).eq("product_id", p.id);
      if (error) { toast.error(error.message); return; }
      setGuardados((g) => { const n = { ...g }; delete n[p.id]; return n; });
      return;
    }
    const num = Math.round(Number(raw) * 100) / 100;
    if (!Number.isFinite(num) || num < 0) {
      setPrecios((s) => ({ ...s, [p.id]: actual !== undefined ? actual.toFixed(2) : "" }));
      return;
    }
    if (actual !== undefined && actual === num) {
      setPrecios((s) => ({ ...s, [p.id]: num.toFixed(2) }));
      return;
    }
    const { error } = await sb.from("product_price").upsert(
      { tenant_id: tenantId, product_id: p.id, tarifa_id: selId, precio: num },
      { onConflict: "tenant_id,product_id,tarifa_id" },
    );
    if (error) { toast.error(error.message); return; }
    setGuardados((g) => ({ ...g, [p.id]: num }));
    setPrecios((s) => ({ ...s, [p.id]: num.toFixed(2) }));
  }

  /* ── Agrupación por categoría + buscador ── */
  const filtro = busca.trim().toLowerCase();
  const visibles = filtro ? prods.filter((p) => p.nombre.toLowerCase().includes(filtro)) : prods;
  const grupos: { nombre: string; items: Producto[] }[] = [
    ...cats.map((c) => ({ nombre: c.nombre, items: visibles.filter((p) => p.category_id === c.id) })),
    { nombre: "Sin categoría", items: visibles.filter((p) => !p.category_id || !cats.some((c) => c.id === p.category_id)) },
  ].filter((g) => g.items.length > 0);

  const sel = tarifas.find((t) => t.id === selId) ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Tarifas"
        description="Precio por producto en cada tarifa. Sin precio propio, el producto usa su precio base (impuesto incluido)."
      />

      {sinMigracion && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Falta aplicar la migración <strong>0047</strong> (tabla <code>product_price</code>) en la base
            de datos. Puedes crear y renombrar tarifas, pero los precios por tarifa son de solo lectura.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista de tarifas */}
        <Card className="self-start">
          <CardContent className="space-y-3">
            <div className="space-y-1">
              {loading && <Skeleton className="h-8 w-full" />}
              {!loading && tarifas.length === 0 && (
                <p className="py-2 text-sm text-(--text-muted)">Aún no hay tarifas. Crea la primera abajo.</p>
              )}
              {tarifas.map((t) =>
                editId === t.id ? (
                  <form key={t.id} onSubmit={renombrar} className="flex items-center gap-1.5">
                    <Input autoFocus value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="h-8" />
                    <Button type="submit" size="sm" className="h-8">OK</Button>
                  </form>
                ) : (
                  <div
                    key={t.id}
                    className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
                      selId === t.id ? "bg-surface-muted font-medium" : "hover:bg-surface-overlay"
                    }`}
                  >
                    <button type="button" onClick={() => setSelId(t.id)} className="flex-1 text-left">
                      {t.nombre}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditId(t.id); setEditNombre(t.nombre); }}
                      aria-label={`Renombrar ${t.nombre}`}
                      title="Renombrar"
                      className="grid h-7 w-7 place-items-center rounded-md text-(--text-muted) opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void borrarTarifa(t)}
                      aria-label={`Eliminar ${t.nombre}`}
                      title="Eliminar"
                      className="grid h-7 w-7 place-items-center rounded-md text-(--text-muted) opacity-0 hover:bg-accent hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ),
              )}
            </div>
            <form onSubmit={crearTarifa} className="flex items-center gap-1.5 border-t border-border pt-3">
              <Input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Nueva tarifa (p. ej. Terraza)"
                className="h-8"
              />
              <Button type="submit" size="sm" className="h-8" disabled={!nuevoNombre.trim()}>
                <Plus className="h-4 w-4" /> Añadir
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Precios de la tarifa seleccionada */}
        <div className="space-y-4 lg:col-span-2">
          {!sel ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-(--text-muted)">
                Selecciona o crea una tarifa para editar sus precios.
              </CardContent>
            </Card>
          ) : (
            <>
              <SearchInput value={busca} onChange={setBusca} placeholder="Buscar producto…" />
              <Card className="overflow-hidden py-0">
                <CardContent className="p-0">
                  {loading && (
                    <div className="space-y-2 px-5 py-4">
                      {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-5 w-full" />)}
                    </div>
                  )}
                  {/* «No hay productos en la carta» sólo cuando de verdad no los hay. */}
                  {!loading && grupos.length === 0 && (
                    <p className="px-5 py-4 text-sm text-(--text-muted)">
                      {prods.length === 0 ? "No hay productos en la carta." : "Ningún producto coincide con la búsqueda."}
                    </p>
                  )}
                  {grupos.map((g) => (
                    <div key={g.nombre}>
                      <div className="flex items-center justify-between bg-surface-muted px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-(--text-muted)">
                        <span>{g.nombre}</span>
                        <span className="flex gap-6 pr-1">
                          <span className="w-20 text-right">Precio base</span>
                          <span className="w-24 text-right">En {sel.nombre}</span>
                        </span>
                      </div>
                      <div className="divide-y divide-border">
                        {g.items.map((p) => (
                          <div key={p.id} className="flex items-center gap-6 px-5 py-1.5 text-sm">
                            <span className="flex-1">{p.nombre}</span>
                            <span className="w-20 text-right tabular-nums text-(--text-muted)">{eur(p.precio)}</span>
                            <Input
                              value={precios[p.id] ?? ""}
                              onChange={(e) => setPrecios((s) => ({ ...s, [p.id]: e.target.value }))}
                              onBlur={() => void commitPrecio(p)}
                              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                              disabled={sinMigracion}
                              inputMode="decimal"
                              placeholder={p.precio.toFixed(2)}
                              aria-label={`Precio de ${p.nombre} en ${sel.nombre}`}
                              className="h-8 w-24 text-right tabular-nums"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <p className="text-xs text-(--text-muted)">
                Deja el precio vacío para usar el precio base. Todos los importes llevan el impuesto incluido.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
