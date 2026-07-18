"use client";

// CONFIGURACIÓN DE MENÚS dentro del TPV (mockup gluuh-pantalla-configuracion-menu):
// un menú del día = precio cerrado + grupos (Primero, Segundo, Postre…) y en cada
// grupo las opciones (productos elegibles). Tablas: menu / menu_group / menu_choice
// (choice = PK compuesta group_id+product_id: marcar/desmarcar productos).
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Check, Trash2 } from "lucide-react";
import { supabaseBrowser } from "../../../lib/supabaseBrowser";
import { toast } from "@/app/lib/toast";
import { eur } from "@/app/lib/money";
import { CLASES_FISCALES } from "@/lib/fiscal-clases";
import { NavbarTPV, NavChip } from "../../components/NavbarTPV";

interface Menu { id: string; nombre: string; precio: number; clase_fiscal: string | null; activo: boolean; orden: number | null; category_id: string | null }
interface Grupo { id: string; menu_id: string; nombre: string; orden: number | null }
interface Choice { group_id: string; product_id: string }
interface ProdMin { id: string; nombre: string; category_id: string | null }
interface Cat { id: string; nombre: string }

export default function MenusTPV() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [prods, setProds] = useState<ProdMin[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [grupoSel, setGrupoSel] = useState<string | null>(null);
  const [nuevoGrupo, setNuevoGrupo] = useState("");
  const [catFiltro, setCatFiltro] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    const [m, g, ch, p, c] = await Promise.all([
      sb.from("menu").select("id,nombre,precio,clase_fiscal,activo,orden,category_id").order("orden"),
      sb.from("menu_group").select("id,menu_id,nombre,orden").order("orden"),
      sb.from("menu_choice").select("group_id,product_id"),
      sb.from("product").select("id,nombre,category_id").order("nombre"),
      sb.from("category").select("id,nombre").order("orden"),
    ]);
    setMenus((m.data as Menu[]) ?? []);
    setGrupos((g.data as Grupo[]) ?? []);
    setChoices((ch.data as Choice[]) ?? []);
    setProds((p.data as ProdMin[]) ?? []);
    setCats((c.data as Cat[]) ?? []);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void cargar(); }, []);

  const sel = menus.find((m) => m.id === selId) ?? null;
  const gruposDelMenu = grupos.filter((g) => g.menu_id === selId);
  const grupoActivo = gruposDelMenu.find((g) => g.id === grupoSel) ?? gruposDelMenu[0] ?? null;
  const elegidos = useMemo(() => new Set(choices.filter((c) => c.group_id === grupoActivo?.id).map((c) => c.product_id)), [choices, grupoActivo]);
  const nElegidos = (gid: string) => choices.filter((c) => c.group_id === gid).length;

  const prodsFiltrados = useMemo(
    () => prods.filter((p) => !catFiltro || p.category_id === catFiltro),
    [prods, catFiltro],
  );

  async function crearMenu() {
    const { data, error } = await sb.from("menu")
      .insert({ nombre: "Nuevo menú", precio: 0, clase_fiscal: "REDUCIDO", activo: false, orden: menus.length + 1 })
      .select("id").single();
    if (error) { toast.error(error.message); return; }
    await cargar();
    setSelId((data as { id: string }).id);
  }

  async function guardarMenu(cambios: Partial<Menu>) {
    if (!sel) return;
    setGuardando(true);
    const { error } = await sb.from("menu").update(cambios).eq("id", sel.id);
    setGuardando(false);
    if (error) { toast.error(error.message); return; }
    setMenus((prev) => prev.map((m) => (m.id === sel.id ? { ...m, ...cambios } : m)));
  }

  async function crearGrupo() {
    if (!sel || !nuevoGrupo.trim()) return;
    const { error } = await sb.from("menu_group").insert({ menu_id: sel.id, nombre: nuevoGrupo.trim(), orden: gruposDelMenu.length + 1 });
    if (error) { toast.error(error.message); return; }
    setNuevoGrupo("");
    await cargar();
  }

  async function borrarGrupo(g: Grupo) {
    // Las opciones del grupo caen con él (delete explícito: choice no tiene cascade seguro).
    await sb.from("menu_choice").delete().eq("group_id", g.id);
    const { error } = await sb.from("menu_group").delete().eq("id", g.id);
    if (error) { toast.error(error.message); return; }
    if (grupoSel === g.id) setGrupoSel(null);
    await cargar();
  }

  // Marcar/desmarcar un producto como opción del grupo activo (optimista).
  async function toggleOpcion(pid: string) {
    if (!grupoActivo) return;
    const estaba = elegidos.has(pid);
    setChoices((prev) => estaba
      ? prev.filter((c) => !(c.group_id === grupoActivo.id && c.product_id === pid))
      : [...prev, { group_id: grupoActivo.id, product_id: pid }]);
    const { error } = estaba
      ? await sb.from("menu_choice").delete().eq("group_id", grupoActivo.id).eq("product_id", pid)
      : await sb.from("menu_choice").insert({ group_id: grupoActivo.id, product_id: pid });
    if (error) { toast.error(error.message); await cargar(); }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <NavbarTPV operario="Configuración" subtitulo="Menús">
        <h1 className="flex-none text-lg font-bold tracking-tight">Menús</h1>
        <NavChip label="Menús">{menus.length}</NavChip>
        <span className="flex-1" />
        <button type="button" onClick={() => { void crearMenu(); }}
          className="flex flex-none items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/25">
          <Plus size={16} /> Nuevo menú
        </button>
        <button type="button" onClick={() => router.push("/tpv/config")}
          className="flex flex-none items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/25">
          <ArrowLeft size={16} /> Configuración
        </button>
      </NavbarTPV>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 p-2.5 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Menús */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <h2 className="flex-none border-b border-border bg-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Menús</h2>
          <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {menus.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Sin menús. Crea el primero.</div>}
            {menus.map((m) => (
              <button key={m.id} type="button" onClick={() => { setSelId(m.id); setGrupoSel(null); }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent ${selId === m.id ? "bg-brand/5" : ""} ${m.activo ? "" : "opacity-55"}`}>
                <span className="min-w-0">
                  <span className="block truncate font-bold">{m.nombre}</span>
                  <span className={`text-[10px] font-black uppercase ${m.activo ? "text-success" : "text-muted-foreground"}`}>{m.activo ? "Activo" : "Inactivo"}</span>
                </span>
                <b className="tabular-nums">{eur(Number(m.precio))}</b>
              </button>
            ))}
          </div>
        </section>

        {/* Composición del menú */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <h2 className="flex-none border-b border-border bg-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {sel ? `Componer «${sel.nombre}»` : "Componer"}
          </h2>
          {!sel ? (
            <div className="grid flex-1 place-items-center p-8 text-center text-sm text-muted-foreground">Elige un menú de la izquierda.</div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3">
              {/* Datos del menú */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px_1fr_auto]">
                <input value={sel.nombre} onChange={(e) => setMenus((prev) => prev.map((m) => (m.id === sel.id ? { ...m, nombre: e.target.value } : m)))}
                  onBlur={(e) => { void guardarMenu({ nombre: e.target.value.trim() || "Menú" }); }}
                  className="min-h-12 rounded-md border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-brand" />
                <input inputMode="decimal" value={String(sel.precio)}
                  onChange={(e) => setMenus((prev) => prev.map((m) => (m.id === sel.id ? { ...m, precio: Number(e.target.value.replace(",", ".")) || 0 } : m)))}
                  onBlur={() => { void guardarMenu({ precio: Number(sel.precio) }); }}
                  className="min-h-12 rounded-md border border-border bg-background px-3 text-right text-sm font-bold tabular-nums outline-none focus:border-brand" />
                <select value={sel.clase_fiscal ?? "REDUCIDO"} onChange={(e) => { void guardarMenu({ clase_fiscal: e.target.value }); }}
                  className="min-h-12 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-brand">
                  {CLASES_FISCALES.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
                </select>
                <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
                  <input type="checkbox" checked={sel.activo} onChange={(e) => { void guardarMenu({ activo: e.target.checked }); }} className="h-4 w-4 accent-(--brand)" />
                  <span className="font-semibold">Activo</span>
                </label>
              </div>

              {/* Grupos (pasos del menú) */}
              <div className="flex flex-wrap items-center gap-1.5">
                {gruposDelMenu.map((g) => (
                  <span key={g.id} className={`flex items-center overflow-hidden rounded-md border ${grupoActivo?.id === g.id ? "border-brand bg-brand text-white" : "border-border bg-background"}`}>
                    <button type="button" onClick={() => setGrupoSel(g.id)} className="min-h-11 px-3 text-sm font-bold">
                      {g.nombre} <span className={`ml-1 rounded-full px-1.5 text-[10px] font-black ${grupoActivo?.id === g.id ? "bg-white/25" : "bg-surface"}`}>{nElegidos(g.id)}</span>
                    </button>
                    <button type="button" onClick={() => { void borrarGrupo(g); }} aria-label={`Borrar grupo ${g.nombre}`}
                      className={`grid min-h-11 w-8 place-items-center ${grupoActivo?.id === g.id ? "hover:bg-white/20" : "text-muted-foreground hover:bg-danger/10 hover:text-danger"}`}>
                      <Trash2 size={13} />
                    </button>
                  </span>
                ))}
                <input value={nuevoGrupo} onChange={(e) => setNuevoGrupo(e.target.value)} placeholder="Nuevo grupo (Primero, Postre…)"
                  onKeyDown={(e) => { if (e.key === "Enter") void crearGrupo(); }}
                  className="min-h-11 w-52 rounded-md border border-dashed border-border bg-background px-3 text-sm outline-none focus:border-brand" />
                <button type="button" onClick={() => { void crearGrupo(); }} disabled={!nuevoGrupo.trim()}
                  className="grid min-h-11 w-11 place-items-center rounded-md border border-brand bg-brand/10 text-brand disabled:opacity-40"><Plus size={16} /></button>
              </div>

              {/* Opciones del grupo activo */}
              {grupoActivo ? (
                <>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Opciones de «{grupoActivo.nombre}» — toca para incluir/quitar</p>
                    <span className="flex-1" />
                    <select value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)} className="min-h-10 rounded-md border border-border bg-background px-2 text-xs outline-none">
                      <option value="">Todas las categorías</option>
                      {cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                    {prodsFiltrados.map((p) => {
                      const on = elegidos.has(p.id);
                      return (
                        <button key={p.id} type="button" onClick={() => { void toggleOpcion(p.id); }}
                          className={`flex min-h-12 items-center gap-1.5 rounded-md border px-2.5 text-left text-xs font-semibold transition-all active:scale-[.98] ${on ? "border-brand bg-brand/10 text-brand" : "border-border bg-background hover:bg-accent"}`}>
                          {on && <Check size={13} className="flex-none" />}
                          <span className="truncate">{p.nombre}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Crea un grupo (Primero, Segundo, Postre…) para elegir sus opciones.</p>
              )}
              {guardando && <p className="text-right text-xs text-muted-foreground">Guardando…</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
