"use client";

// Ficha de CATEGORÍA estilo Ágora: panel de datos (padre, familia, estación) +
// Estilo (texto, imagen, visibilidad TPV/menús) + productos de la categoría
// (m2m product_category) + centros de venta + carta digital + biblioteca de
// modificadores. Degrada con aviso si falta la 0065.
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/app/lib/toast";
import { ArrowLeft, Loader2, Trash2, TriangleAlert, Upload, X } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { subirMedia } from "@/app/lib/branding";
import { ESTACIONES, ESTACION_LABEL } from "@/app/lib/estaciones";
import { AsignacionesBiblioteca } from "@/components/asignaciones-biblioteca";
import { BuscarAnadir } from "@/components/buscar-anadir";
import { GruposPuntoVenta } from "@/components/grupos-punto-venta";
import { HorarioCategoria } from "@/components/horario-categoria";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NINGUNO = "__ninguno__";
const SIN_ESTACION = "__sin__";
const COLOR_SIN = "#cbd5e1";

interface Opcion { id: string; nombre: string }
interface FamiliaOpcion { id: string; nombre: string; color: string | null }
interface ProductoFila { id: string; nombre: string; familia: string; categorias: string }

export default function CategoriaEditarPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const esNueva = id === "nuevo";
  const sb = supabaseBrowser();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [sin0065, setSin0065] = useState(false);
  const [tenantId, setTenantId] = useState("");

  // Panel Categoría
  const [nombre, setNombre] = useState("");
  const [padreId, setPadreId] = useState<string>(NINGUNO);
  const [familyId, setFamilyId] = useState<string>(NINGUNO);
  const [orden, setOrden] = useState("0");
  const [estacion, setEstacion] = useState<string>(SIN_ESTACION);
  // Panel Estilo
  const [textoBoton, setTextoBoton] = useState("");
  const [colorPropio, setColorPropio] = useState<string | null>(null); // null = hereda el de la familia (0066)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mostrarVenta, setMostrarVenta] = useState(true);
  const [mostrarMenus, setMostrarMenus] = useState(true);
  // Carta digital
  const [cartaNombre, setCartaNombre] = useState("");
  const [cartaDescripcion, setCartaDescripcion] = useState("");

  const [familias, setFamilias] = useState<FamiliaOpcion[]>([]);
  const [categorias, setCategorias] = useState<Opcion[]>([]);
  const [productos, setProductos] = useState<ProductoFila[]>([]);
  const [todosProductos, setTodosProductos] = useState<{ id: string; nombre: string; enEsta: boolean }[]>([]);
  // Centros de venta: sin filas = asociar a todos.
  const [centros, setCentros] = useState<Opcion[]>([]);
  const [centrosAsignados, setCentrosAsignados] = useState<Opcion[]>([]);
  const [soloSeleccionados, setSoloSeleccionados] = useState(false);
  const [sinCentros, setSinCentros] = useState(false); // tabla category_sales_center ausente

  const colorHeredado = familias.find((f) => f.id === familyId)?.color ?? COLOR_SIN;

  const cargarProductos = useCallback(async () => {
    const [{ data: prods }, { data: pcs }, { data: cats }, { data: fams }] = await Promise.all([
      sb.from("product").select("id,nombre,category_id,family_id").order("nombre"),
      sb.from("product_category").select("product_id,category_id"),
      sb.from("category").select("id,nombre"),
      sb.from("family").select("id,nombre"),
    ]);
    const lista = (prods as { id: string; nombre: string; category_id: string | null; family_id?: string | null }[] | null) ?? [];
    const rel = (pcs as { product_id: string; category_id: string }[] | null) ?? [];
    const nombreCat = new Map(((cats as Opcion[] | null) ?? []).map((c) => [c.id, c.nombre]));
    const nombreFam = new Map(((fams as Opcion[] | null) ?? []).map((f) => [f.id, f.nombre]));
    const catsDe = new Map<string, string[]>();
    for (const pc of rel) {
      const l = catsDe.get(pc.product_id) ?? [];
      l.push(pc.category_id);
      catsDe.set(pc.product_id, l);
    }
    const enEsta = (p: { id: string; category_id: string | null }) =>
      (catsDe.get(p.id) ?? (p.category_id ? [p.category_id] : [])).includes(id);
    setTodosProductos(lista.map((p) => ({ id: p.id, nombre: p.nombre, enEsta: enEsta(p) })));
    setProductos(lista.filter(enEsta).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      familia: (p.family_id && nombreFam.get(p.family_id)) || "—",
      categorias: (catsDe.get(p.id) ?? (p.category_id ? [p.category_id] : []))
        .map((cid) => nombreCat.get(cid)).filter(Boolean).join(", "),
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cargarCentros = useCallback(async () => {
    const [sc, csc] = await Promise.all([
      sb.from("sales_center").select("id,nombre").order("nombre"),
      sb.from("category_sales_center").select("sales_center_id").eq("category_id", id),
    ]);
    setCentros((sc.data as Opcion[] | null) ?? []);
    if (csc.error) { setSinCentros(true); return; }
    const ids = new Set(((csc.data as { sales_center_id: string }[] | null) ?? []).map((r) => r.sales_center_id));
    const asignados = (((sc.data as Opcion[] | null) ?? [])).filter((c) => ids.has(c.id));
    setCentrosAsignados(asignados);
    setSoloSeleccionados(asignados.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: fams }, { data: cats }] = await Promise.all([
        sb.from("tenant").select("id").limit(1).maybeSingle(),
        sb.from("family").select("id,nombre,color").order("nombre"),
        sb.from("category").select("id,nombre").order("nombre"),
      ]);
      setTenantId((t as { id: string } | null)?.id ?? "");
      setFamilias((fams as FamiliaOpcion[] | null) ?? []);
      setCategorias(((cats as Opcion[] | null) ?? []).filter((c) => c.id !== id));

      if (!esNueva) {
        const full = await sb.from("category")
          .select("nombre,family_id,orden,estacion,foto_url,categoria_padre_id,texto_boton,color,carta_nombre,carta_descripcion,mostrar_venta,mostrar_menus")
          .eq("id", id).maybeSingle();
        if (full.error) {
          setSin0065(true);
          const { data } = await sb.from("category").select("nombre,family_id,orden,estacion,foto_url,mostrar_venta,mostrar_menus").eq("id", id).maybeSingle();
          const c = data as { nombre: string; family_id: string | null; orden: number | null; estacion: string | null; foto_url: string | null; mostrar_venta: boolean | null; mostrar_menus: boolean | null } | null;
          if (!c) { toast.error("No se pudo cargar la categoría."); router.push("/categorias"); return; }
          setNombre(c.nombre); setFamilyId(c.family_id ?? NINGUNO); setOrden(String(c.orden ?? 0));
          setEstacion(c.estacion ?? SIN_ESTACION); setFotoUrl(c.foto_url);
          setMostrarVenta(c.mostrar_venta ?? true); setMostrarMenus(c.mostrar_menus ?? true);
        } else {
          const c = full.data as {
            nombre: string; family_id: string | null; orden: number | null; estacion: string | null;
            foto_url: string | null; categoria_padre_id: string | null; texto_boton: string | null;
            color: string | null; carta_nombre: string | null; carta_descripcion: string | null;
            mostrar_venta: boolean | null; mostrar_menus: boolean | null;
          } | null;
          if (!c) { toast.error("No se pudo cargar la categoría."); router.push("/categorias"); return; }
          setNombre(c.nombre); setFamilyId(c.family_id ?? NINGUNO); setOrden(String(c.orden ?? 0));
          setEstacion(c.estacion ?? SIN_ESTACION); setFotoUrl(c.foto_url);
          setColorPropio(c.color);
          setPadreId(c.categoria_padre_id ?? NINGUNO); setTextoBoton(c.texto_boton ?? "");
          setCartaNombre(c.carta_nombre ?? ""); setCartaDescripcion(c.carta_descripcion ?? "");
          setMostrarVenta(c.mostrar_venta ?? true); setMostrarMenus(c.mostrar_menus ?? true);
        }
        await Promise.all([cargarProductos(), cargarCentros()]);
      }
      setCargando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esNueva, id]);

  async function subirFoto(file: File) {
    if (!tenantId) return;
    setSubiendo(true);
    try { setFotoUrl(await subirMedia(sb, tenantId, file, "categorias")); }
    catch (e) { toast.error(`No se pudo subir la imagen: ${e instanceof Error ? e.message : e}`); }
    setSubiendo(false);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { toast.error("El nombre es obligatorio."); return; }
    setGuardando(true);
    const base: Record<string, unknown> = {
      nombre: nombre.trim(),
      family_id: familyId === NINGUNO ? null : familyId,
      orden: Number(orden) || 0,
      estacion: estacion === SIN_ESTACION ? null : estacion,
      foto_url: fotoUrl,
      mostrar_venta: mostrarVenta,
      mostrar_menus: mostrarMenus,
    };
    if (!sin0065) {
      base.categoria_padre_id = padreId === NINGUNO ? null : padreId;
      base.texto_boton = textoBoton.trim() || null;
      base.color = colorPropio;   // null = hereda el de la familia (0066)
      base.carta_nombre = cartaNombre.trim() || null;
      base.carta_descripcion = cartaDescripcion.trim() || null;
    }
    const { error } = esNueva
      ? await sb.from("category").insert({ tenant_id: tenantId, ...base })
      : await sb.from("category").update(base).eq("id", id);
    setGuardando(false);
    if (error) { toast.error("No se pudo guardar."); return; }
    toast.success(esNueva ? "Categoría creada." : "Cambios guardados.");
    router.push("/categorias");
  }

  async function eliminar() {
    if (!window.confirm(`¿Eliminar la categoría «${nombre}»?`)) return;
    const { error } = await sb.from("category").delete().eq("id", id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    toast.success("Categoría eliminada.");
    router.push("/categorias");
  }

  // ── Productos de la categoría (m2m product_category) ──
  async function anadirProducto(productId: string) {
    const { error } = await sb.from("product_category").insert({ tenant_id: tenantId, product_id: productId, category_id: id });
    if (error) { toast.error("No se pudo añadir el producto."); return; }
    // Si el producto no tenía categoría principal, esta pasa a serlo.
    await sb.from("product").update({ category_id: id }).eq("id", productId).is("category_id", null);
    await cargarProductos();
  }
  async function quitarProducto(productId: string) {
    const { error } = await sb.from("product_category").delete().eq("product_id", productId).eq("category_id", id);
    if (error) { toast.error("No se pudo quitar el producto."); return; }
    // Si esta era su categoría principal, promociona otra de sus m2m (o ninguna).
    const { data: p } = await sb.from("product").select("category_id").eq("id", productId).maybeSingle();
    if ((p as { category_id: string | null } | null)?.category_id === id) {
      const { data: resto } = await sb.from("product_category").select("category_id").eq("product_id", productId).limit(1);
      const nueva = ((resto as { category_id: string }[] | null) ?? [])[0]?.category_id ?? null;
      await sb.from("product").update({ category_id: nueva }).eq("id", productId);
    }
    await cargarProductos();
  }

  // ── Centros de venta ──
  async function cambiarModoCentros(solo: boolean) {
    setSoloSeleccionados(solo);
    if (!solo && centrosAsignados.length > 0) {
      const { error } = await sb.from("category_sales_center").delete().eq("category_id", id);
      if (error) { toast.error("No se pudo cambiar el modo."); return; }
      setCentrosAsignados([]);
    }
  }
  async function anadirCentro(centroId: string) {
    const { error } = await sb.from("category_sales_center").insert({ tenant_id: tenantId, category_id: id, sales_center_id: centroId });
    if (error) { toast.error("No se pudo añadir el centro."); return; }
    await cargarCentros();
  }
  async function quitarCentro(centroId: string) {
    const { error } = await sb.from("category_sales_center").delete().eq("category_id", id).eq("sales_center_id", centroId);
    if (error) { toast.error("No se pudo quitar el centro."); return; }
    await cargarCentros();
  }

  if (cargando) return <div className="w-full"><p className="text-sm text-muted-foreground">Cargando…</p></div>;

  const candidatosProductos = todosProductos.filter((p) => !p.enEsta).map((p) => ({ id: p.id, etiqueta: p.nombre }));
  const candidatosCentros = centros
    .filter((c) => !centrosAsignados.some((a) => a.id === c.id))
    .map((c) => ({ id: c.id, etiqueta: c.nombre }));

  return (
    <form onSubmit={guardar} className="w-full space-y-4 pb-16">
      <div>
        <Link href="/categorias" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Categorías
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{esNueva ? "Nueva categoría" : nombre || "Editar categoría"}</h1>
      </div>

      {sin0065 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Falta aplicar la migración <strong>0065</strong>: categoría padre, texto del botón, carta digital y centros de venta no están disponibles.</p>
        </div>
      )}

      {/* ── Dos paneles: Categoría + Estilo ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Categoría</h2>
            <div className="space-y-1.5">
              <Label htmlFor="c-nombre">Nombre</Label>
              <Input id="c-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="CAFE, REFRESCO, BOCADILLOS…" autoFocus={esNueva} />
            </div>
            {!sin0065 && (
              <div className="space-y-1.5">
                <Label htmlFor="c-padre">Categoría padre</Label>
                <Select value={padreId} onValueChange={setPadreId}>
                  <SelectTrigger id="c-padre" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NINGUNO}>&lt;Ninguna&gt;</SelectItem>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="c-familia">Familia</Label>
              <Select value={familyId} onValueChange={setFamilyId}>
                <SelectTrigger id="c-familia" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NINGUNO}>Sin familia</SelectItem>
                  {familias.map((f) => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorHeredado }} aria-hidden />
                El color lo define la familia.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="c-estacion">Estación</Label>
                <Select value={estacion} onValueChange={setEstacion}>
                  <SelectTrigger id="c-estacion" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_ESTACION}>—</SelectItem>
                    {ESTACIONES.map((s) => <SelectItem key={s} value={s}>{ESTACION_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-orden">Orden en pantalla</Label>
                <Input id="c-orden" type="number" inputMode="numeric" value={orden} onChange={(e) => setOrden(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Estilo</h2>
            {!sin0065 && (
              <div className="space-y-1.5">
                <Label htmlFor="c-texto">Texto</Label>
                <Input id="c-texto" value={textoBoton} onChange={(e) => setTextoBoton(e.target.value)} placeholder={nombre || "Texto del botón"} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="c-color">Color</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="c-color"
                  type="color"
                  value={colorPropio ?? colorHeredado}
                  onChange={(e) => setColorPropio(e.target.value)}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-input/30 p-1"
                  aria-label="Selector de color de la categoría"
                />
                <Input
                  value={colorPropio ?? ""}
                  onChange={(e) => setColorPropio(e.target.value || null)}
                  placeholder={`${colorHeredado} (de la familia)`}
                  className="w-36 font-mono"
                  aria-label="Color en hexadecimal"
                />
                {colorPropio && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setColorPropio(null)}>
                    Heredar de la familia
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {colorPropio ? "Color propio de la categoría." : "Sin color propio: usa el de la familia."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Imagen</Label>
              <div className="flex items-center gap-3">
                {fotoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotoUrl} alt="Imagen de la categoría" className="h-14 w-14 rounded-md border border-border object-cover" />
                )}
                <Button type="button" variant="outline" size="sm" asChild disabled={subiendo}>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4" /> {subiendo ? "Subiendo…" : fotoUrl ? "Cambiar" : "Subir"}
                    <input type="file" accept="image/*" className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirFoto(f); }} />
                  </label>
                </Button>
                {fotoUrl && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setFotoUrl(null)}>
                    <X className="h-4 w-4" /> Quitar
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-sm">
                <Switch id="c-venta" checked={mostrarVenta} onCheckedChange={setMostrarVenta} />
                <label htmlFor="c-venta">Mostrar esta categoría en la pantalla de venta</label>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Switch id="c-menus" checked={mostrarMenus} onCheckedChange={setMostrarMenus} />
                <label htmlFor="c-menus">Mostrar esta categoría en la pantalla de configuración de menús</label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Productos de la categoría (m2m) ── */}
      {!esNueva && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Productos de la categoría</h2>
            <BuscarAnadir opciones={candidatosProductos} onAnadir={anadirProducto} placeholder="Buscar y añadir producto…" />
            {productos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Esta categoría aún no tiene productos.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Familia</TableHead>
                    <TableHead>Categorías</TableHead>
                    <TableHead className="w-14" aria-label="Quitar" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/productos/${p.id}`} className="font-medium hover:underline">{p.nombre}</Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.familia}</TableCell>
                      <TableCell className="text-muted-foreground">{p.categorias || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          aria-label={`Quitar ${p.nombre} de la categoría`} onClick={() => quitarProducto(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="text-xs text-muted-foreground">{productos.length} producto{productos.length === 1 ? "" : "s"} · un producto puede estar en varias categorías.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Centros de venta (sin filas = asociar a todos) ── */}
      {!esNueva && !sin0065 && !sinCentros && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Centros de venta</h2>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="c-centros" checked={!soloSeleccionados} onChange={() => cambiarModoCentros(false)} />
                Asociar a todos los centros de venta.
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="c-centros" checked={soloSeleccionados} onChange={() => cambiarModoCentros(true)} />
                Mostrar sólo en los centros de venta seleccionados:
              </label>
            </div>
            {soloSeleccionados && (
              <>
                <BuscarAnadir opciones={candidatosCentros} onAnadir={anadirCentro} placeholder="Buscar y añadir centro de venta…" />
                {centrosAsignados.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {centros.length === 0
                      ? "No hay centros de venta creados (Administración → Centros de venta)."
                      : "Sin centros seleccionados: la categoría no se mostrará en ninguno."}
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {centrosAsignados.map((c) => (
                      <div key={c.id} className="flex items-center justify-between py-2">
                        <span className="font-medium">{c.nombre}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          aria-label={`Quitar ${c.nombre}`} onClick={() => quitarCentro(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Grupos de puntos de venta (0067) ── */}
      {!esNueva && <GruposPuntoVenta nivel="categoria" refId={id} />}

      {/* ── Horario de disponibilidad (0067) ── */}
      {!esNueva && <HorarioCategoria refId={id} />}

      {/* ── Carta digital ── */}
      {!sin0065 && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Carta digital</h2>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-carta-nombre">Nombre</Label>
                <Input id="c-carta-nombre" value={cartaNombre} onChange={(e) => setCartaNombre(e.target.value)} placeholder="Utilizar el nombre de la categoría" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-carta-desc">Descripción</Label>
                <Textarea id="c-carta-desc" rows={2} value={cartaDescripcion} onChange={(e) => setCartaDescripcion(e.target.value)} placeholder="Utilizar los nombres de los productos" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Modificadores de biblioteca (Fase 2) ── */}
      {!esNueva && <AsignacionesBiblioteca nivel="categoria" refId={id} />}

      {/* ── Acciones ── */}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={guardando}>
          {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Aceptar
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/categorias")}>Cancelar</Button>
        {!esNueva && (
          <Button type="button" variant="destructive" className="ml-auto" onClick={eliminar}>
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        )}
      </div>
    </form>
  );
}
