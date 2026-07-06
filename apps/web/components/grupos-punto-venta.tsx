"use client";

// Sección "Grupos de puntos de venta" (0067) para fichas de familia y categoría,
// patrón Ágora: radio «asociar a todos» (= sin filas) / «solo en los grupos
// seleccionados» + buscador para añadir. Los grupos agrupan dispositivos TPV
// (device.grupo_punto_venta_id); si no existe ninguno, permite crear el primero.
// Nota: el TPV aún no filtra por grupo (llegará con la identidad de dispositivo).
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MonitorSmartphone, Plus, Trash2, TriangleAlert } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { BuscarAnadir } from "@/components/buscar-anadir";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Nivel = "familia" | "categoria";
interface Grupo { id: string; nombre: string }

const TABLA: Record<Nivel, string> = { familia: "family_grupo_pv", categoria: "category_grupo_pv" };
const CAMPO: Record<Nivel, string> = { familia: "family_id", categoria: "category_id" };

export function GruposPuntoVenta({ nivel, refId }: Readonly<{ nivel: Nivel; refId: string }>) {
  const sb = supabaseBrowser();
  const [cargando, setCargando] = useState(true);
  const [sin0067, setSin0067] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [asignados, setAsignados] = useState<Grupo[]>([]);
  const [soloSeleccionados, setSoloSeleccionados] = useState(false);
  const [nuevoGrupo, setNuevoGrupo] = useState("");

  const cargar = useCallback(async () => {
    const [g, a, { data: t }] = await Promise.all([
      sb.from("grupo_punto_venta").select("id,nombre").order("nombre"),
      sb.from(TABLA[nivel]).select("grupo_id").eq(CAMPO[nivel], refId),
      sb.from("tenant").select("id").limit(1).maybeSingle(),
    ]);
    if (g.error || a.error) { setSin0067(true); setCargando(false); return; }
    setTenantId((t as { id: string } | null)?.id ?? null);
    const lista = (g.data as Grupo[] | null) ?? [];
    setGrupos(lista);
    const ids = new Set(((a.data as { grupo_id: string }[] | null) ?? []).map((r) => r.grupo_id));
    const asig = lista.filter((x) => ids.has(x.id));
    setAsignados(asig);
    setSoloSeleccionados(asig.length > 0);
    setCargando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivel, refId]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function cambiarModo(solo: boolean) {
    setSoloSeleccionados(solo);
    if (!solo && asignados.length > 0) {
      const { error } = await sb.from(TABLA[nivel]).delete().eq(CAMPO[nivel], refId);
      if (error) { toast.error(`No se pudo cambiar el modo: ${error.message}`); return; }
      setAsignados([]);
    }
  }
  async function anadir(grupoId: string) {
    const { error } = await sb.from(TABLA[nivel]).insert({ tenant_id: tenantId, [CAMPO[nivel]]: refId, grupo_id: grupoId });
    if (error) { toast.error(`No se pudo añadir: ${error.message}`); return; }
    await cargar();
  }
  async function quitar(grupoId: string) {
    const { error } = await sb.from(TABLA[nivel]).delete().eq(CAMPO[nivel], refId).eq("grupo_id", grupoId);
    if (error) { toast.error(`No se pudo quitar: ${error.message}`); return; }
    await cargar();
  }
  async function crearGrupo() {
    if (!nuevoGrupo.trim() || !tenantId) return;
    const { error } = await sb.from("grupo_punto_venta").insert({ tenant_id: tenantId, nombre: nuevoGrupo.trim() });
    if (error) { toast.error(`No se pudo crear el grupo: ${error.message}`); return; }
    toast.success("Grupo creado.");
    setNuevoGrupo("");
    await cargar();
  }

  if (sin0067) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>Falta aplicar la migración <strong>0067</strong> (grupos de puntos de venta).</p>
      </div>
    );
  }

  const candidatos = grupos
    .filter((g) => !asignados.some((a) => a.id === g.id))
    .map((g) => ({ id: g.id, etiqueta: g.nombre }));

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div>
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            <MonitorSmartphone className="h-4 w-4" aria-hidden /> Grupos de puntos de venta
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Los grupos reúnen dispositivos TPV (se asignan en Dispositivos). Sin selección, se muestra en todos.
          </p>
        </div>

        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name={`gpv-${nivel}`} checked={!soloSeleccionados} onChange={() => cambiarModo(false)} />
                Asociar a todos los grupos de punto de venta.
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name={`gpv-${nivel}`} checked={soloSeleccionados} onChange={() => cambiarModo(true)} />
                Mostrar sólo en los grupos seleccionados:
              </label>
            </div>

            {soloSeleccionados && (
              <>
                {grupos.length > 0 && <BuscarAnadir opciones={candidatos} onAnadir={anadir} placeholder="Buscar y añadir grupo…" />}
                {asignados.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {grupos.length === 0 ? "Aún no hay grupos: crea el primero abajo." : "Sin grupos seleccionados: no se mostrará en ningún punto de venta."}
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {asignados.map((g) => (
                      <div key={g.id} className="flex items-center justify-between py-2">
                        <span className="font-medium">{g.nombre}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          aria-label={`Quitar ${g.nombre}`} onClick={() => quitar(g.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    value={nuevoGrupo}
                    onChange={(e) => setNuevoGrupo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void crearGrupo(); } }}
                    placeholder="Crear grupo nuevo (Barra, Terraza…)"
                    className="w-64"
                    aria-label="Nombre del grupo nuevo"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={crearGrupo} disabled={!nuevoGrupo.trim()}>
                    <Plus className="h-3.5 w-3.5" /> Crear
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
