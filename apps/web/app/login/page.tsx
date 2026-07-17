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
import { leerInstalacion, type Instalacion } from "../lib/instalacion";

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
  // Instalación fijada a una empresa (0078): login por usuario acotado a su tenant.
  const [instalacion, setInstalacion] = useState<Instalacion | null>(null);
  // Host de plataforma (admin.gluuh.com): login SOLO por email (sin pestaña
  // Usuario, que es para operarios/cliente).
  const [esPlataforma, setEsPlataforma] = useState(false);
  const [recordar, setRecordar] = useState(true);

  useEffect(() => {
    setMounted(true);
    const plataforma = window.location.hostname.startsWith("admin.");
    if (plataforma) { setEsPlataforma(true); setModo("email"); }
    // Recordar cuenta: pre-rellena el último email usado.
    try { const e = localStorage.getItem("gluuh:email"); if (e) setEmail(e); else setRecordar(false); } catch { /* sin almacenamiento */ }
    const i = leerInstalacion();
    if (i && !plataforma) { setInstalacion(i); setModo("usuario"); }
    // En el TPV (app de escritorio) o servido por el NODO, el login natural es
    // USUARIO+clave del bar — el email es para el dueño desde casa. Se
    // preselecciona la pestaña para no pedir "tantos datos" en la barra.
    if (!plataforma && (window.gluuh || window.__GLUUH__?.nodo)) setModo("usuario");
  }, []);

  // Tras iniciar sesión: las cuentas de empresa recién creadas (alta de Gluuh,
  // metadata debe_cambiar_password) pasan primero por /cambiar-password. Después
  // se fija el CONTEXTO de la sesión (empresa/local, F1): con una membresía se
  // activa sola; con varias se elige en /elegir-empresa.
  async function irTrasLogin() {
    const sb = supabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    if (user?.user_metadata?.debe_cambiar_password) { window.location.href = "/cambiar-password"; return; }
    const { resolverContextoTrasLogin } = await import("../lib/contexto");
    const destino = await resolverContextoTrasLogin(sb);
    if (destino) { window.location.href = destino; return; }
    window.location.href = window.gluuh ? "/inicio" : "/dashboard";
  }

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
    if (error) { setError(traducirErrorAuth(error.message)); return; }
    // Recordar cuenta: guarda o borra el email para la próxima vez.
    try { if (recordar) localStorage.setItem("gluuh:email", email.trim()); else localStorage.removeItem("gluuh:email"); } catch { /* sin almacenamiento */ }
    await irTrasLogin();
  }

  async function onPasskey() {
    setConPasskey(true);
    setError("");
    try {
      const { error } = await entrarConPasskey(supabaseBrowser());
      if (error) setError(traducirErrorAuth(error.message));
      // En Gluuh Desktop, al lanzador (elegir TPV/Ajustes); en navegador, al panel.
      else await irTrasLogin();
    } catch (e) {
      setError("No se pudo usar la passkey en este dispositivo.");
    } finally {
      setConPasskey(false);
    }
  }

  // Operario local (usr_app+clave): la ruta verifica y prepara la cuenta sintética;
  // luego completamos la sesión con signInWithPassword (email interno devuelto).
  async function entrarOperario(): Promise<string | null> {
    const r = await fetch("/api/entrar-operario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: usuario.trim(), clave: clave.trim(), tenant_id: instalacion?.tenantId ?? null }),
    });
    const j = await r.json();
    if (!r.ok) return j.error ?? "No se pudo entrar.";
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: j.email, password: j.secret });
    return error ? traducirErrorAuth(error.message) : null;
  }

  // "Bar Pepe" → barpepe (igual que el alta): cuenta de EMPRESA del backoffice.
  const normUsuario = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

  async function onSubmitUsuario(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      let fallo: string | null;
      if (instalacion) {
        // Equipo instalado: operario de SU empresa (acotado por tenant).
        fallo = await entrarOperario();
      } else {
        // Nube/backoffice: cuenta de empresa (usuario del alta). Si no cuadra,
        // probamos operario (compatibilidad y desarrollo sin instalación).
        const { error } = await supabaseBrowser().auth.signInWithPassword({
          email: `${normUsuario(usuario)}@cuentas.gluuh.local`,
          password: clave.trim(),
        });
        fallo = error ? await entrarOperario() : null;
      }
      if (fallo) setError(fallo);
      else await irTrasLogin();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }

  let descripcion: React.ReactNode = "Accede al panel de tu restaurante.";
  if (esPlataforma) descripcion = "Acceso del equipo de Gluuh.";
  else if (instalacion) descripcion = <>Equipo de <strong className="text-foreground">{instalacion.empresa}</strong>. Entra con tu usuario y clave.</>;

  return (
    <main className="relative grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-xl font-semibold">
          <img src="/logo.png" alt="Gluuh Logo" className="h-9 w-9 object-contain" />
          Gluuh <span className="text-muted-foreground">TPV</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{esPlataforma ? "Plataforma Gluuh" : "Iniciar sesión"}</CardTitle>
            <CardDescription>{descripcion}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* En plataforma (admin.gluuh.com) o con instalación fijada no hay
                pestañas: plataforma = solo email; instalación = solo usuario+clave. */}
            {!instalacion && !esPlataforma && (
              <div className="mb-4 flex gap-0.5 rounded-md border border-border p-0.5 text-sm">
                <button type="button" onClick={() => { setModo("email"); setError(""); }} className={`flex-1 rounded px-2 py-1.5 transition-colors ${modo === "email" ? "bg-surface-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}>Email</button>
                <button type="button" onClick={() => { setModo("usuario"); setError(""); }} className={`flex-1 rounded px-2 py-1.5 transition-colors ${modo === "usuario" ? "bg-surface-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}>Usuario</button>
              </div>
            )}

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
                <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} className="accent-primary" />
                  Recordar mi cuenta
                </label>
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

            {instalacion && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                {modo === "usuario"
                  ? <button type="button" className="hover:text-foreground hover:underline" onClick={() => { setModo("email"); setError(""); }}>Acceso con email (dueño / técnico)</button>
                  : <button type="button" className="hover:text-foreground hover:underline" onClick={() => { setModo("usuario"); setError(""); }}>← Volver al acceso por usuario</button>}
              </p>
            )}

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
        {!esPlataforma && (instalacion ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            ¿Cambiar la empresa de este equipo? <Link href="/instalar" className="hover:text-foreground hover:underline">Código de instalación</Link>
          </p>
        ) : (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿Tu restaurante aún no tiene acceso? <Link href="/registro" className="font-medium text-primary hover:underline">Solicítalo aquí</Link>
            <br />
            <Link href="/instalar" className="text-xs hover:text-foreground hover:underline">¿Equipo nuevo? Actívalo con tu código de instalación</Link>
          </p>
        ))}
      </div>
    </main>
  );
}
