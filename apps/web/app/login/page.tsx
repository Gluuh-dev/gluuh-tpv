"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, Fingerprint } from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { traducirErrorAuth } from "@/lib/auth-errors";
import { entrarConPasskey, passkeysSoportadas } from "@/lib/passkeys";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [conPasskey, setConPasskey] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    // Recortar espacios invisibles (autocompletar/pegar suelen añadir un espacio
    // al final) que harían fallar el login con credenciales correctas.
    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });
    setCargando(false);
    if (error) setError(traducirErrorAuth(error.message));
    else window.location.href = "/dashboard";
  }

  async function onPasskey() {
    setConPasskey(true);
    setError("");
    try {
      const { error } = await entrarConPasskey(supabaseBrowser());
      if (error) setError(traducirErrorAuth(error.message));
      else window.location.href = "/dashboard";
    } catch (e) {
      setError("No se pudo usar la passkey en este dispositivo.");
    } finally {
      setConPasskey(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-xl font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">G</span>
          Gluuh <span className="text-muted-foreground">TPV</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            <CardDescription>Accede al panel de tu restaurante.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="tucorreo@restaurante.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={cargando}>
                <LogIn className="h-4 w-4" /> {cargando ? "Entrando…" : "Entrar"}
              </Button>
              {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            </form>

            {mounted && passkeysSoportadas() && (
              <>
                <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> o <span className="h-px flex-1 bg-border" />
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={onPasskey} disabled={conPasskey}>
                  <Fingerprint className="h-4 w-4" /> {conPasskey ? "Esperando…" : "Entrar con huella / Face ID"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Tu restaurante aún no tiene acceso? <Link href="/registro" className="font-medium text-primary hover:underline">Solicítalo aquí</Link>
        </p>
      </div>
    </main>
  );
}
