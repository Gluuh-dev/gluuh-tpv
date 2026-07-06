"use client";

// Candado "Zona técnica": las páginas técnicas del backoffice (Impresión,
// Dispositivos, Copias de seguridad) piden la clave del instalador antes de
// mostrarse. Es un candado blando ("no toques esto"), no seguridad dura: el
// desbloqueo vive en sessionStorage 8 h y la clave se valida contra el hash
// del tenant (RPC validar_clave_tecnica, migración 0045).

import { useEffect, useState } from "react";
import { KeyRound, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STORAGE_KEY = "gluuh_tecnico";
const VIGENCIA_MS = 8 * 60 * 60 * 1000; // 8 horas de desbloqueo por sesión

function desbloqueoVigente(): boolean {
  const t = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
  return t > 0 && Date.now() - t < VIGENCIA_MS;
}

export function ZonaTecnica({ children }: { children: React.ReactNode }) {
  // null = aún sin comprobar (sessionStorage no existe en SSR)
  const [abierta, setAbierta] = useState<boolean | null>(null);
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setAbierta(desbloqueoVigente()); }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const { data, error: err } = await supabaseBrowser().rpc("validar_clave_tecnica", { p_clave: clave });
      if (err) throw err;
      if (!data) { setError("Clave incorrecta"); return; }
      sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
      setClave("");
      setAbierta(true);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "No se pudo validar la clave");
    } finally { setBusy(false); }
  }

  function bloquear() {
    sessionStorage.removeItem(STORAGE_KEY);
    setAbierta(false);
  }

  if (abierta === null) return null;

  if (!abierta) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-muted">
            <Lock className="h-5 w-5 text-(--text-muted)" aria-hidden />
          </div>
          <h1 className="mt-3 text-[16px] font-semibold">Zona técnica</h1>
          <p className="mt-1 text-[12.5px] text-(--text-secondary)">Esta sección la configura tu instalador.</p>
          <form onSubmit={entrar} className="mt-4 space-y-2 text-left">
            <Label htmlFor="zt-clave">Clave de técnico</Label>
            <Input id="zt-clave" type="password" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} />
            <Button className="w-full" disabled={busy || !clave}>{busy ? "Comprobando…" : "Entrar"}</Button>
            {error && <p className="text-[12.5px] text-rose-500">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={bloquear}
          aria-label="Bloquear la zona técnica"
          title="Bloquear la zona técnica"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-(--text-muted) transition-colors hover:bg-surface-overlay hover:text-foreground"
        >
          <LockOpen className="h-3.5 w-3.5" aria-hidden /> Bloquear
        </button>
      </div>
      {children}
    </div>
  );
}

/** Card para regenerar la clave técnica (pide la actual y la nueva). */
export function ClaveTecnicaCard() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [busy, setBusy] = useState(false);

  async function regenerar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabaseBrowser().rpc("establecer_clave_tecnica", { p_actual: actual, p_nueva: nueva });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setActual(""); setNueva("");
    toast.success("Clave técnica actualizada. Apunta la nueva: no se vuelve a mostrar.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" aria-hidden /> Clave técnica</CardTitle>
        <CardDescription>Protege esta zona. Cámbiala si el cliente la ha visto o la has perdido tú.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={regenerar} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="zt-actual">Clave actual</Label>
            <Input id="zt-actual" type="password" autoComplete="off" className="w-40" value={actual} onChange={(e) => setActual(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zt-nueva">Clave nueva</Label>
            <Input id="zt-nueva" type="password" autoComplete="off" className="w-40" value={nueva} onChange={(e) => setNueva(e.target.value)} />
          </div>
          <Button variant="outline" disabled={busy || nueva.length < 4}>{busy ? "Guardando…" : "Cambiar clave"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
