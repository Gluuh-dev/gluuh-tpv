"use client";

// Perfiles y permisos, estilo Ágora: permiso = (Aplicación, acción). El catálogo
// (agrupado) vive en lib/permisos.ts; aquí se editan los concedidos del perfil
// (perfil.permisos, 0048). Desde Empleados se asigna un perfil a cada empleado
// (app_user.perfil_id, 0070) y se copian sus permisos a app_user.permisos.
// Si 0048 no está aplicada, el CRUD sigue y los permisos quedan deshabilitados.
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/app/lib/toast";
import { Copy, Pencil, Plus, Search, Trash2, TriangleAlert } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { CATALOGO_PERMISOS, type MapaPermisos } from "../../lib/permisos";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Perfil { id: string; nombre: string; descripcion: string | null; permisos?: MapaPermisos }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function Perfiles() {
  const sb = supabaseBrowser();
  const [tenantId, setTenantId] = useState("");
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [sinMigracion, setSinMigracion] = useState(false);
  const [form, setForm] = useState({ nombre: "", descripcion: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [permForm, setPermForm] = useState<MapaPermisos>({});
  const [permBusqueda, setPermBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
      setTenantId((t as { id: string } | null)?.id ?? "");
      // Con permisos; si la columna no existe aún (0048 sin aplicar) → aviso.
      const conPermisos = await sb.from("perfil").select("id,nombre,descripcion,permisos").order("nombre");
      if (conPermisos.error) {
        const { data } = await sb.from("perfil").select("id,nombre,descripcion").order("nombre");
        setPerfiles((data as Perfil[]) ?? []);
        setSinMigracion(true);
      } else {
        setPerfiles((conPermisos.data as Perfil[]) ?? []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sel = perfiles.find((p) => p.id === selId) ?? null;

  function seleccionar(p: Perfil) {
    setSelId(p.id);
    setPermForm({ ...(p.permisos ?? {}) });
    setPermBusqueda("");
  }

  function abrirEditar(p: Perfil) {
    setEditId(p.id);
    setForm({ nombre: p.nombre, descripcion: p.descripcion ?? "" });
  }

  async function guardarFicha(e: React.FormEvent) {
    e.preventDefault();
    const nombre = form.nombre.trim();
    if (!nombre) return;
    const payload = { nombre, descripcion: form.descripcion.trim() || null };
    if (editId) {
      const { error } = await sb.from("perfil").update(payload).eq("id", editId);
      if (error) { toast.error(error.message); return; }
      setPerfiles((prev) => prev.map((p) => (p.id === editId ? { ...p, ...payload } : p)).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setEditId(null);
    } else {
      const { data, error } = await sb.from("perfil").insert({ tenant_id: tenantId, ...payload }).select("id,nombre,descripcion").single();
      if (error) { toast.error(error.message); return; }
      const nuevo = data as Perfil;
      setPerfiles((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      seleccionar(nuevo);
    }
    setForm({ nombre: "", descripcion: "" });
  }

  async function borrar(p: Perfil) {
    if (!confirm(`¿Eliminar el perfil "${p.nombre}"?`)) return;
    const { error } = await sb.from("perfil").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    setPerfiles((prev) => prev.filter((x) => x.id !== p.id));
    if (selId === p.id) setSelId(null);
    if (editId === p.id) { setEditId(null); setForm({ nombre: "", descripcion: "" }); }
  }

  // Copiar perfil (como Ágora): duplica con " (copia)" y sus mismos permisos.
  async function copiar(p: Perfil) {
    const nombre = `${p.nombre} (copia)`;
    const base = { tenant_id: tenantId, nombre, descripcion: p.descripcion };
    const insert = sinMigracion ? base : { ...base, permisos: p.permisos ?? {} };
    const cols = sinMigracion ? "id,nombre,descripcion" : "id,nombre,descripcion,permisos";
    const { data, error } = await sb.from("perfil").insert(insert).select(cols).single();
    if (error) { toast.error(error.message); return; }
    const nuevo = data as unknown as Perfil;
    setPerfiles((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    seleccionar(nuevo);
    toast.success(`Perfil copiado: "${nombre}".`);
  }

  async function guardarPermisos() {
    if (!sel || sinMigracion) return;
    setGuardando(true);
    const { error } = await sb.from("perfil").update({ permisos: permForm }).eq("id", sel.id);
    setGuardando(false);
    if (error) { toast.error(error.message); return; }
    setPerfiles((prev) => prev.map((p) => (p.id === sel.id ? { ...p, permisos: { ...permForm } } : p)));
    toast.success(`Permisos del perfil "${sel.nombre}" guardados.`);
  }

  // Catálogo filtrado por el buscador (por permiso o por grupo).
  const grupos = useMemo(() => {
    const q = norm(permBusqueda.trim());
    if (!q) return CATALOGO_PERMISOS;
    return CATALOGO_PERMISOS
      .map((g) => ({ ...g, permisos: g.permisos.filter((p) => norm(p.label).includes(q) || norm(g.grupo).includes(q)) }))
      .filter((g) => g.permisos.length > 0);
  }, [permBusqueda]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Perfiles y permisos"
        description="Permisos por aplicación (estilo Ágora). Asigna un perfil a cada empleado en Personal; sus permisos se aplican en el TPV y en el panel."
      />

      {sinMigracion && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Falta aplicar la migración <strong>0048</strong> (columna <code>perfil.permisos</code>) en la
            base de datos. Puedes crear y editar perfiles, pero sus permisos no se pueden guardar todavía.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Lista + alta/edición */}
        <Card className="self-start">
          <CardContent className="space-y-3">
            <div className="space-y-1">
              {perfiles.length === 0 && (
                <p className="py-2 text-sm text-(--text-muted)">Aún no hay perfiles. Crea el primero abajo.</p>
              )}
              {perfiles.map((p) => (
                <div
                  key={p.id}
                  className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
                    selId === p.id ? "bg-surface-muted font-medium" : "hover:bg-surface-overlay"
                  }`}
                >
                  <button type="button" onClick={() => seleccionar(p)} className="flex-1 text-left">
                    <span>{p.nombre}</span>
                    {p.descripcion && <span className="block text-xs font-normal text-(--text-muted)">{p.descripcion}</span>}
                  </button>
                  <button type="button" onClick={() => void copiar(p)} aria-label={`Copiar ${p.nombre}`} title="Copiar perfil"
                    className="grid h-7 w-7 place-items-center rounded-md text-(--text-muted) opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => abrirEditar(p)} aria-label={`Editar ${p.nombre}`} title="Editar"
                    className="grid h-7 w-7 place-items-center rounded-md text-(--text-muted) opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => void borrar(p)} aria-label={`Eliminar ${p.nombre}`} title="Eliminar"
                    className="grid h-7 w-7 place-items-center rounded-md text-(--text-muted) opacity-0 hover:bg-accent hover:text-destructive group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={guardarFicha} className="space-y-2 border-t border-border pt-3">
              <div className="space-y-1.5">
                <Label>{editId ? "Editar perfil" : "Nuevo perfil"}</Label>
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre (p. ej. Encargado)" />
              </div>
              <Textarea rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción (opcional)" />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={!form.nombre.trim()}>
                  {editId ? "Guardar cambios" : <><Plus className="h-4 w-4" /> Crear perfil</>}
                </Button>
                {editId && (
                  <Button type="button" size="sm" variant="outline" onClick={() => { setEditId(null); setForm({ nombre: "", descripcion: "" }); }}>
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Matriz de permisos del perfil seleccionado */}
        <Card className="self-start">
          <CardContent>
            {!sel ? (
              <p className="py-6 text-center text-sm text-(--text-muted)">Selecciona un perfil para editar sus permisos.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold">Permisos de {sel.nombre}</h3>
                  <p className="text-sm text-(--text-muted)">Marcado = permitido. Desmarca lo que quieras bloquear a quien tenga este perfil.</p>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input className="pl-8" placeholder="Buscar permiso…" value={permBusqueda} onChange={(e) => setPermBusqueda(e.target.value)} />
                </div>
                <div className="space-y-4">
                  {grupos.map((g) => (
                    <div key={g.grupo} className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.grupo}</p>
                      {g.permisos.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={permForm[p.id] !== false}
                            disabled={sinMigracion}
                            onChange={(e) => setPermForm((s) => ({ ...s, [p.id]: e.target.checked }))}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  ))}
                  {grupos.length === 0 && <p className="py-4 text-center text-sm text-(--text-muted)">Sin permisos para «{permBusqueda}».</p>}
                </div>
                <Button onClick={() => void guardarPermisos()} disabled={sinMigracion || guardando}>
                  {guardando ? "Guardando…" : "Guardar permisos"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
