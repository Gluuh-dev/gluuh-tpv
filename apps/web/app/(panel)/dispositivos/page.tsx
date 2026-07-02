"use client";

// Dispositivos del local: generar códigos de vinculación (6 dígitos, 10 min)
// y desvincular pantallas. La página Módulos (guía 04) absorberá esta vista.
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

interface Dispositivo {
  id: string;
  nombre: string;
  tipo: string;
  modulo: string | null;
  codigo_vinculacion: string | null;
  codigo_expira: string | null;
  vinculado_at: string | null;
}

const MODULOS = ["TPV", "COCINA", "PANTALLA", "KIOSKO", "CARTELERIA", "COMANDERA", "VISOR"] as const;

export default function Dispositivos() {
  const sb = supabaseBrowser();
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [modulo, setModulo] = useState<string>("TPV");
  const [nombre, setNombre] = useState("");
  const [codigoNuevo, setCodigoNuevo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function cargar() {
    const { data } = await sb
      .from("device")
      .select("id, nombre, tipo, modulo, codigo_vinculacion, codigo_expira, vinculado_at")
      .order("created_at", { ascending: false });
    setDispositivos((data as Dispositivo[]) ?? []);
  }
  useEffect(() => { void cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function generar() {
    setBusy(true); setError(""); setCodigoNuevo(null);
    try {
      const token = (await sb.auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/dispositivos/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ tipo: modulo === "COMANDERA" ? "COMANDERA" : modulo === "COCINA" ? "KDS" : modulo, modulo, nombre }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) { setError(j.error ?? "No se pudo generar el código"); return; }
      setCodigoNuevo(j.codigo);
      setNombre("");
      await cargar();
    } finally { setBusy(false); }
  }

  async function desvincular(id: string) {
    await sb.from("device").delete().eq("id", id);
    await cargar();
  }

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold">Dispositivos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Vincula el TPV de escritorio o cualquier pantalla tecleando el código en <code>/conectar</code> del dispositivo.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-4">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Módulo</span>
          <select value={modulo} onChange={(e) => setModulo(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2">
            {MODULOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Nombre</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="TPV Barra, Tele cocina…"
            className="h-9 w-56 rounded-md border border-border bg-background px-2"
          />
        </label>
        <button onClick={generar} disabled={busy} className="btn-primary h-9 disabled:opacity-50">
          Generar código
        </button>
        {codigoNuevo && (
          <div className="ml-2 rounded-md border border-border bg-background px-4 py-1.5">
            <span className="text-xs text-muted-foreground">Código (10 min): </span>
            <span className="text-2xl font-bold tabular-nums tracking-widest">{codigoNuevo}</span>
          </div>
        )}
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 font-medium">Nombre</th>
            <th className="font-medium">Módulo</th>
            <th className="font-medium">Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {dispositivos.map((d) => {
            const codigoVivo = d.codigo_vinculacion && d.codigo_expira && new Date(d.codigo_expira) > new Date();
            return (
              <tr key={d.id} className="border-b border-border">
                <td className="py-2">{d.nombre}</td>
                <td>{d.modulo ?? d.tipo}</td>
                <td>
                  {d.vinculado_at
                    ? <span className="text-emerald-600">Vinculado</span>
                    : codigoVivo
                      ? <span className="tabular-nums">Código {d.codigo_vinculacion}</span>
                      : <span className="text-muted-foreground">Pendiente</span>}
                </td>
                <td className="text-right">
                  <button onClick={() => desvincular(d.id)} className="btn-ghost text-destructive">
                    {d.vinculado_at ? "Desvincular" : "Eliminar"}
                  </button>
                </td>
              </tr>
            );
          })}
          {dispositivos.length === 0 && (
            <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Sin dispositivos todavía.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
