"use client";

import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { registrarPasskey, passkeysSoportadas } from "@/lib/passkeys";
import { PageHeader } from "@/components/ui/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { leerBranding, BRANDING_DEFAULT, subirMedia, type Branding } from "../../lib/branding";

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
  const [f, setF] = useState({ empresa: "", nombre: "", direccion: "", cif: "", razon_social: "", territorio_fiscal: "PENINSULA_BALEARES", serie_factura: "F" });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pkMsg, setPkMsg] = useState("");
  const [pkBusy, setPkBusy] = useState(false);
  const [brand, setBrand] = useState<Branding>(BRANDING_DEFAULT);
  const [brandMsg, setBrandMsg] = useState("");
  const [brandSaving, setBrandSaving] = useState(false);

  useEffect(() => setMounted(true), []);

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !tenantId) return;
    try { const url = await subirMedia(sb, tenantId, file, "branding"); setBrand((s) => ({ ...s, logo_url: url })); } catch (err) { console.error(err); }
  }
  async function guardarBranding() {
    if (!tenantId) return;
    setBrandSaving(true); setBrandMsg("");
    const { error } = await sb.from("tenant_branding").upsert({
      tenant_id: tenantId,
      nombre_comercial: brand.nombre_comercial || null,
      logo_url: brand.logo_url || null,
      color_primario: brand.color_primario,
      color_secundario: brand.color_secundario,
      kiosko_titulo: brand.kiosko_titulo || null,
      kiosko_subtitulo: brand.kiosko_subtitulo || null,
      mesa_color: brand.mesa_color,
      silla_color: brand.silla_color,
    }, { onConflict: "tenant_id" });
    setBrandSaving(false);
    setBrandMsg(error ? `Error: ${error.message}` : "Marca guardada ✓");
  }

  async function onRegistrarPasskey() {
    setPkBusy(true); setPkMsg("");
    try {
      const { error } = await registrarPasskey(sb);
      setPkMsg(error ? `Error: ${error.message}` : "Passkey registrada ✓ Ya puedes entrar con huella/Face ID.");
    } catch {
      setPkMsg("Tu dispositivo no permitió crear la passkey.");
    } finally { setPkBusy(false); }
  }

  useEffect(() => {
    (async () => {
      const { data: t } = await sb.from("tenant").select("id,nombre").limit(1).maybeSingle();
      const { data: l } = await sb.from("location").select("id,nombre,direccion,cif,razon_social,territorio_fiscal,serie_factura").limit(1).maybeSingle();
      setTenantId(t?.id ?? null);
      setLocationId(l?.id ?? null);
      setF({
        empresa: t?.nombre ?? "",
        nombre: l?.nombre ?? "",
        direccion: l?.direccion ?? "",
        cif: l?.cif === "PENDIENTE" ? "" : l?.cif ?? "",
        razon_social: l?.razon_social ?? "",
        territorio_fiscal: l?.territorio_fiscal ?? "PENINSULA_BALEARES",
        serie_factura: l?.serie_factura ?? "F",
      });
      setBrand(await leerBranding(sb));
    })();
    /* eslint-disable-next-line */
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    if (tenantId) await sb.from("tenant").update({ nombre: f.empresa }).eq("id", tenantId);
    if (locationId) await sb.from("location").update({
      nombre: f.nombre, direccion: f.direccion, cif: f.cif || "PENDIENTE",
      razon_social: f.razon_social, territorio_fiscal: f.territorio_fiscal, serie_factura: f.serie_factura,
    }).eq("id", locationId);
    setSaving(false);
    setMsg("Guardado ✓");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Ajustes"
        description="Datos fiscales del local (necesarios para la facturación VERIFACTU)."
      />
      <Card>
        <CardContent className="pt-6">
          <form className="space-y-4" onSubmit={guardar}>
            <div className="space-y-1.5"><Label>Nombre de la empresa</Label><Input value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Nombre del local</Label><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>CIF/NIF</Label><Input value={f.cif} onChange={(e) => setF({ ...f, cif: e.target.value })} placeholder="B12345678" /></div>
            </div>
            <div className="space-y-1.5"><Label>Razón social</Label><Input value={f.razon_social} onChange={(e) => setF({ ...f, razon_social: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Dirección</Label><Input value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Territorio fiscal</Label>
                <Select value={f.territorio_fiscal} onValueChange={(v) => setF({ ...f, territorio_fiscal: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TERRITORIOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Serie de factura</Label><Input value={f.serie_factura} onChange={(e) => setF({ ...f, serie_factura: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-3">
              <Button disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
              {msg && <span className="text-sm text-emerald-600">{msg}</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marca y apariencia</CardTitle>
          <CardDescription>Logo y colores de tu empresa (kiosko, pantalla de cliente, tickets) y el tema de esta pantalla.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Nombre comercial</Label><Input value={brand.nombre_comercial ?? ""} onChange={(e) => setBrand({ ...brand, nombre_comercial: e.target.value })} placeholder="Como lo ve el cliente" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Color principal</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={brand.color_primario} onChange={(e) => setBrand({ ...brand, color_primario: e.target.value })} className="h-9 w-12 rounded border border-input" />
                <Input value={brand.color_primario} onChange={(e) => setBrand({ ...brand, color_primario: e.target.value })} className="w-28" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Color secundario</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={brand.color_secundario} onChange={(e) => setBrand({ ...brand, color_secundario: e.target.value })} className="h-9 w-12 rounded border border-input" />
                <Input value={brand.color_secundario} onChange={(e) => setBrand({ ...brand, color_secundario: e.target.value })} className="w-28" />
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Color de las mesas (plano)</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={brand.mesa_color} onChange={(e) => setBrand({ ...brand, mesa_color: e.target.value })} className="h-9 w-12 rounded border border-input" />
                <Input value={brand.mesa_color} onChange={(e) => setBrand({ ...brand, mesa_color: e.target.value })} className="w-28" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Color de las sillas (plano)</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={brand.silla_color} onChange={(e) => setBrand({ ...brand, silla_color: e.target.value })} className="h-9 w-12 rounded border border-input" />
                <Input value={brand.silla_color} onChange={(e) => setBrand({ ...brand, silla_color: e.target.value })} className="w-28" />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent">Subir logo<input type="file" accept="image/*" className="hidden" onChange={onLogo} /></label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {brand.logo_url && <img src={brand.logo_url} alt="" className="h-10 w-auto rounded object-contain" />}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">Tema (claro / oscuro) de esta pantalla</span>
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" onClick={guardarBranding} disabled={brandSaving}>{brandSaving ? "Guardando…" : "Guardar marca"}</Button>
            {brandMsg && <span className="text-sm text-emerald-600">{brandMsg}</span>}
          </div>
        </CardContent>
      </Card>

      {mounted && passkeysSoportadas() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Fingerprint className="h-4 w-4" /> Seguridad · acceso rápido</CardTitle>
            <CardDescription>Registra una passkey para entrar con huella, Face ID o Windows Hello en este dispositivo, sin escribir la contraseña.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={onRegistrarPasskey} disabled={pkBusy}>
                <Fingerprint className="h-4 w-4" /> {pkBusy ? "Registrando…" : "Registrar passkey"}
              </Button>
              {pkMsg && <span className="text-sm text-muted-foreground">{pkMsg}</span>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
