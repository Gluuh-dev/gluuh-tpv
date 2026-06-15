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

  useEffect(() => setMounted(true), []);

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
      <div>
        <h1 className="text-2xl font-semibold">Ajustes</h1>
        <p className="text-muted-foreground">Datos fiscales del local (necesarios para la facturación VERIFACTU).</p>
      </div>
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
