"use client";

// Listado de PRODUCTOS estilo Ágora sobre TablaDatos: scroll con cabecera fija,
// ordenación por columna, selección + exportar, acciones junto al nombre y
// botón «ir a» hacia familia y categoría principal.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Search } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { TablaDatos, IrA, type ColumnaDatos } from "@/components/tabla-datos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CLASES_FISCALES } from "@/lib/fiscal-clases";
import { ESTACION_LABEL, estacionDe } from "@/app/lib/estaciones";

interface Prod {
  id: string; nombre: string; precio: number; tipo_impositivo: number; clase_fiscal: string | null;
  category_id: string | null; family_id: string | null; plu: string | null;
  es_principal: boolean; es_anadido: boolean; estacion: string | null;
  disponible: boolean; agotado_hasta: string | null;
}

const eur = (n: number) => Number(n).toFixed(2).replace(".", ",") + " €";
const TODAS = "__todas__";
const SIN_CAT = "__sincat__";
const siNo = (v: boolean) => (v ? "Sí" : "No");
const SiNo = ({ v }: Readonly<{ v: boolean }>) => (
  <span className={v ? "font-medium text-emerald-600 dark:text-emerald-500" : "text-muted-foreground"}>{siNo(v)}</span>
);

export default function ProductosLista() {
  const router = useRouter();
  const [familias, setFamilias] = useState<{ id: string; nombre: string; color: string | null }[]>([]);
  const [cats, setCats] = useState<{ id: string; nombre: string }[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [prodCats, setProdCats] = useState<Map<string, string[]>>(new Map());
  const [busca, setBusca] = useState("");
  const [catFiltro, setCatFiltro] = useState<string>(TODAS);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const COLS = "id,nombre,precio,tipo_impositivo,clase_fiscal,category_id,estacion,disponible,agotado_hasta";
      const full = await sb.from("product").select(`${COLS},family_id,plu,es_principal,es_anadido`).order("nombre");
      let lista: Prod[];
      if (full.error) {
        const { data } = await sb.from("product").select(COLS).order("nombre");
        lista = ((data as Omit<Prod, "family_id" | "plu" | "es_principal" | "es_anadido">[] | null) ?? [])
          .map((p) => ({ ...p, family_id: null, plu: null, es_principal: true, es_anadido: false }));
      } else {
        lista = (full.data as Prod[] | null) ?? [];
      }
      const [{ data: fam }, { data: c }, { data: pcs }] = await Promise.all([
        sb.from("family").select("id,nombre,color"),
        sb.from("category").select("id,nombre").order("orden"),
        sb.from("product_category").select("product_id,category_id"),
      ]);
      const mapa = new Map<string, string[]>();
      for (const pc of (pcs as { product_id: string; category_id: string }[] | null) ?? []) {
        const l = mapa.get(pc.product_id) ?? [];
        l.push(pc.category_id);
        mapa.set(pc.product_id, l);
      }
      setFamilias((fam as { id: string; nombre: string; color: string | null }[] | null) ?? []);
      setCats((c as { id: string; nombre: string }[] | null) ?? []);
      setProdCats(mapa);
      setProds(lista);
      setCargando(false);
    })();
  }, []);

  const nombreFam = useMemo(() => new Map(familias.map((f) => [f.id, f.nombre])), [familias]);
  const colorFam = useMemo(() => new Map(familias.map((f) => [f.id, f.color ?? "#cbd5e1"])), [familias]);
  const nombreCat = useMemo(() => new Map(cats.map((c) => [c.id, c.nombre])), [cats]);
  const claseLabel = useMemo(() => new Map<string, string>(CLASES_FISCALES.map((c) => [c.v, c.t])), []);
  const ahora = Date.now();

  const catsDe = (p: Prod): string[] => {
    const m2m = prodCats.get(p.id);
    if (m2m?.length) return m2m;
    return p.category_id ? [p.category_id] : [];
  };
  const estadoDe = (p: Prod): string => {
    if (!p.disponible) return "Agotado";
    if (p.agotado_hasta && new Date(p.agotado_hasta).getTime() > ahora) return "86";
    return "Disponible";
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return prods.filter((p) => {
      const enCat = catFiltro === TODAS
        || (catFiltro === SIN_CAT ? catsDe(p).length === 0 : catsDe(p).includes(catFiltro));
      return enCat && (!q || p.nombre.toLowerCase().includes(q) || (p.plu ?? "").toLowerCase() === q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prods, catFiltro, busca, prodCats]);

  async function eliminar(p: Prod) {
    if (!window.confirm(`¿Eliminar «${p.nombre}»? No se puede deshacer.`)) return;
    const { error } = await supabaseBrowser().from("product").delete().eq("id", p.id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    toast.success("Producto eliminado.");
    setProds((prev) => prev.filter((x) => x.id !== p.id));
  }

  const columnas: ColumnaDatos<Prod>[] = [
    {
      clave: "nombre", titulo: "Nombre",
      valor: (p) => p.nombre,
      render: (p) => (
        <span className="flex items-center gap-2.5 font-medium">
          <span className="inline-block h-5 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: (p.family_id && colorFam.get(p.family_id)) || "#cbd5e1" }} aria-hidden />
          {p.nombre}
        </span>
      ),
    },
    {
      clave: "familia", titulo: "Familia",
      valor: (p) => (p.family_id && nombreFam.get(p.family_id)) ?? null,
      render: (p) => {
        const n = p.family_id ? nombreFam.get(p.family_id) : null;
        return n
          ? <span className="text-muted-foreground">{n}<IrA href={`/familias/${p.family_id}`} titulo={n} /></span>
          : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      clave: "categorias", titulo: "Categorías",
      valor: (p) => catsDe(p).map((cid) => nombreCat.get(cid)).filter(Boolean).join(", ") || null,
      render: (p) => {
        const ids = catsDe(p);
        if (!ids.length) return <span className="text-muted-foreground">—</span>;
        const principal = p.category_id ?? ids[0]!;
        return (
          <span className="inline-block max-w-56 truncate align-middle text-muted-foreground" title={ids.map((cid) => nombreCat.get(cid)).join(", ")}>
            {ids.map((cid) => nombreCat.get(cid)).filter(Boolean).join(", ")}
            <IrA href={`/categorias/${principal}`} titulo={nombreCat.get(principal) ?? "categoría"} />
          </span>
        );
      },
    },
    { clave: "plu", titulo: "PLU", valor: (p) => p.plu, render: (p) => <span className="tabular-nums text-muted-foreground">{p.plu ?? "—"}</span> },
    {
      clave: "impuesto", titulo: "Impuesto",
      valor: (p) => (p.clase_fiscal ? (claseLabel.get(p.clase_fiscal) ?? p.clase_fiscal) : `${p.tipo_impositivo}%`),
      render: (p) => <span className="text-muted-foreground">{p.clase_fiscal ? (claseLabel.get(p.clase_fiscal) ?? p.clase_fiscal) : `${p.tipo_impositivo}%`}</span>,
    },
    {
      clave: "prep", titulo: "Tipo de prep.",
      valor: (p) => ESTACION_LABEL[estacionDe(p.estacion)],
      render: (p) => <span className="text-muted-foreground">{ESTACION_LABEL[estacionDe(p.estacion)]}</span>,
    },
    { clave: "principal", titulo: "Principal", alinear: "centro", valor: (p) => siNo(p.es_principal), render: (p) => <SiNo v={p.es_principal} /> },
    { clave: "anadido", titulo: "Añadido", alinear: "centro", valor: (p) => siNo(p.es_anadido), render: (p) => <SiNo v={p.es_anadido} /> },
    { clave: "precio", titulo: "Precio", alinear: "der", valor: (p) => Number(p.precio), render: (p) => <span className="tabular-nums">{eur(p.precio)}</span> },
    {
      clave: "estado", titulo: "Estado", alinear: "der",
      valor: (p) => estadoDe(p),
      render: (p) => {
        const e = estadoDe(p);
        return <span className={`text-xs ${e === "Disponible" ? "text-emerald-600 dark:text-emerald-500" : "text-amber-600 dark:text-amber-500"}`}>{e}</span>;
      },
    },
  ];

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Productos"
        description={cargando ? "Cargando la carta…" : "Artículos de la carta con su familia, categorías y precios."}
        actions={<Button onClick={() => router.push("/productos/nuevo")}><Plus className="h-4 w-4" /> Nuevo</Button>}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={catFiltro} onValueChange={setCatFiltro}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas las categorías</SelectItem>
            {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            <SelectItem value={SIN_CAT}>Sin categoría</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Buscar por nombre o PLU…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar producto" />
        </div>
      </div>

      {!cargando && prods.length === 0 ? (
        <EmptyState
          icon={<Package className="h-8 w-8" />}
          title="Aún no hay productos"
          description="Crea tu primer producto para empezar a montar la carta."
          action={<Button onClick={() => router.push("/productos/nuevo")}><Plus className="h-4 w-4" /> Nuevo</Button>}
        />
      ) : (
        <TablaDatos
          columnas={columnas}
          filas={filtrados}
          idDe={(p) => p.id}
          onAbrir={(p) => router.push(`/productos/${p.id}`)}
          onEliminar={eliminar}
          exportarNombre="productos"
          cargando={cargando}
          vacio="Sin resultados."
        />
      )}
    </div>
  );
}
