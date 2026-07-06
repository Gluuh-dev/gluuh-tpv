"use client";

// Formas de pago (payment_method). Flags abre_cajon / cuenta_arqueo de la
// migración 0055; si aún no está aplicada, la página cae a la gestión básica
// (nombre/tipo/activo) con aviso ámbar — patrón de ordenar-productos.
// ponytail: el TPV (cobro) y el arqueo de caja consumirán estos flags.
import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Sparkles, Inbox, Calculator, TriangleAlert } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";

interface Forma { id: string; nombre: string; tipo: string; activo: boolean; abre_cajon: boolean; cuenta_arqueo: boolean }
const TIPOS = [
  { v: "EFECTIVO", t: "Efectivo" }, { v: "TARJETA", t: "Tarjeta" },
  { v: "BIZUM", t: "Bizum" }, { v: "VALE", t: "Vale" }, { v: "OTRO", t: "Otro" },
];

export default function FormasPago() {
  const sb = supabaseBrowser();
  const [tenantId, setTenantId] = useState("");
  const [list, setList] = useState<Forma[]>([]);
  const [f, setF] = useState({ nombre: "", tipo: "TARJETA" });
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState(true); // false si 0055 no está aplicada

  async function cargar() {
    const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
    setTenantId((t as { id: string } | null)?.id ?? "");
    // Con flags; si las columnas no existen aún (0055 sin aplicar) → gestión básica.
    const conFlags = await sb.from("payment_method").select("id,nombre,tipo,activo,abre_cajon,cuenta_arqueo").order("orden");
    if (conFlags.error) {
      setFlags(false);
      const { data } = await sb.from("payment_method").select("id,nombre,tipo,activo").order("orden");
      setList(((data as Omit<Forma, "abre_cajon" | "cuenta_arqueo">[]) ?? []).map((m) => ({ ...m, abre_cajon: false, cuenta_arqueo: true })));
    } else {
      setList((conFlags.data as Forma[]) ?? []);
    }
  }
  useEffect(() => { (async () => { await cargar(); setLoading(false); })(); /* eslint-disable-next-line */ }, []);

  // Solo escribe columnas que existan (evita error si 0055 no está aplicada).
  function conDefaults(base: { nombre: string; tipo: string; orden: number }) {
    return flags ? { ...base, abre_cajon: base.tipo === "EFECTIVO", cuenta_arqueo: true } : base;
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nombre.trim()) return;
    await sb.from("payment_method").insert({ tenant_id: tenantId, ...conDefaults({ nombre: f.nombre.trim(), tipo: f.tipo, orden: list.length }) });
    setF({ nombre: "", tipo: "TARJETA" }); cargar();
  }
  async function habituales() {
    await sb.from("payment_method").insert([
      { tenant_id: tenantId, ...conDefaults({ nombre: "Efectivo", tipo: "EFECTIVO", orden: 0 }) },
      { tenant_id: tenantId, ...conDefaults({ nombre: "Tarjeta", tipo: "TARJETA", orden: 1 }) },
      { tenant_id: tenantId, ...conDefaults({ nombre: "Bizum", tipo: "BIZUM", orden: 2 }) },
    ]);
    cargar();
  }
  async function toggle(m: Forma) { await sb.from("payment_method").update({ activo: !m.activo }).eq("id", m.id); cargar(); }
  async function toggleFlag(m: Forma, campo: "abre_cajon" | "cuenta_arqueo") {
    await sb.from("payment_method").update({ [campo]: !m[campo] }).eq("id", m.id); cargar();
  }
  async function del(id: string) { await sb.from("payment_method").delete().eq("id", id); cargar(); }

  if (loading) return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Formas de pago" description="Cómo cobra tu negocio. Se usan en el TPV al cobrar y en el arqueo de caja." />
      <TableSkeleton rows={5} />
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Formas de pago" description="Cómo cobra tu negocio. Se usan en el TPV al cobrar y en el arqueo de caja." />

      {!flags && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Falta aplicar la migración <strong>0055</strong> (columnas <code>abre_cajon</code> y <code>cuenta_arqueo</code>).
            Mientras tanto puedes gestionar nombre, tipo y visibilidad; los ajustes de cajón y arqueo no están disponibles.
          </p>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={add} className="flex flex-wrap items-center gap-2">
            <Input className="w-56" placeholder="Nombre (Tarjeta, Ticket Restaurant…)" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.t}</SelectItem>)}</SelectContent>
            </Select>
            <Button><Plus className="h-4 w-4" /> Añadir</Button>
          </form>
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <EmptyState title="Sin formas de pago" description="Añade las tuyas o crea las habituales (Efectivo, Tarjeta, Bizum)."
          action={<Button onClick={habituales}><Sparkles className="h-4 w-4" /> Crear habituales</Button>} />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {list.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className={m.activo ? "" : "text-muted-foreground line-through"}>{m.nombre}</span>
                  <Badge variant="secondary" className="font-normal">{m.tipo.toLowerCase()}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  {flags && (
                    <>
                      <Button variant="ghost" size="icon" aria-label={m.abre_cajon ? "No abrir cajón" : "Abrir cajón al cobrar"}
                        title={m.abre_cajon ? "Abre el cajón al cobrar" : "No abre el cajón"}
                        className={m.abre_cajon ? "text-brand" : "text-muted-foreground/50"} onClick={() => toggleFlag(m, "abre_cajon")}>
                        <Inbox className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={m.cuenta_arqueo ? "No contar en arqueo" : "Contar en arqueo"}
                        title={m.cuenta_arqueo ? "Cuenta para el arqueo de caja" : "No cuenta en el arqueo"}
                        className={m.cuenta_arqueo ? "text-brand" : "text-muted-foreground/50"} onClick={() => toggleFlag(m, "cuenta_arqueo")}>
                        <Calculator className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" aria-label={m.activo ? "Ocultar" : "Mostrar"} title={m.activo ? "Activa" : "Oculta"} className={m.activo ? "text-emerald-600" : "text-muted-foreground"} onClick={() => toggle(m)}>
                    {m.activo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Eliminar" className="text-destructive" onClick={() => del(m.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
