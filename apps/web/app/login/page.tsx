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
  // Dos vías: email+contraseña (dueño/técnico/remoto) o usuario+clave (operario local).
  const [modo, setModo] = useState<"email" | "usuario">("email");
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");

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
      // En Gluuh Desktop, al lanzador (elegir TPV/Ajustes); en navegador, al panel.
      else window.location.href = window.gluuh ? "/inicio" : "/dashboard";
    } catch (e) {
      setError("No se pudo usar la passkey en este dispositivo.");
    } finally {
      setConPasskey(false);
    }
  }

  // Login local por código+clave: la ruta verifica y prepara la cuenta sintética;
  // luego completamos la sesión con signInWithPassword (email interno devuelto).
  async function onSubmitUsuario(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const r = await fetch("/api/entrar-operario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: usuario.trim(), clave: clave.trim() }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "No se pudo entrar."); return; }
      const { error } = await supabaseBrowser().auth.signInWithPassword({ email: j.email, password: j.secret });
      if (error) setError(traducirErrorAuth(error.message));
      else window.location.href = window.gluuh ? "/inicio" : "/dashboard";
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
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
            <div className="mb-4 flex gap-0.5 rounded-md border border-border p-0.5 text-sm">
              <button type="button" onClick={() => { setModo("email"); setError(""); }} className={`flex-1 rounded px-2 py-1.5 transition-colors ${modo === "email" ? "bg-surface-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}>Email</button>
              <button type="button" onClick={() => { setModo("usuario"); setError(""); }} className={`flex-1 rounded px-2 py-1.5 transition-colors ${modo === "usuario" ? "bg-surface-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}>Usuario</button>
            </div>

            {modo === "email" ? (
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
              </form>
            ) : (
              <form onSubmit={onSubmitUsuario} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="usuario">Usuario</Label>
                  <Input id="usuario" autoComplete="username" autoCapitalize="none" placeholder="tu usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clave">Clave</Label>
                  <PasswordInput id="clave" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={cargando}>
                  <LogIn className="h-4 w-4" /> {cargando ? "Entrando…" : "Entrar"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">Con tu usuario y clave del panel (operarios sin email).</p>
              </form>
            )}

            {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            {modo === "email" && mounted && passkeysSoportadas() && (
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
