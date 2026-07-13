"use client";

// Listado de PRODUCTOS sobre TablaDatos: barra Nuevo/Duplicar/Editar/Eliminar +
// buscador + filtro de categoría; columnas fijas (check·#·Nombre) al scrollar.
// Duplicar copia el producto EXACTO (categorías m2m, formatos y modificadores),
// con id nuevo, nombre + « - copia» y PLU vacío (único por tenant).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { TablaDatos, IrA, type ColumnaDatos } from "@/components/tabla-datos";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CLASES_FISCALES } from "@/lib/fiscal-clases";
import { ESTACION_LABEL, estacionDe } from "@/app/lib/estaciones";
import { eur } from "@/app/lib/money";

interface Prod {
  id: string; nombre: string; precio: number; tipo_impositivo: number; clase_fiscal: string | null;
  category_id: string | null; family_id: string | null; plu: string | null; codigo_barras: string | null;
  es_principal: boolean; es_anadido: boolean; estacion: string | null;
  disponible: boolean; agotado_hasta: string | null;
}

const TODAS = "__todas__";
const SIN_CAT = "__sincat__";
const siNo = (v: boolean) => (v ? "Sí" : "No");
const SiNo = ({ v }: Readonly<{ v: boolean }>) => (
  <span className={v ? "font-medium text-emerald-600 dark:text-emerald-500" : "text-muted-foreground"}>{siNo(v)}</span>
);
function sinMeta(o: Record<string, unknown>) {
  const row = { ...o };
  for (const k of ["id", "created_at", "updated_at"]) delete row[k];
  return row;
}

export default function ProductosLista() {
  const router = useRouter();
  const [familias, setFamilias] = useState<{ id: string; nombre: string; color: string | null }[]>([]);
  const [cats, setCats] = useState<{ id: string; nombre: string }[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [prodCats, setProdCats] = useState<Map<string, string[]>>(new Map());
  const [catFiltro, setCatFiltro] = useState<string>(TODAS);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const sb = supabaseBrowser();
    const COLS = "id,nombre,precio,tipo_impositivo,clase_fiscal,category_id,estacion,disponible,agotado_hasta,codigo_barras";
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
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

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

  // Filtro por categoría (el buscador de texto lo lleva la propia tabla).
  const filtrados = useMemo(() => {
    if (catFiltro === TODAS) return prods;
    return prods.filter((p) => (catFiltro === SIN_CAT ? catsDe(p).length === 0 : catsDe(p).includes(catFiltro)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prods, catFiltro, prodCats]);

  async function eliminar(p: Prod) {
    const { error } = await supabaseBrowser().from("product").delete().eq("id", p.id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    setProds((prev) => prev.filter((x) => x.id !== p.id));
  }

  async function duplicar(p: Prod) {
    const sb = supabaseBrowser();
    const [{ data: t }, { data: o }] = await Promise.all([
      sb.from("tenant").select("id").limit(1).maybeSingle(),
      sb.from("product").select("*").eq("id", p.id).maybeSingle(),
    ]);
    if (!o) return;
    const tid = (t as { id: string } | null)?.id;
    const row = sinMeta(o as Record<string, unknown>);
    row.tenant_id = tid;
    row.nombre = `${String(row.nombre)} - copia`;
    row.plu = null; // PLU único por tenant
    const { data: nuevo, error } = await sb.from("product").insert(row).select("id").single();
    if (error || !nuevo) { toast.error(`No se pudo duplicar: ${error?.message ?? ""}`); return; }
    const nid = (nuevo as { id: string }).id;

    // Relaciones: categorías m2m, formatos y modificadores propios.
    const [{ data: pcs }, { data: fmts }, mgRes] = await Promise.all([
      sb.from("product_category").select("category_id,orden").eq("product_id", p.id),
      sb.from("product_format").select("nombre,precio,orden").eq("product_id", p.id),
      sb.from("modifier_group").select("id,nombre,min_sel,max_sel").eq("product_id", p.id),
    ]);
    const pcArr = (pcs as { category_id: string; orden: number | null }[] | null) ?? [];
    if (pcArr.length) await sb.from("product_category").insert(pcArr.map((x) => ({ tenant_id: tid, product_id: nid, ...x })));
    const fmtArr = (fmts as { nombre: string; precio: number; orden: number | null }[] | null) ?? [];
    if (fmtArr.length) await sb.from("product_format").insert(fmtArr.map((x) => ({ tenant_id: tid, product_id: nid, ...x })));
    if (!mgRes.error) {
      for (const g of (mgRes.data as { id: string; nombre: string; min_sel: number; max_sel: number }[] | null) ?? []) {
        const { data: ng } = await sb.from("modifier_group")
          .insert({ tenant_id: tid, product_id: nid, nombre: g.nombre, min_sel: g.min_sel, max_sel: g.max_sel }).select("id").single();
        if (!ng) continue;
        const { data: ops } = await sb.from("modifier").select("nombre,precio_extra").eq("modifier_group_id", g.id);
        const opArr = (ops as { nombre: string; precio_extra: number }[] | null) ?? [];
        if (opArr.length) await sb.from("modifier").insert(opArr.map((op) => ({ tenant_id: tid, modifier_group_id: (ng as { id: string }).id, ...op })));
      }
    }
    toast.success("Producto duplicado.");
    await cargar();
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
    { clave: "barras", titulo: "Cód. barras", valor: (p) => p.codigo_barras, render: (p) => <span className="tabular-nums text-muted-foreground">{p.codigo_barras ?? "—"}</span> },
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

  const filtroCategoria = (
    <Select value={catFiltro} onValueChange={setCatFiltro}>
      <SelectTrigger size="sm" className="h-8 w-48 border-border bg-background"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={TODAS}>Todas las categorías</SelectItem>
        {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
        <SelectItem value={SIN_CAT}>Sin categoría</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title="Productos"
        description={cargando ? "Cargando la carta…" : "Artículos de la carta con su familia, categorías y precios."}
      />

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
          onNuevo={() => router.push("/productos/nuevo")}
          onAbrir={(p) => router.push(`/productos/${p.id}`)}
          onCopiar={duplicar}
          onEliminar={eliminar}
          filtros={filtroCategoria}
          exportarNombre="productos"
          cargando={cargando}
        />
      )}
    </div>
  );
}
