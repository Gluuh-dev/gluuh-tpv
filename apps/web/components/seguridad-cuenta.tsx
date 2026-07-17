"use client";

// Seguridad de la CUENTA (F2 entrega 2.3, migraciones 0111/0113):
//  - Sesiones abiertas de tu cuenta (inventario + revocación individual).
//  - Verificación en dos pasos TOTP (opcional para clientes; compatible offline).
// La lista sale de `sesion_registro` (RLS: solo tu cuenta); revocar usa la RPC
// `revocar_sesion`. El MFA es el nativo de Supabase Auth (authenticator app).
import { useEffect, useState } from "react";
import { MonitorSmartphone, ShieldCheck, Trash2 } from "lucide-react";
import { supabaseBrowser } from "../app/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Sesion { session_id: string; creada_at: string; ultima_vista: string; revocada_at: string | null; user_agent: string | null }

/** session_id de la sesión actual (claim del JWT; solo para marcarla en la UI). */
function sesionActualId(token: string | undefined): string | null {
  try {
    if (!token) return null;
    return (JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { session_id?: string }).session_id ?? null;
  } catch { return null; }
}

export function SesionesCuentaCard() {
  const [sesiones, setSesiones] = useState<Sesion[] | null>(null);
  const [actual, setActual] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function cargar() {
    const sb = supabaseBrowser();
    const { data: { session } } = await sb.auth.getSession();
    setActual(sesionActualId(session?.access_token));
    const { data, error } = await sb
      .from("sesion_registro")
      .select("session_id, creada_at, ultima_vista, revocada_at, user_agent")
      .is("revocada_at", null)
      .order("ultima_vista", { ascending: false });
    if (error) { setMsg("No se pudieron cargar las sesiones."); return; }
    setSesiones((data ?? []) as Sesion[]);
  }
  useEffect(() => { cargar(); }, []);

  async function revocar(id: string) {
    setMsg("");
    const { error } = await supabaseBrowser().rpc("revocar_sesion", { p_session: id });
    if (error) { setMsg("No se pudo revocar esa sesión."); return; }
    await cargar();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><MonitorSmartphone className="h-4 w-4" /> Sesiones de tu cuenta</CardTitle>
        <CardDescription>Dónde está abierta tu cuenta. Si ves algo que no reconoces, revócalo y cambia la contraseña.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!sesiones && <div className="text-sm text-muted-foreground">Cargando…</div>}
        {sesiones?.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Sin sesiones registradas todavía (se apuntan al entrar a partir de ahora).
          </div>
        )}
        {sesiones?.map((s) => (
          <div key={s.session_id} className="flex items-center justify-between gap-3 rounded-md border border-input px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {s.session_id === actual ? "Esta sesión" : (s.user_agent ?? "Sesión")}
              </div>
              <div className="text-xs text-muted-foreground">
                Última actividad: {new Date(s.ultima_vista).toLocaleString("es-ES")}
              </div>
            </div>
            {s.session_id !== actual && (
              <Button type="button" variant="outline" size="sm" onClick={() => revocar(s.session_id)} aria-label="Revocar sesión">
                <Trash2 className="h-4 w-4" /> Revocar
              </Button>
            )}
          </div>
        ))}
        {msg && <p className="text-sm text-destructive">{msg}</p>}
      </CardContent>
    </Card>
  );
}

export function MfaTotpCard() {
  const [factores, setFactores] = useState<{ id: string; friendly_name?: string | null; status: string }[] | null>(null);
  const [alta, setAlta] = useState<{ factorId: string; qr: string; secreto: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function cargar() {
    const { data, error } = await supabaseBrowser().auth.mfa.listFactors();
    if (error) { setMsg("No se pudo consultar el estado del segundo factor."); return; }
    setFactores(data.totp ?? []);
  }
  useEffect(() => { cargar(); }, []);

  async function empezarAlta() {
    setBusy(true); setMsg("");
    const { data, error } = await supabaseBrowser().auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
    setBusy(false);
    if (error || !data) { setMsg(error?.message ?? "No se pudo iniciar el alta."); return; }
    setAlta({ factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret });
  }

  async function confirmarAlta() {
    if (!alta || codigo.length < 6) return;
    setBusy(true); setMsg("");
    const sb = supabaseBrowser();
    const { data: reto, error: e1 } = await sb.auth.mfa.challenge({ factorId: alta.factorId });
    if (e1 || !reto) { setBusy(false); setMsg(e1?.message ?? "No se pudo verificar."); return; }
    const { error: e2 } = await sb.auth.mfa.verify({ factorId: alta.factorId, challengeId: reto.id, code: codigo.trim() });
    setBusy(false);
    if (e2) { setMsg("Código incorrecto. Prueba con el siguiente que muestre la app."); return; }
    setAlta(null); setCodigo("");
    setMsg("Verificación en dos pasos ACTIVADA ✓");
    await cargar();
  }

  async function desactivar(factorId: string) {
    setBusy(true); setMsg("");
    const { error } = await supabaseBrowser().auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg("Segundo factor desactivado.");
    await cargar();
  }

  const activo = factores?.some((f) => f.status === "verified") ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Verificación en dos pasos</CardTitle>
        <CardDescription>
          Un código de una app autenticadora (funciona sin internet en el móvil) además de la contraseña.
          Opcional, pero muy recomendable para el propietario.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {factores === null && <div className="text-sm text-muted-foreground">Cargando…</div>}
        {factores !== null && !activo && !alta && (
          <Button type="button" variant="outline" onClick={empezarAlta} disabled={busy}>Activar con app autenticadora</Button>
        )}
        {alta && (
          <div className="space-y-3">
            <p className="text-sm">Escanea el código con tu app (Google Authenticator, Aegis, 1Password…) y escribe el código de 6 dígitos:</p>
            <img src={alta.qr} alt="Código QR para la app autenticadora" className="h-40 w-40 rounded-md border border-input bg-white p-2" />
            <p className="text-xs text-muted-foreground">Si no puedes escanear, clave manual: <code className="select-all">{alta.secreto}</code></p>
            <div className="flex items-center gap-2">
              <Label htmlFor="totp" className="sr-only">Código</Label>
              <Input id="totp" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="w-28" maxLength={6}
                value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
              <Button type="button" onClick={confirmarAlta} disabled={busy || codigo.length < 6}>Confirmar</Button>
            </div>
          </div>
        )}
        {activo && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-input px-3 py-2">
            <div className="text-sm font-medium">Activada ✓</div>
            <Button type="button" variant="outline" size="sm" disabled={busy}
              onClick={() => { const f = factores?.find((x) => x.status === "verified"); if (f) desactivar(f.id); }}>
              Desactivar
            </Button>
          </div>
        )}
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </CardContent>
    </Card>
  );
}
