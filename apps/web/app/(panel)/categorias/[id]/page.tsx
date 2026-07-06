"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { ESTACIONES, ESTACION_LABEL } from "@/app/lib/estaciones";
import { subirMedia } from "@/app/lib/branding";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface Familia { id: string; nombre: string; color: string }
interface Producto { id: string; nombre: string; precio: number }

const COLOR_SIN = "#cbd5e1";
const SIN_FAMILIA = "__none__";
const SIN_ESTACION = "__sin__"; // sentinela del select: estacion = null
const eur = (n: number) => Number(n).toFixed(2) + " €";

export default function CategoriaEditar() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const { id } = useParams<{ id: string }>();
  const esNuevo = id === "nuevo";

  const [tenantId, setTenantId] = useState("");
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [conEstacion, setConEstacion] = useState(true); // columna estacion (0050)
  const [conFoto, setConFoto] = useState(true);         // columna foto_url (0044)
  const [estacionOriginal, setEstacionOriginal] = useState<string>(SIN_ESTACION);

  const [nombre, setNombre] = useState("");
  const [familyId, setFamilyId] = useState<string>(SIN_FAMILIA);
  const [estacion, setEstacion] = useState<string>(SIN_ESTACION);
  const [orden, setOrden] = useState("0");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: fam }, foto, est] = await Promise.all([
        sb.from("tenant").select("id").limit(1).maybeSingle(),
        sb.from("family").select("id,nombre,color").order("orden"),
        // Probes best-effort: si la columna no existe, el select falla y ocultamos el campo.
        sb.from("category").select("foto_url").limit(1),
        sb.from("category").select("estacion").limit(1),
      ]);
      setTenantId((t as { id: string } | null)?.id ?? "");
      setFamilias((fam as Familia[]) ?? []);
      const hayFoto = !foto.error;
      const hayEst = !est.error;
      setConFoto(hayFoto);
      setConEstacion(hayEst);

      if (!esNuevo) {
        const cols = ["id", "nombre", "family_id", "orden", hayEst && "estacion", hayFoto && "foto_url"].filter(Boolean).join(",");
        const [{ data: cat, error }, { data: prods }] = await Promise.all([
          sb.from("category").select(cols).eq("id", id).maybeSingle(),
          sb.from("product").select("id,nombre,precio").eq("category_id", id).order("nombre"),
        ]);
        const c = cat as unknown as { nombre: string; family_id: string | null; orden: number; estacion?: string | null; foto_url?: string | null } | null;
        if (error || !c) { toast.error("No se encontró la categoría."); router.replace("/categorias"); return; }
        setNombre(c.nombre);
        setFamilyId(c.family_id ?? SIN_FAMILIA);
        setOrden(String(c.orden ?? 0));
        const est0 = c.estacion ?? SIN_ESTACION;
        setEstacion(est0);
        setEstacionOriginal(est0);
        setFotoUrl(c.foto_url ?? null);
        setProductos((prods as Producto[]) ?? []);
      }
      setLoading(false);
    })();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id]);

  const familiaSel = useMemo(() => familias.find((f) => f.id === familyId) ?? null, [familias, familyId]);

  async function subirFoto(file: File) {
    setSubiendo(true);
    try {
      const url = await subirMedia(sb, tenantId, file, "categorias");
      setFotoUrl(url);
    } catch (e) {
      toast.error(`No se pudo subir la foto: ${(e as Error).message}`);
    } finally {
      setSubiendo(false);
    }
  }

  // Vuelca la estación seleccionada a todos los productos de la categoría (solo edición).
  async function aplicarEstacion() {
    if (esNuevo || estacion === SIN_ESTACION || productos.length === 0) return;
    const label = ESTACION_LABEL[estacion as (typeof ESTACIONES)[number]];
    if (!confirm(`¿Aplicar «${label}» a los ${productos.length} productos de esta categoría?`)) return;
    const { error } = await sb.from("product").update({ estacion }).eq("category_id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Estación aplicada a ${productos.length} productos.`);
  }

  async function guardar() {
    if (!nombre.trim()) { toast.error("El nombre es obligatorio."); return; }
    setGuardando(true);
    const payload: Record<string, unknown> = {
      nombre: nombre.trim(),
      family_id: familyId === SIN_FAMILIA ? null : familyId,
      orden: Number(orden) || 0,
    };
    if (conEstacion) payload.estacion = estacion === SIN_ESTACION ? null : estacion;
    if (conFoto) payload.foto_url = fotoUrl;

    const { error } = esNuevo
      ? await sb.from("category").insert({ tenant_id: tenantId, ...payload })
      : await sb.from("category").update(payload).eq("id", id);
    setGuardando(false);
    if (error) { toast.error(error.message); return; }
    toast.success(esNuevo ? "Categoría creada." : "Cambios guardados.");
    router.push("/categorias");
  }

  async function eliminar() {
    const aviso = productos.length > 0
      ? `Esta categoría tiene ${productos.length} productos, que quedarán sin categoría. ¿Eliminar de todas formas?`
      : "¿Eliminar esta categoría?";
    if (!confirm(aviso)) return;
    const { error } = await sb.from("category").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Categoría eliminada.");
    router.push("/categorias");
  }

  if (loading) return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/categorias" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Categorías
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{esNuevo ? "Nueva categoría" : "Categoría"}</h1>
      </div>
      <div className="space-y-5 rounded-lg border border-border bg-surface p-5">
        <Skeleton className="h-9 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );

  const colorHeredado = familiaSel?.color ?? COLOR_SIN;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/categorias" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Categorías
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{esNuevo ? "Nueva categoría" : nombre || "Categoría"}</h1>
      </div>

      <div className="space-y-5 rounded-lg border border-border bg-surface p-5">
        <TextField label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Refrescos, Postres…" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-(--text-muted)">Familia</label>
            <Select value={familyId} onValueChange={setFamilyId}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_FAMILIA}>Sin familia</SelectItem>
                {familias.map((f) => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-(--text-muted)">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorHeredado }} />
              El color lo define la familia.
            </p>
          </div>

          <TextField label="Orden" type="number" inputMode="numeric" value={orden} onChange={(e) => setOrden(e.target.value)} />
        </div>

        {conEstacion && (
          <div className="flex flex-col">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-(--text-muted)">Estación</label>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={estacion} onValueChange={setEstacion}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_ESTACION}>—</SelectItem>
                  {ESTACIONES.map((s) => <SelectItem key={s} value={s}>{ESTACION_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              {!esNuevo && estacion !== SIN_ESTACION && productos.length > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={aplicarEstacion}>
                  Aplicar a los {productos.length} productos
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-(--text-muted)">Define a qué impresora/pantalla van sus productos al marchar.</p>
          </div>
        )}

        {conFoto && (
          <div className="flex flex-col">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-(--text-muted)">Foto</label>
            <div className="flex items-center gap-3">
              {fotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt="Foto de la categoría" className="h-14 w-14 rounded-md border border-border object-cover" />
              )}
              <Button type="button" variant="outline" size="sm" asChild disabled={subiendo}>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4" /> {subiendo ? "Subiendo…" : fotoUrl ? "Cambiar foto" : "Subir foto"}
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFoto(f); }} />
                </label>
              </Button>
              {fotoUrl && (
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setFotoUrl(null)}>Quitar</Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : esNuevo ? "Crear categoría" : "Guardar"}</Button>
          <Button variant="outline" onClick={() => router.push("/categorias")}>Cancelar</Button>
        </div>
        {!esNuevo && (
          <Button variant="destructive" onClick={eliminar}><Trash2 className="h-4 w-4" /> Eliminar</Button>
        )}
      </div>

      {!esNuevo && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Productos de esta categoría {productos.length > 0 && <span className="text-muted-foreground/60">· {productos.length}</span>}
          </h2>
          {productos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta categoría aún no tiene productos.</p>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
              {productos.map((p) => (
                <Link key={p.id} href={`/productos/${p.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-surface-overlay">
                  <span className="truncate">{p.nombre}</span>
                  <span className="tabular-nums text-muted-foreground">{eur(p.precio)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
