"use client";

// Primer acceso de la cuenta de empresa (alta de Gluuh): la password inicial
// es de un solo uso — aquí el cliente crea la suya. Mientras la metadata
// debe_cambiar_password esté activa, el panel redirige a esta página.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { traducirErrorAuth } from "@/lib/auth-errors";

export default function CambiarPassword() {
  const router = useRouter();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      if (!session) router.replace("/login");
    })();
  }, [router]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (p1.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (p1 !== p2) { setError("Las contraseñas no coinciden."); return; }
    setCargando(true);
    setError("");
    // El cambio lo hace el SERVIDOR (F2): la bandera debe_cambiar_password ya no
    // la limpia el propio cliente — solo se limpia si la contraseña cambió.
    const sb = supabaseBrowser();
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch("/api/cuenta/cambiar-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ password: p1 }),
    }).catch(() => null);
    setCargando(false);
    if (!res?.ok) {
      const j = await res?.json().catch(() => null);
      setError(traducirErrorAuth(j?.error ?? "No se pudo guardar la contraseña."));
      return;
    }
    // Cambiar la contraseña cierra TODAS las demás sesiones (F2 2.3): si alguien
    // tenía la cuenta abierta con la clave vieja, se queda fuera.
    await sb.auth.signOut({ scope: "others" }).catch(() => { /* mejor esfuerzo */ });
    // Refrescar la sesión para que la metadata limpia llegue al cliente.
    await sb.auth.refreshSession();
    router.replace("/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-xl font-semibold">
          <img src="/logo.png" alt="Gluuh Logo" className="h-9 w-9 object-contain" />
          Gluuh <span className="text-muted-foreground">TPV</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl"><KeyRound className="h-5 w-5" aria-hidden /> Crea tu contraseña</CardTitle>
            <CardDescription>La contraseña inicial era de un solo uso. Elige la tuya para seguir.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={guardar} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="p1">Nueva contraseña</Label>
                <PasswordInput id="p1" autoComplete="new-password" minLength={8} required value={p1} onChange={(e) => setP1(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p2">Repítela</Label>
                <PasswordInput id="p2" autoComplete="new-password" minLength={8} required value={p2} onChange={(e) => setP2(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={cargando}>
                {cargando ? "Guardando…" : "Guardar y entrar"}
              </Button>
              {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">Mínimo 8 caracteres. Guárdala bien: sin email, la recuperación la hace Gluuh.</p>
      </div>
    </main>
  );
}
