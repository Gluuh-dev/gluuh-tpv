"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown, ChevronRight, LayoutGrid, Palette, TriangleAlert } from "lucide-react";
import { BOTONES_TPV } from "../../tpv/components/ColumnaFunciones";
import { getSetting, setSetting } from "../../lib/settings";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { ThemeToggle } from "@/components/theme-toggle";

const TERRITORIOS = [
  { v: "PENINSULA_BALEARES", t: "Península / Baleares (IVA)" },
  { v: "CANARIAS", t: "Canarias (IGIC)" },
  { v: "CEUTA_MELILLA", t: "Ceuta / Melilla (IPSI)" },
  { v: "FORAL_PV", t: "País Vasco (TicketBAI)" },
  { v: "FORAL_NAVARRA", t: "Navarra" },
];

export default function Ajustes() {
  const sb = supabaseBrowser();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [f, setF] = useState({
    empresa: "", nombre: "", nombre_comercial: "", direccion: "", cif: "", razon_social: "",
    poblacion: "", provincia: "", codigo_postal: "", contacto: "", telefono: "", email: "", web: "",
    territorio_fiscal: "PENINSULA_BALEARES", serie_factura: "F",
  });
  const [sin0069, setSin0069] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Orden de la columna de funciones del TPV
  const [ordenBtns, setOrdenBtns] = useState<{ id: string; label: string }[]>(BOTONES_TPV);
  const [ordenMsg, setOrdenMsg] = useState("");
  useEffect(() => {
    getSetting<string[]>("tpv.funciones.orden").then((o) => {
      if (!Array.isArray(o) || !o.length) return;
      const byId = Object.fromEntries(BOTONES_TPV.map((b) => [b.id, b]));
      setOrdenBtns([...o.filter((id) => byId[id]).map((id) => byId[id]!), ...BOTONES_TPV.filter((b) => !o.includes(b.id))]);
    }).catch(() => { /* orden por defecto */ });
  }, []);
  function moverBtn(i: number, dir: -1 | 1) {
    setOrdenBtns((prev) => {
      const j = i + dir; if (j < 0 || j >= prev.length) return prev;
      const arr = [...prev]; [arr[i], arr[j]] = [arr[j]!, arr[i]!]; return arr;
    });
  }
  async function guardarOrden() {
    try { await setSetting("GLOBAL", "tpv.funciones.orden", ordenBtns.map((b) => b.id)); setOrdenMsg("Guardado ✓"); }
    catch (e) { setOrdenMsg(`Error: ${e instanceof Error ? e.message : e}`); }
  }

  useEffect(() => {
    (async () => {
      const { data: t } = await sb.from("tenant").select("id,nombre").limit(1).maybeSingle();
      // Columnas de empresa/ubicación/contacto (0069); si no existen, degrada.
      const COLS_BASE = "id,nombre,direccion,cif,razon_social,territorio_fiscal,serie_factura";
      let l = (await sb.from("location").select(`${COLS_BASE},nombre_comercial,poblacion,provincia,codigo_postal,contacto,telefono,email,web`).limit(1).maybeSingle()).data as Record<string, string | null> | null;
      if (!l) {
        const r = await sb.from("location").select(COLS_BASE).limit(1).maybeSingle();
        if (r.error) setSin0069(true);
        l = r.data as Record<string, string | null> | null;
      }
      setTenantId(t?.id ?? null);
      setLocationId((l?.id as string | undefined) ?? null);
      const v = (k: string) => (l?.[k] as string | null) ?? "";
      setF({
        empresa: t?.nombre ?? "",
        nombre: v("nombre"),
        nombre_comercial: v("nombre_comercial"),
        direccion: v("direccion"),
        cif: l?.cif === "PENDIENTE" ? "" : v("cif"),
        razon_social: v("razon_social"),
        poblacion: v("poblacion"),
        provincia: v("provincia"),
        codigo_postal: v("codigo_postal"),
        contacto: v("contacto"),
        telefono: v("telefono"),
        email: v("email"),
        web: v("web"),
        territorio_fiscal: v("territorio_fiscal") || "PENINSULA_BALEARES",
        serie_factura: v("serie_factura") || "F",
      });
    })();
    /* eslint-disable-next-line */
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    if (tenantId) await sb.from("tenant").update({ nombre: f.empresa }).eq("id", tenantId);
    if (locationId) {
      const base: Record<string, unknown> = {
        nombre: f.nombre, direccion: f.direccion, cif: f.cif || "PENDIENTE",
        razon_social: f.razon_social, territorio_fiscal: f.territorio_fiscal, serie_factura: f.serie_factura,
      };
      if (!sin0069) Object.assign(base, {
        nombre_comercial: f.nombre_comercial || null, poblacion: f.poblacion || null,
        provincia: f.provincia || null, codigo_postal: f.codigo_postal || null,
        contacto: f.contacto || null, telefono: f.telefono || null,
        email: f.email || null, web: f.web || null,
      });
      await sb.from("location").update(base).eq("id", locationId);
    }
    setSaving(false);
    setMsg("Guardado ✓");
  }

  const campo = (label: string, k: keyof typeof f, extra?: { placeholder?: string; type?: string }) => (
    <div className="space-y-1.5">
      <Label htmlFor={`f-${k}`}>{label}</Label>
      <Input id={`f-${k}`} type={extra?.type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={extra?.placeholder} />
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Empresa y local"
        description="Datos administrativos, ubicación, contacto y fiscalidad del local."
      />

      {sin0069 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Falta aplicar la migración <strong>0069</strong>: los campos de nombre comercial, población, provincia, CP y contacto no se guardan todavía.</p>
        </div>
      )}

      <form onSubmit={guardar} className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Datos administrativos */}
          <Card>
            <CardHeader><CardTitle className="text-base">Datos administrativos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {campo("Nombre de la empresa", "empresa")}
              {campo("Nombre comercial", "nombre_comercial", { placeholder: "Nombre visible del local" })}
              {campo("Nombre fiscal (razón social)", "razon_social")}
              {campo("CIF / NIF", "cif", { placeholder: "B12345678" })}
            </CardContent>
          </Card>

          {/* Contacto */}
          <Card>
            <CardHeader><CardTitle className="text-base">Contacto</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {campo("Persona de contacto", "contacto")}
              {campo("Teléfono", "telefono", { type: "tel" })}
              {campo("Email", "email", { type: "email", placeholder: "info@turestaurante.com" })}
              {campo("Página web", "web", { placeholder: "https://…" })}
            </CardContent>
          </Card>

          {/* Ubicación */}
          <Card>
            <CardHeader><CardTitle className="text-base">Ubicación</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {campo("Nombre del local", "nombre")}
              {campo("Dirección", "direccion")}
              <div className="grid gap-4 sm:grid-cols-2">
                {campo("Población", "poblacion")}
                {campo("Provincia", "provincia")}
              </div>
              <div className="w-40">{campo("Código postal", "codigo_postal")}</div>
            </CardContent>
          </Card>

          {/* Fiscalidad */}
          <Card>
            <CardHeader><CardTitle className="text-base">Fiscalidad</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Territorio fiscal</Label>
                <Select value={f.territorio_fiscal} onValueChange={(v) => setF({ ...f, territorio_fiscal: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{TERRITORIOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.t}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Decide IVA / IGIC / IPSI y el régimen de facturación.</p>
              </div>
              <div className="w-40">{campo("Serie de factura", "serie_factura")}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-3">
          <Button disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        </div>
      </form>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <Link
            href="/personalizar"
            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 transition-colors hover:bg-surface-overlay"
          >
            <span className="flex items-center gap-2.5 text-sm">
              <Palette className="h-4 w-4 text-(--text-muted)" aria-hidden />
              <span>
                <span className="block font-medium">Marca y apariencia</span>
                <span className="block text-[11px] text-(--text-muted)">Logo, colores, kiosko y cartelería se configuran en Personalizar.</span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-(--text-muted)" aria-hidden />
          </Link>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">Tema (claro / oscuro) de esta pantalla</span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><LayoutGrid className="h-4 w-4" /> Orden de botones del TPV</CardTitle>
          <CardDescription>Ordena la columna de funciones de la pantalla de venta (Aparcar, Dividir, Cliente…).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm space-y-1">
            {ordenBtns.map((b, i) => (
              <div key={b.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="flex-1">{b.label}</span>
                <button type="button" onClick={() => moverBtn(i, -1)} disabled={i === 0} className="rounded border border-border p-1 hover:bg-accent disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => moverBtn(i, 1)} disabled={i === ordenBtns.length - 1} className="rounded border border-border p-1 hover:bg-accent disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button type="button" variant="outline" onClick={guardarOrden}>Guardar orden</Button>
            {ordenMsg && <span className="text-sm text-emerald-600">{ordenMsg}</span>}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
