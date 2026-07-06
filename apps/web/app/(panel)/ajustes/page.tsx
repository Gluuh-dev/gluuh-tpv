"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Fingerprint, Lock, ChevronUp, ChevronDown, ChevronRight, LayoutGrid, Palette } from "lucide-react";
import { BOTONES_TPV } from "../../tpv/components/ColumnaFunciones";
import { getSetting, setSetting } from "../../lib/settings";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { registrarPasskey, passkeysSoportadas } from "@/lib/passkeys";
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
  const [f, setF] = useState({ empresa: "", nombre: "", direccion: "", cif: "", razon_social: "", territorio_fiscal: "PENINSULA_BALEARES", serie_factura: "F" });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pkMsg, setPkMsg] = useState("");
  const [pkBusy, setPkBusy] = useState(false);
  // Bloqueo combinable: al cerrar cuenta Y/O por inactividad (el botón "Bloquear"
  // manual del TPV está siempre disponible, independiente de esto).
  const [bloqueo, setBloqueo] = useState<{ alCobrar: boolean; inactividad: boolean; segundos: number }>({ alCobrar: false, inactividad: false, segundos: 120 });
  const [bloqueoMsg, setBloqueoMsg] = useState("");

  useEffect(() => {
    getSetting<{ modo?: string; alCobrar?: boolean; inactividad?: boolean; segundos?: number }>("tpv.bloqueo")
      .then((c) => {
        if (!c) return;
        if (c.alCobrar !== undefined || c.inactividad !== undefined) {
          // formato nuevo (flags)
          setBloqueo({ alCobrar: !!c.alCobrar, inactividad: !!c.inactividad, segundos: c.segundos ?? 120 });
        } else {
          // formato antiguo { modo } → flags
          setBloqueo({ alCobrar: c.modo === "al_cobrar", inactividad: c.modo === "inactividad", segundos: c.segundos ?? 120 });
        }
      })
      .catch(() => { /* sin config */ });
  }, []);

  async function guardarBloqueo() {
    try { await setSetting("GLOBAL", "tpv.bloqueo", bloqueo); setBloqueoMsg("Guardado ✓"); }
    catch (e) { setBloqueoMsg(`Error: ${e instanceof Error ? e.message : e}`); }
  }

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
          <CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4" /> Bloqueo del TPV</CardTitle>
          <CardDescription>Cuándo se pone el velo de bloqueo del TPV (se re-identifica con PIN o pulsera; la cuenta en curso se conserva). El botón «Bloquear» del TPV está siempre disponible.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border border-input px-3 py-2">
            <div>
              <div className="text-sm font-medium">Al terminar cada cuenta</div>
              <div className="text-xs text-muted-foreground">Tras cobrar, pide el camarero para la siguiente venta.</div>
            </div>
            <Switch checked={bloqueo.alCobrar} onCheckedChange={(v) => setBloqueo((b) => ({ ...b, alCobrar: v }))} aria-label="Bloquear al terminar cada cuenta" />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-input px-3 py-2">
            <div>
              <div className="text-sm font-medium">Por inactividad</div>
              <div className="text-xs text-muted-foreground">Pone el velo tras un rato sin tocar la pantalla.</div>
            </div>
            <Switch checked={bloqueo.inactividad} onCheckedChange={(v) => setBloqueo((b) => ({ ...b, inactividad: v }))} aria-label="Bloquear por inactividad" />
          </div>
          {bloqueo.inactividad && (
            <div className="flex items-center gap-2 pl-3 text-sm">
              <Label>Bloquear tras</Label>
              <Input type="number" min={15} className="w-24" value={bloqueo.segundos} onChange={(e) => setBloqueo((b) => ({ ...b, segundos: Number(e.target.value) || 120 }))} />
              <span className="text-muted-foreground">segundos sin actividad</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={guardarBloqueo}>Guardar</Button>
            {bloqueoMsg && <span className="text-sm text-muted-foreground">{bloqueoMsg}</span>}
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
