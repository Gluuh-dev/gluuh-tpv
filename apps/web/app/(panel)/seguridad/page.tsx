"use client";

// Seguridad del TPV y del panel (sesión S2 / guía 14). Centraliza:
// - Bloqueo del TPV (al cerrar cuenta / por inactividad) — setting `tpv.bloqueo`.
// - Zona técnica (clave del instalador) — ClaveTecnicaCard.
// - Acceso rápido con passkey (huella / Face ID / Windows Hello).
// - (Pendiente: quién puede entrar en configuración, por perfil — guía 14.)
import { useEffect, useState } from "react";
import { Fingerprint, Lock, ShieldCheck } from "lucide-react";
import { getSetting, setSetting } from "../../lib/settings";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { ClaveTecnicaCard } from "@/components/zona-tecnica";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { registrarPasskey, passkeysSoportadas } from "@/lib/passkeys";

interface Bloqueo { alCobrar: boolean; inactividad: boolean; segundos: number }

export default function Seguridad() {
  const sb = supabaseBrowser();
  const [mounted, setMounted] = useState(false);
  // Bloqueo del TPV (combinable): velo al cerrar cuenta y/o por inactividad.
  const [bloqueo, setBloqueo] = useState<Bloqueo>({ alCobrar: false, inactividad: false, segundos: 120 });
  const [bloqueoMsg, setBloqueoMsg] = useState("");
  // Passkeys
  const [pkMsg, setPkMsg] = useState("");
  const [pkBusy, setPkBusy] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    getSetting<{ modo?: string; alCobrar?: boolean; inactividad?: boolean; segundos?: number }>("tpv.bloqueo")
      .then((c) => {
        if (!c) return;
        if (c.alCobrar !== undefined || c.inactividad !== undefined) {
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

  async function onRegistrarPasskey() {
    setPkBusy(true); setPkMsg("");
    try {
      const { error } = await registrarPasskey(sb);
      setPkMsg(error ? `Error: ${error.message}` : "Passkey registrada ✓ Ya puedes entrar con huella/Face ID.");
    } catch {
      setPkMsg("Tu dispositivo no permitió crear la passkey.");
    } finally { setPkBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Seguridad"
        description="Bloqueo del TPV, zona técnica del instalador y acceso rápido. Lo crítico se configura aquí."
      />

      {/* Bloqueo del TPV */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4" /> Bloqueo del TPV</CardTitle>
          <CardDescription>
            Cuándo se pone el velo de bloqueo (se re-identifica con PIN o pulsera; la cuenta en curso se conserva).
            El botón «Bloquear» del TPV está siempre disponible.
          </CardDescription>
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

      {/* Zona técnica (clave del instalador) */}
      <ClaveTecnicaCard />

      {/* Acceso rápido (passkeys) */}
      {mounted && passkeysSoportadas() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Fingerprint className="h-4 w-4" /> Acceso rápido</CardTitle>
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

      {/* Pendiente (guía 14): quién puede entrar en configuración, por perfil */}
      <Card className="border-dashed">
        <CardContent className="flex items-start gap-2 pt-6 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            <strong className="text-foreground">Próximamente:</strong> quién puede entrar en Configuración y en cada zona,
            política de PIN y registro de accesos — se cablea con los <strong>perfiles</strong> de operario
            (ver el plan de acceso en <code>docs/implementacion/14</code>).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
