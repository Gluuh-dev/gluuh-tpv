"use client";

// Selector de empresa (F1 entrega 1.2): una cuenta puede pertenecer a varias
// empresas; cada SESIÓN elige la suya y el servidor la valida y registra.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { misMembresias, elegirEmpresa, ultimoTenant, type Membresia } from "../lib/contexto";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ElegirEmpresa() {
  const router = useRouter();
  const [membresias, setMembresias] = useState<Membresia[] | null>(null);
  const [error, setError] = useState("");
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  const ultimo = ultimoTenant();

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const m = await misMembresias(sb);
      if (!m || m.length === 0) { router.replace("/dashboard"); return; } // transición o sin membresías: el panel decide
      if (m.length === 1) {
        await elegirEmpresa(sb, m[0]!.tenant_id);
        router.replace("/dashboard");
        return;
      }
      setMembresias(m);
    })();
  }, [router]);

  async function entrar(tenantId: string) {
    setEligiendo(tenantId);
    setError("");
    const ok = await elegirEmpresa(supabaseBrowser(), tenantId);
    if (!ok) { setError("No se pudo activar esa empresa. Vuelve a intentarlo."); setEligiendo(null); return; }
    router.replace("/dashboard");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>¿Con qué empresa entras?</CardTitle>
          <CardDescription>Tu cuenta pertenece a varias empresas. Esta elección solo afecta a esta sesión.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!membresias && <div className="py-6 text-center text-[13px] text-(--text-muted)">Cargando…</div>}
          {membresias?.map((m) => (
            <Button
              key={m.tenant_id}
              variant={m.tenant_id === ultimo ? "default" : "outline"}
              className="h-11 justify-start gap-3"
              disabled={eligiendo !== null}
              onClick={() => entrar(m.tenant_id)}
            >
              <Building2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate text-left">{m.tenant_nombre}</span>
              <span className="text-[11px] uppercase text-(--text-muted)">{m.rol.toLowerCase()}</span>
            </Button>
          ))}
          {error && <p className="text-[12.5px] text-red-500">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
