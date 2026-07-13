"use client";

// Activación de la INSTALACIÓN: se introduce el código de instalación de la
// empresa (0000-0000-00000-0000-0000, lo entrega el técnico de Gluuh) y el
// equipo queda fijado a esa empresa. Si ya está activada, solo un código
// nuevo válido (es decir, el técnico) puede cambiarla.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, MonitorCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { leerInstalacion, guardarInstalacion, type Instalacion } from "../lib/instalacion";

// Formatea mientras se teclea: solo dígitos, guiones en 4-4-5-4-4.
function formatear(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 21);
  const cortes = [4, 8, 13, 17, 21];
  const partes: string[] = [];
  let ini = 0;
  for (const fin of cortes) {
    if (d.length <= ini) break;
    partes.push(d.slice(ini, fin));
    ini = fin;
  }
  return partes.join("-");
}

export default function Instalar() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [actual, setActual] = useState<Instalacion | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => setActual(leerInstalacion()), []);

  async function activar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const r = await fetch("/api/instalacion/activar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "No se pudo activar."); return; }
      guardarInstalacion({ tenantId: j.tenant_id, empresa: j.empresa });
      router.replace("/login");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
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
            <CardTitle className="flex items-center gap-2 text-xl"><MonitorCheck className="h-5 w-5" aria-hidden /> Activar instalación</CardTitle>
            <CardDescription>
              {actual
                ? <>Este equipo pertenece a <strong>{actual.empresa}</strong>. Introducir un código nuevo lo cambiará de empresa (solo el técnico dispone de códigos).</>
                : "Introduce el código de instalación que te ha entregado el técnico de Gluuh."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={activar} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="codigo">Código de instalación</Label>
                <Input
                  id="codigo"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0000-0000-00000-0000-0000"
                  className="text-center font-mono tracking-widest"
                  value={codigo}
                  onChange={(e) => setCodigo(formatear(e.target.value))}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={cargando || codigo.replace(/\D/g, "").length !== 21}>
                <KeyRound className="h-4 w-4" /> {cargando ? "Activando…" : "Activar este equipo"}
              </Button>
              {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          El código fija este equipo a la empresa: sus usuarios, su carta y su caja.
        </p>
      </div>
    </main>
  );
}
