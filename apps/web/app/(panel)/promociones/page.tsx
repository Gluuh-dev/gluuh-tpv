"use client";

// Promociones con reglas reales (migración 0049): tipo % / €, valor, ámbito
// (toda la carta / categoría / producto), vigencia, franja horaria y días.
// Si la 0049 no está aplicada, la lista cae a solo lectura con aviso ámbar
// (patrón de (panel)/ordenar-productos).
// ponytail: el TPV aún no aplica estas promociones al vender — aquí solo se configuran.

import * as React from "react";
import { toast } from "@/app/lib/toast";
import { Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";

interface Promo {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: "PCT" | "EUR";
  valor: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  dias_semana: number[] | null;
  category_id: string | null;
  product_id: string | null;
  activa: boolean | null;
}
interface Opcion { id: string; nombre: string }

interface Form {
  nombre: string; descripcion: string; tipo: "PCT" | "EUR"; valor: string;
  ambito: string; // "todo" | `cat:${id}` | `prod:${id}`
  fecha_inicio: string; fecha_fin: string; hora_inicio: string; hora_fin: string;
  dias: number[]; activa: boolean;
}
const FORM_VACIO: Form = {
  nombre: "", descripcion: "", tipo: "PCT", valor: "", ambito: "todo",
  fecha_inicio: "", fecha_fin: "", hora_inicio: "", hora_fin: "", dias: [], activa: true,
};

const DIAS = ["L", "M", "X", "J", "V", "S", "D"] as const;
const COLUMNAS_0049 =
  "id,nombre,descripcion,tipo,valor,fecha_inicio,fecha_fin,hora_inicio,hora_fin,dias_semana,category_id,product_id,activa";

const num = (n: number) => Number(n).toLocaleString("es-ES", { maximumFractionDigits: 2 });
const hhmm = (h: string) => h.slice(0, 5);
const ddmm = (f: string) => {
  const [, m, d] = f.split("-");
  return d && m ? `${d}/${m}` : f;
};

/** "L-V" si son consecutivos, "L X V" si no; null = todos los días (se omite). */
function fmtDias(ds: number[] | null): string | null {
  if (!ds || ds.length === 0 || ds.length === 7) return null;
  const orden = [...ds].sort((a, b) => a - b);
  const letra = (d: number) => DIAS[d - 1] ?? "?";
  const seguidos = orden.every((d, i) => i === 0 || d === orden[i - 1]! + 1);
  return seguidos && orden.length > 2
    ? `${letra(orden[0]!)}-${letra(orden[orden.length - 1]!)}`
    : orden.map(letra).join(" ");
}

/** Resumen legible: "−10 % en Bebidas · L-V · 16:00-19:00 · hasta 31/08". */
function resumen(p: Promo, cats: Opcion[], prods: Opcion[]): string {
  const ambito = p.product_id
    ? prods.find((x) => x.id === p.product_id)?.nombre ?? "un producto"
    : p.category_id
      ? cats.find((x) => x.id === p.category_id)?.nombre ?? "una categoría"
      : "toda la carta";
  const partes = [`−${num(p.valor)} ${p.tipo === "EUR" ? "€" : "%"} en ${ambito}`];
  const dias = fmtDias(p.dias_semana);
  if (dias) partes.push(dias);
  if (p.hora_inicio && p.hora_fin) partes.push(`${hhmm(p.hora_inicio)}-${hhmm(p.hora_fin)}`);
  else if (p.hora_inicio) partes.push(`desde las ${hhmm(p.hora_inicio)}`);
  else if (p.hora_fin) partes.push(`hasta las ${hhmm(p.hora_fin)}`);
  if (p.fecha_inicio && p.fecha_fin) partes.push(`${ddmm(p.fecha_inicio)}-${ddmm(p.fecha_fin)}`);
  else if (p.fecha_inicio) partes.push(`desde ${ddmm(p.fecha_inicio)}`);
  else if (p.fecha_fin) partes.push(`hasta ${ddmm(p.fecha_fin)}`);
  return partes.join(" · ");
}

export default function Promociones() {
  const sb = supabaseBrowser();
  const [promos, setPromos] = React.useState<Promo[]>([]);
  const [cats, setCats] = React.useState<Opcion[]>([]);
  const [prods, setProds] = React.useState<Opcion[]>([]);
  const [tenantId, setTenantId] = React.useState("");
  const [sinMigracion, setSinMigracion] = React.useState(false);
  const [cargado, setCargado] = React.useState(false);
  const [abierto, setAbierto] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [f, setF] = React.useState<Form>(FORM_VACIO);

  const cargar = React.useCallback(async () => {
    const full = await sb.from("promocion").select(COLUMNAS_0049).order("created_at", { ascending: false });
    if (full.error) {
      // Columnas de la 0049 ausentes → solo lectura con lo que hay (0020).
      const { data } = await sb
        .from("promocion")
        .select("id,nombre,descripcion,activa")
        .order("created_at", { ascending: false });
      const basicas = (data as Pick<Promo, "id" | "nombre" | "descripcion" | "activa">[]) ?? [];
      setPromos(basicas.map((p) => ({
        ...p, tipo: "PCT" as const, valor: 0, fecha_inicio: null, fecha_fin: null,
        hora_inicio: null, hora_fin: null, dias_semana: null, category_id: null, product_id: null,
      })));
      setSinMigracion(true);
    } else {
      setPromos((full.data as unknown as Promo[]) ?? []);
    }
  }, [sb]);

  React.useEffect(() => {
    void (async () => {
      const [t, c, p] = await Promise.all([
        sb.from("tenant").select("id").limit(1).maybeSingle(),
        sb.from("category").select("id,nombre").order("nombre"),
        sb.from("product").select("id,nombre").order("nombre"),
      ]);
      setTenantId((t.data as { id: string } | null)?.id ?? "");
      setCats((c.data as Opcion[]) ?? []);
      setProds((p.data as Opcion[]) ?? []);
      await cargar();
      setCargado(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirNuevo() { setEditId(null); setF(FORM_VACIO); setAbierto(true); }
  function abrirEditar(p: Promo) {
    setEditId(p.id);
    setF({
      nombre: p.nombre,
      descripcion: p.descripcion ?? "",
      tipo: p.tipo,
      valor: String(p.valor),
      ambito: p.product_id ? `prod:${p.product_id}` : p.category_id ? `cat:${p.category_id}` : "todo",
      fecha_inicio: p.fecha_inicio ?? "",
      fecha_fin: p.fecha_fin ?? "",
      hora_inicio: p.hora_inicio ? hhmm(p.hora_inicio) : "",
      hora_fin: p.hora_fin ? hhmm(p.hora_fin) : "",
      dias: p.dias_semana ?? [],
      activa: p.activa ?? true,
    });
    setAbierto(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const valor = Number(f.valor.replace(",", "."));
    if (!f.nombre.trim()) { toast.error("Falta el nombre"); return; }
    if (!Number.isFinite(valor) || valor <= 0) { toast.error("El valor debe ser mayor que 0"); return; }
    const payload = {
      nombre: f.nombre.trim(),
      descripcion: f.descripcion.trim() || null,
      tipo: f.tipo,
      valor,
      fecha_inicio: f.fecha_inicio || null,
      fecha_fin: f.fecha_fin || null,
      hora_inicio: f.hora_inicio || null,
      hora_fin: f.hora_fin || null,
      // [] o los 7 días = null = todos los días
      dias_semana: f.dias.length === 0 || f.dias.length === 7 ? null : [...f.dias].sort((a, b) => a - b),
      category_id: f.ambito.startsWith("cat:") ? f.ambito.slice(4) : null,
      product_id: f.ambito.startsWith("prod:") ? f.ambito.slice(5) : null,
      activa: f.activa,
    };
    const { error } = editId
      ? await sb.from("promocion").update(payload).eq("id", editId)
      : await sb.from("promocion").insert({ tenant_id: tenantId, ...payload });
    if (error) { toast.error(error.message); return; }
    setAbierto(false);
    toast.success(editId ? "Promoción guardada" : "Promoción creada");
    void cargar();
  }

  async function borrar(id: string) {
    if (!confirm("¿Eliminar la promoción?")) return;
    const { error } = await sb.from("promocion").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminada");
    void cargar();
  }

  if (!cargado) return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Promociones" description="Descuentos por porcentaje o importe, con ámbito, vigencia, franja horaria y días de la semana. El TPV todavía no las aplica al vender." />
      <TableSkeleton rows={5} />
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Promociones"
        description="Descuentos por porcentaje o importe, con ámbito, vigencia, franja horaria y días de la semana. El TPV todavía no las aplica al vender."
        actions={!sinMigracion && (
          <Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Nueva promoción</Button>
        )}
      />

      {sinMigracion && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Falta aplicar la migración <strong>0049</strong> (reglas de promoción: tipo, valor, vigencia,
            ámbito) en la base de datos. Mientras tanto, la lista es de solo lectura.
          </p>
        </div>
      )}

      {abierto && !sinMigracion && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={guardar} className="space-y-4">
              <p className="text-sm font-semibold">{editId ? "Editar promoción" : "Nueva promoción"}</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="promo-nombre">Nombre *</Label>
                  <Input
                    id="promo-nombre"
                    value={f.nombre}
                    onChange={(e) => setF((s) => ({ ...s, nombre: e.target.value }))}
                    placeholder="Happy hour"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="promo-valor">Descuento *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="promo-valor"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={f.valor}
                      onChange={(e) => setF((s) => ({ ...s, valor: e.target.value }))}
                      placeholder="10"
                      className="w-28"
                      required
                    />
                    <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Tipo de descuento">
                      {(["PCT", "EUR"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={f.tipo === t}
                          onClick={() => setF((s) => ({ ...s, tipo: t }))}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                            f.tipo === t
                              ? "bg-primary text-primary-foreground"
                              : "bg-input/30 text-muted-foreground hover:bg-input/50 hover:text-foreground"
                          }`}
                        >
                          {t === "PCT" ? "%" : "€"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Ámbito</Label>
                  <Select value={f.ambito} onValueChange={(v) => setF((s) => ({ ...s, ambito: v }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="todo">Toda la carta</SelectItem>
                      {cats.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Categorías</SelectLabel>
                          {cats.map((c) => <SelectItem key={c.id} value={`cat:${c.id}`}>{c.nombre}</SelectItem>)}
                        </SelectGroup>
                      )}
                      {prods.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Productos</SelectLabel>
                          {prods.map((p) => <SelectItem key={p.id} value={`prod:${p.id}`}>{p.nombre}</SelectItem>)}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="promo-desde">Desde</Label>
                  <Input
                    id="promo-desde"
                    type="date"
                    value={f.fecha_inicio}
                    onChange={(e) => setF((s) => ({ ...s, fecha_inicio: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="promo-hasta">Hasta</Label>
                  <Input
                    id="promo-hasta"
                    type="date"
                    value={f.fecha_fin}
                    onChange={(e) => setF((s) => ({ ...s, fecha_fin: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="promo-hora-inicio">Franja: inicio</Label>
                  <Input
                    id="promo-hora-inicio"
                    type="time"
                    value={f.hora_inicio}
                    onChange={(e) => setF((s) => ({ ...s, hora_inicio: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="promo-hora-fin">Franja: fin</Label>
                  <Input
                    id="promo-hora-fin"
                    type="time"
                    value={f.hora_fin}
                    onChange={(e) => setF((s) => ({ ...s, hora_fin: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Días de la semana</Label>
                  <div className="flex gap-1.5">
                    {DIAS.map((d, i) => {
                      const n = i + 1;
                      const on = f.dias.includes(n);
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setF((s) => ({
                            ...s,
                            dias: on ? s.dias.filter((x) => x !== n) : [...s.dias, n],
                          }))}
                          className={`h-8 w-8 rounded-md text-xs font-medium transition-colors ${
                            on
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-input/30 text-muted-foreground hover:bg-input/50 hover:text-foreground"
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">Sin días marcados = todos los días.</p>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="promo-descripcion">Descripción</Label>
                  <Textarea
                    id="promo-descripcion"
                    rows={2}
                    value={f.descripcion}
                    onChange={(e) => setF((s) => ({ ...s, descripcion: e.target.value }))}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={f.activa}
                    onChange={(e) => setF((s) => ({ ...s, activa: e.target.checked }))}
                  />
                  Promoción activa
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
                <Button type="submit">{editId ? "Guardar" : "Crear"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* `cargado &&`: la bandera ya existía y no se estaba usando aquí. Sin ella, la página
          decía «Sin promociones» mientras las cargaba. */}
      {cargado && promos.length === 0 ? (
        <EmptyState
          title="Sin promociones"
          description={sinMigracion
            ? "Aplica la migración 0049 para poder crear promociones."
            : "Crea tu primera promoción con el botón de arriba."}
          action={!sinMigracion && (
            <Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Nueva promoción</Button>
          )}
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {promos.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{p.nombre}</span>
                      {(p.activa ?? true) ? (
                        <Badge className="bg-emerald-500/15 text-emerald-500">Activa</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Inactiva</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {sinMigracion ? (p.descripcion ?? "—") : resumen(p, cats, prods)}
                    </p>
                  </div>
                  {!sinMigracion && (
                    <span className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => abrirEditar(p)} aria-label={`Editar ${p.nombre}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => void borrar(p.id)} aria-label={`Eliminar ${p.nombre}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
