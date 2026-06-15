"use client";

import { useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

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
    <main className="grid min-h-screen place-items-center p-6">
      <form className="card w-full max-w-md space-y-3" onSubmit={enviar}>
        <a href="/" className="text-sm text-slate-400">← Gluuh TPV</a>
        <h1 className="text-2xl font-semibold">Solicitar acceso</h1>
        <p className="text-sm text-slate-500">El alta la gestiona nuestro equipo. Déjanos tus datos y te contactamos.</p>
        <div><label className="label">Nombre / restaurante</label><input className="input" required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div>
        <div><label className="label">Email</label><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><label className="label">Teléfono</label><input className="input" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></div>
        <div><label className="label">¿Qué necesitas?</label><textarea className="input" rows={3} value={f.mensaje} onChange={(e) => setF({ ...f, mensaje: e.target.value })} /></div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Enviando…" : "Enviar solicitud"}</button>
        {estado && <p className={`text-sm ${estado.t === "ok" ? "text-emerald-600" : "text-red-600"}`}>{estado.x}</p>}
        <p className="text-center text-sm text-slate-500">¿Ya tienes cuenta? <a href="/login" className="text-brand-600">Inicia sesión</a></p>
      </form>
    </main>
  );
}
