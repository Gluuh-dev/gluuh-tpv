"use client";

// Aceptar una invitación (F2): el enlace de un solo uso verifica el email y la
// persona crea AQUÍ su contraseña (Gluuh nunca la conoce). Si el email ya tiene
// cuenta, se pide iniciar sesión y la invitación añade la membresía sin tocarla.
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";

type Info = { empresa: string; email: string; estado: string };

export default function AceptarInvitacion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [cargando, setCargando] = useState(false);
  const [conSesion, setConSesion] = useState(false);

  useEffect(() => {
    (async () => {
      const [res, sesion] = await Promise.all([
        fetch(`/api/invitaciones/canjear?token=${encodeURIComponent(token)}`).catch(() => null),
        supabaseBrowser().auth.getSession(),
      ]);
      setConSesion(Boolean(sesion.data.session));
      const j = await res?.json().catch(() => null);
      if (!res?.ok || !j) { setError(j?.error ?? "No se pudo cargar la invitación."); return; }
      setInfo(j as Info);
    })();
  }, [token]);

  async function aceptar(e: React.FormEvent) {
    e.preventDefault();
    if (!conSesion) {
      if (p1.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
      if (p1 !== p2) { setError("Las contraseñas no coinciden."); return; }
    }
    setCargando(true);
    setError("");
    const { data: { session } } = await supabaseBrowser().auth.getSession();
    const res = await fetch("/api/invitaciones/canjear", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ token, ...(conSesion ? {} : { password: p1 }) }),
    }).catch(() => null);
    setCargando(false);
    const j = await res?.json().catch(() => null);
    if (!res?.ok) { setError(j?.error ?? "No se pudo aceptar la invitación."); return; }
    router.replace(conSesion ? "/elegir-empresa" : "/login");
  }

  const invalida = info && info.estado !== "EMITIDA";

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MailCheck className="h-5 w-5" aria-hidden /> Invitación a Gluuh
            </CardTitle>
            <CardDescription>
              {info ? <>Acceso a <b>{info.empresa}</b> para <b>{info.email}</b>.</> : "Comprobando la invitación…"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invalida && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {info?.estado === "ACEPTADA" ? "Esta invitación ya se usó." : "Esta invitación ha caducado o fue revocada. Pide que te la reenvíen."}
              </p>
            )}
            {info && !invalida && (
              <form onSubmit={aceptar} className="space-y-4">
                {conSesion ? (
                  <p className="text-sm text-(--text-secondary)">Tienes sesión iniciada: se añadirá esta empresa a tu cuenta, sin cambiar tu contraseña.</p>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="p1">Crea tu contraseña</Label>
                      <PasswordInput id="p1" autoComplete="new-password" minLength={8} required value={p1} onChange={(e) => setP1(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="p2">Repítela</Label>
                      <PasswordInput id="p2" autoComplete="new-password" minLength={8} required value={p2} onChange={(e) => setP2(e.target.value)} />
                    </div>
                  </>
                )}
                <Button type="submit" className="w-full" disabled={cargando}>
                  {cargando ? "Aceptando…" : "Aceptar invitación"}
                </Button>
                {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              </form>
            )}
            {!info && error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
