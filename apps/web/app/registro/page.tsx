"use client";

import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Registro NO público: las cuentas las crea el administrador de Gluuh.
// Esta página recoge solicitudes de acceso/contacto.
export default function SolicitarAcceso() {
  const [f, setF] = useState({ nombre: "", email: "", telefono: "", mensaje: "" });
  const [estado, setEstado] = useState<{ t: "ok" | "err"; x: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setEstado(null);
    const { error } = await supabaseBrowser().from("contact_request").insert({
      nombre: f.nombre, email: f.email, telefono: f.telefono, mensaje: f.mensaje,
    });
    setBusy(false);
    if (error) setEstado({ t: "err", x: error.message });
    else { setEstado({ t: "ok", x: "¡Gracias! Te contactaremos para darte de alta." }); setF({ nombre: "", email: "", telefono: "", mensaje: "" }); }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← Gluuh TPV</Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Solicitar acceso</CardTitle>
            <CardDescription>El alta la gestiona nuestro equipo. Déjanos tus datos y te contactamos.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={enviar}>
              <div className="space-y-1.5"><Label>Nombre / restaurante</Label><Input required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Teléfono</Label><Input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>¿Qué necesitas?</Label><Textarea rows={3} value={f.mensaje} onChange={(e) => setF({ ...f, mensaje: e.target.value })} /></div>
              <Button className="w-full" disabled={busy}>{busy ? "Enviando…" : "Enviar solicitud"}</Button>
              {estado && <p className={`text-sm ${estado.t === "ok" ? "text-emerald-600" : "text-destructive"}`}>{estado.x}</p>}
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">¿Ya tienes cuenta? <Link href="/login" className="font-medium text-primary hover:underline">Inicia sesión</Link></p>
      </div>
    </main>
  );
}
