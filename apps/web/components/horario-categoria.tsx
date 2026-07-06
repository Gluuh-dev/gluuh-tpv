"use client";

// Sección "Horario" de la ficha de categoría (0067, patrón Ágora): franjas de
// disponibilidad con días de la semana. Sin franjas = siempre visible.
// Nota: el TPV aún no filtra por horario (se cableará con el resto de filtros).
import { useCallback, useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";
import { Clock, Plus, Trash2, TriangleAlert } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Franja { id: string; hora_inicio: string; hora_fin: string; dias: number[] }

const DIAS = [
  { n: 1, t: "L" }, { n: 2, t: "M" }, { n: 3, t: "X" }, { n: 4, t: "J" },
  { n: 5, t: "V" }, { n: 6, t: "S" }, { n: 7, t: "D" },
];
const hhmm = (t: string) => t.slice(0, 5);

export function HorarioCategoria({ refId }: Readonly<{ refId: string }>) {
  const sb = supabaseBrowser();
  const [cargando, setCargando] = useState(true);
  const [sin0067, setSin0067] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [nueva, setNueva] = useState({ inicio: "08:00", fin: "12:00", dias: [1, 2, 3, 4, 5, 6, 7] as number[] });

  const cargar = useCallback(async () => {
    const [{ data: t }, r] = await Promise.all([
      sb.from("tenant").select("id").limit(1).maybeSingle(),
      sb.from("category_horario").select("id,hora_inicio,hora_fin,dias").eq("category_id", refId).order("hora_inicio"),
    ]);
    if (r.error) { setSin0067(true); setCargando(false); return; }
    setTenantId((t as { id: string } | null)?.id ?? null);
    setFranjas((r.data as Franja[] | null) ?? []);
    setCargando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refId]);

  useEffect(() => { void cargar(); }, [cargar]);

  function toggleDia(n: number) {
    setNueva((s) => ({ ...s, dias: s.dias.includes(n) ? s.dias.filter((d) => d !== n) : [...s.dias, n].sort((a, b) => a - b) }));
  }

  async function anadir() {
    if (!nueva.inicio || !nueva.fin || nueva.dias.length === 0) { toast.error("Pon horas y al menos un día."); return; }
    const { error } = await sb.from("category_horario").insert({
      tenant_id: tenantId, category_id: refId,
      hora_inicio: nueva.inicio, hora_fin: nueva.fin, dias: nueva.dias,
    });
    if (error) { toast.error(`No se pudo añadir la franja: ${error.message}`); return; }
    await cargar();
  }
  async function quitar(id: string) {
    const { error } = await sb.from("category_horario").delete().eq("id", id);
    if (error) { toast.error(`No se pudo quitar: ${error.message}`); return; }
    await cargar();
  }

  if (sin0067) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>Falta aplicar la migración <strong>0067</strong> (horario por categoría).</p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div>
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden /> Horario
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Franjas en las que la categoría está disponible (ej.: desayunos solo por la mañana). Sin franjas = siempre.
          </p>
        </div>

        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <>
            {franjas.length > 0 && (
              <div className="divide-y divide-border">
                {franjas.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="tabular-nums font-medium">{hhmm(f.hora_inicio)} – {hhmm(f.hora_fin)}</span>
                    <span className="flex flex-1 gap-1">
                      {DIAS.map((d) => (
                        <span key={d.n} className={`grid h-6 w-6 place-items-center rounded text-[11px] font-semibold ${f.dias.includes(d.n) ? "bg-brand/15 text-brand" : "bg-surface-overlay text-muted-foreground/50"}`}>
                          {d.t}
                        </span>
                      ))}
                    </span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      aria-label="Quitar franja" onClick={() => quitar(f.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="h-inicio">Hora inicio</Label>
                <Input id="h-inicio" type="time" value={nueva.inicio} onChange={(e) => setNueva((s) => ({ ...s, inicio: e.target.value }))} className="w-28" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="h-fin">Hora fin</Label>
                <Input id="h-fin" type="time" value={nueva.fin} onChange={(e) => setNueva((s) => ({ ...s, fin: e.target.value }))} className="w-28" />
              </div>
              <div className="space-y-1.5">
                <Label>Días</Label>
                <div className="flex gap-1">
                  {DIAS.map((d) => (
                    <button
                      key={d.n}
                      type="button"
                      onClick={() => toggleDia(d.n)}
                      aria-pressed={nueva.dias.includes(d.n)}
                      className={`grid h-9 w-9 place-items-center rounded-md border text-sm font-semibold transition-colors ${nueva.dias.includes(d.n) ? "border-brand bg-brand/10 text-brand" : "border-border bg-surface text-muted-foreground hover:bg-surface-overlay"}`}
                    >
                      {d.t}
                    </button>
                  ))}
                </div>
              </div>
              <Button type="button" variant="outline" onClick={anadir}>
                <Plus className="h-4 w-4" /> Añadir franja
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
