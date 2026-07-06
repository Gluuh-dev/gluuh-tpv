"use client";

// Ficha de FAMILIA estilo Ágora: panel de datos (padre, grupo mayor, orden de
// impresión) + panel de Estilo (texto del botón, color, imagen, visibilidad) +
// productos de la familia (familia DIRECTA del producto, 0065) + biblioteca de
// modificadores heredables. Degrada con aviso si falta la 0065.
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/app/lib/toast";
import { ArrowLeft, Loader2, Trash2, TriangleAlert, Upload, X } from "lucide-react";
import { supabaseBrowser } from "../../../lib/supabaseBrowser";
import { subirMedia } from "@/app/lib/branding";
import { AsignacionesBiblioteca } from "@/components/asignaciones-biblioteca";
import { BuscarAnadir } from "@/components/buscar-anadir";
import { GruposPuntoVenta } from "@/components/grupos-punto-venta";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COLOR_DEFECTO = "#64748b";
const NINGUNO = "__ninguno__"; // Radix Select no admite value=""

interface FamiliaOpcion { id: string; nombre: string }
interface GrupoMayor { id: string; nombre: string }
interface ProductoFila { id: string; nombre: string; categorias: string }

export default function FamiliaEditarPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const esNueva = id === "nuevo";
  const sb = supabaseBrowser();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [sin0065, setSin0065] = useState(false);
  const [tenantId, setTenantId] = useState("");

  // Panel Familia
  const [nombre, setNombre] = useState("");
  const [familiaPadreId, setFamiliaPadreId] = useState<string>(NINGUNO);
  const [grupoMayorId, setGrupoMayorId] = useState<string>(NINGUNO);
  const [ordenImpresion, setOrdenImpresion] = useState("0");
  const [orden, setOrden] = useState("0");
  // Panel Estilo
  const [textoBoton, setTextoBoton] = useState("");
  const [color, setColor] = useState(COLOR_DEFECTO);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mostrarVenta, setMostrarVenta] = useState(true);
  const [mostrarMenus, setMostrarMenus] = useState(true);

  const [familias, setFamilias] = useState<FamiliaOpcion[]>([]);
  const [gruposMayores, setGruposMayores] = useState<GrupoMayor[]>([]);
  const [productos, setProductos] = useState<ProductoFila[]>([]);
  const [todosProductos, setTodosProductos] = useState<{ id: string; nombre: string; family_id: string | null }[]>([]);

  async function cargarProductosDeFamilia() {
    // Productos con familia DIRECTA = esta (0065) + sus categorías (m2m con fallback).
    const { data: prods, error } = await sb.from("product").select("id,nombre,family_id,category_id").order("nombre");
    if (error) { setSin0065(true); return; }
    const lista = (prods as { id: string; nombre: string; family_id: string | null; category_id: string | null }[] | null) ?? [];
    setTodosProductos(lista.map((p) => ({ id: p.id, nombre: p.nombre, family_id: p.family_id })));
    const mios = lista.filter((p) => p.family_id === id);
    const [{ data: pcs }, { data: cats }] = await Promise.all([
      sb.from("product_category").select("product_id,category_id"),
      sb.from("category").select("id,nombre"),
    ]);
    const nombreCat = new Map(((cats as { id: string; nombre: string }[] | null) ?? []).map((c) => [c.id, c.nombre]));
    const catsDe = new Map<string, string[]>();
    for (const pc of (pcs as { product_id: string; category_id: string }[] | null) ?? []) {
      const l = catsDe.get(pc.product_id) ?? [];
      const n = nombreCat.get(pc.category_id);
      if (n) l.push(n);
      catsDe.set(pc.product_id, l);
    }
    setProductos(mios.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      categorias: (catsDe.get(p.id) ?? (p.category_id ? [nombreCat.get(p.category_id) ?? ""] : [])).filter(Boolean).join(", "),
    })));
  }

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: gm }, famRes] = await Promise.all([
        sb.from("tenant").select("id").limit(1).maybeSingle(),
        sb.from("grupo_mayor").select("id,nombre").order("nombre"),
        sb.from("family").select("id,nombre").order("nombre"),
      ]);
      setTenantId((t as { id: string } | null)?.id ?? "");
      setGruposMayores((gm as GrupoMayor[] | null) ?? []);
      setFamilias(((famRes.data as FamiliaOpcion[] | null) ?? []).filter((f) => f.id !== id));

      if (!esNueva) {
        const full = await sb.from("family")
          .select("nombre,color,orden,grupo_mayor_id,familia_padre_id,orden_impresion,texto_boton,foto_url,mostrar_venta,mostrar_menus")
          .eq("id", id).maybeSingle();
        if (full.error) {
          setSin0065(true);
          const { data } = await sb.from("family").select("nombre,color,orden,grupo_mayor_id,mostrar_venta,mostrar_menus").eq("id", id).maybeSingle();
          const f = data as { nombre: string; color: string | null; orden: number | null; grupo_mayor_id: string | null; mostrar_venta: boolean | null; mostrar_menus: boolean | null } | null;
          if (!f) { toast.error("No se pudo cargar la familia."); router.push("/familias"); return; }
          setNombre(f.nombre); setColor(f.color ?? COLOR_DEFECTO); setOrden(String(f.orden ?? 0));
          setGrupoMayorId(f.grupo_mayor_id ?? NINGUNO);
          setMostrarVenta(f.mostrar_venta ?? true); setMostrarMenus(f.mostrar_menus ?? true);
        } else {
          const f = full.data as {
            nombre: string; color: string | null; orden: number | null; grupo_mayor_id: string | null;
            familia_padre_id: string | null; orden_impresion: number | null; texto_boton: string | null;
            foto_url: string | null; mostrar_venta: boolean | null; mostrar_menus: boolean | null;
          } | null;
          if (!f) { toast.error("No se pudo cargar la familia."); router.push("/familias"); return; }
          setNombre(f.nombre); setColor(f.color ?? COLOR_DEFECTO); setOrden(String(f.orden ?? 0));
          setGrupoMayorId(f.grupo_mayor_id ?? NINGUNO);
          setFamiliaPadreId(f.familia_padre_id ?? NINGUNO);
          setOrdenImpresion(String(f.orden_impresion ?? 0));
          setTextoBoton(f.texto_boton ?? "");
          setFotoUrl(f.foto_url);
          setMostrarVenta(f.mostrar_venta ?? true); setMostrarMenus(f.mostrar_menus ?? true);
        }
        await cargarProductosDeFamilia();
      }
      setCargando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esNueva, id]);

  async function subirFoto(file: File) {
    if (!tenantId) return;
    setSubiendo(true);
    try { setFotoUrl(await subirMedia(sb, tenantId, file, "familias")); }
    catch (e) { toast.error(`No se pudo subir la imagen: ${e instanceof Error ? e.message : e}`); }
    setSubiendo(false);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { toast.error("El nombre es obligatorio."); return; }
    setGuardando(true);
    const base: Record<string, unknown> = {
      nombre: nombre.trim(),
      color,
      orden: Number(orden) || 0,
      grupo_mayor_id: grupoMayorId === NINGUNO ? null : grupoMayorId,
      mostrar_venta: mostrarVenta,
      mostrar_menus: mostrarMenus,
    };
    if (!sin0065) {
      base.familia_padre_id = familiaPadreId === NINGUNO ? null : familiaPadreId;
      base.orden_impresion = Number(ordenImpresion) || 0;
      base.texto_boton = textoBoton.trim() || null;
      base.foto_url = fotoUrl;
    }
    const { error } = esNueva
      ? await sb.from("family").insert({ tenant_id: tenantId, ...base })
      : await sb.from("family").update(base).eq("id", id);
    setGuardando(false);
    if (error) { toast.error("No se pudo guardar."); return; }
    toast.success(esNueva ? "Familia creada." : "Cambios guardados.");
    router.push("/familias");
  }

  async function eliminar() {
    if (!window.confirm(`¿Eliminar la familia «${nombre}»? Sus productos quedarán sin familia.`)) return;
    const { error } = await sb.from("family").delete().eq("id", id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    toast.success("Familia eliminada.");
    router.push("/familias");
  }

  async function anadirProducto(productId: string) {
    const { error } = await sb.from("product").update({ family_id: id }).eq("id", productId);
    if (error) { toast.error("No se pudo añadir el producto."); return; }
    await cargarProductosDeFamilia();
  }
  async function quitarProducto(productId: string) {
    const { error } = await sb.from("product").update({ family_id: null }).eq("id", productId);
    if (error) { toast.error("No se pudo quitar el producto."); return; }
    await cargarProductosDeFamilia();
  }

  if (cargando) return <div className="w-full"><p className="text-sm text-muted-foreground">Cargando…</p></div>;

  const candidatos = todosProductos
    .filter((p) => p.family_id !== id)
    .map((p) => ({ id: p.id, etiqueta: p.nombre, extra: p.family_id ? "cambiará de familia" : undefined }));

  return (
    <form onSubmit={guardar} className="w-full space-y-4 pb-16">
      <div>
        <Link href="/familias" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Familias
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{esNueva ? "Nueva familia" : nombre || "Editar familia"}</h1>
      </div>

      {sin0065 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Falta aplicar la migración <strong>0065</strong>: familia padre, orden de impresión, estilo y productos de la familia no están disponibles.</p>
        </div>
      )}

      {/* ── Dos paneles: Familia + Estilo (disposición Ágora) ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Familia</h2>
            <div className="space-y-1.5">
              <Label htmlFor="f-nombre">Nombre</Label>
              <Input id="f-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="CAFE, CERVEZA, BOCADILLOS…" autoFocus={esNueva} />
            </div>
            {!sin0065 && (
              <div className="space-y-1.5">
                <Label htmlFor="f-padre">Familia padre</Label>
                <Select value={familiaPadreId} onValueChange={setFamiliaPadreId}>
                  <SelectTrigger id="f-padre" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NINGUNO}>&lt;Ninguno&gt;</SelectItem>
                    {familias.map((f) => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="f-gm">Grupo mayor</Label>
              <Select value={grupoMayorId} onValueChange={setGrupoMayorId}>
                <SelectTrigger id="f-gm" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NINGUNO}>&lt;Ninguno&gt;</SelectItem>
                  {gruposMayores.map((g) => <SelectItem key={g.id} value={g.id}>{g.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {!sin0065 && (
                <div className="space-y-1.5">
                  <Label htmlFor="f-ordimp">Orden de impresión en factura</Label>
                  <Input id="f-ordimp" type="number" inputMode="numeric" value={ordenImpresion} onChange={(e) => setOrdenImpresion(e.target.value)} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="f-orden">Orden en pantalla</Label>
                <Input id="f-orden" type="number" inputMode="numeric" value={orden} onChange={(e) => setOrden(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Estilo</h2>
            {!sin0065 && (
              <div className="space-y-1.5">
                <Label htmlFor="f-texto">Texto</Label>
                <Input id="f-texto" value={textoBoton} onChange={(e) => setTextoBoton(e.target.value)} placeholder={nombre || "Texto del botón"} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="f-color">Color</Label>
              <div className="flex items-center gap-2">
                <input id="f-color" type="color" value={color} onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-input/30 p-1" aria-label="Selector de color" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="w-32 font-mono" aria-label="Color en hexadecimal" />
              </div>
            </div>
            {!sin0065 && (
              <div className="space-y-1.5">
                <Label>Imagen</Label>
                <div className="flex items-center gap-3">
                  {fotoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fotoUrl} alt="Imagen de la familia" className="h-14 w-14 rounded-md border border-border object-cover" />
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
            )}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-sm">
                <Switch id="f-venta" checked={mostrarVenta} onCheckedChange={setMostrarVenta} />
                <label htmlFor="f-venta">Mostrar esta familia en la pantalla de venta</label>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Switch id="f-menus" checked={mostrarMenus} onCheckedChange={setMostrarMenus} />
                <label htmlFor="f-menus">Mostrar esta familia en la pantalla de configuración de menús</label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Productos de la familia (familia directa del producto, 0065) ── */}
      {!esNueva && !sin0065 && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Productos de la familia</h2>
            <BuscarAnadir opciones={candidatos} onAnadir={anadirProducto} placeholder="Buscar y añadir producto…" />
            {productos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Esta familia aún no tiene productos.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
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
                      <TableCell className="text-muted-foreground">{p.categorias || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          aria-label={`Quitar ${p.nombre} de la familia`} onClick={() => quitarProducto(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="text-xs text-muted-foreground">{productos.length} producto{productos.length === 1 ? "" : "s"} · heredan los modificadores y el estilo de la familia.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Grupos de puntos de venta (0067) ── */}
      {!esNueva && <GruposPuntoVenta nivel="familia" refId={id} />}

      {/* ── Modificadores heredables (biblioteca, Fase 2) ── */}
      {!esNueva && <AsignacionesBiblioteca nivel="familia" refId={id} />}

      {/* ── Acciones ── */}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={guardando}>
          {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Aceptar
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/familias")}>Cancelar</Button>
        {!esNueva && (
          <Button type="button" variant="destructive" className="ml-auto" onClick={eliminar}>
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        )}
      </div>
    </form>
  );
}
