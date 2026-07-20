"use client";

// Plantilla base (consola de plataforma, Fase 2). La plantilla es un tenant
// (marcado es_plantilla) que se edita como un backoffice normal: tu cuenta de
// Gluuh es su dueña, así que entras a app.gluuh.com y editas su carta, impuestos,
// formas de pago. Al crear una empresa marcas qué clonar de aquí.
// (0127: se retiró "plantillas de ticket" — la tabla era un stub sin usar; el
// diseño del ticket vive en `setting` clave `impresion.config.ticket`.)
import { useEffect, useState } from "react";
import { LayoutTemplate, ExternalLink } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TablaPublica } from "@gluuh/supabase";

interface Resumen { nombre: string; productos: number; familias: number; impuestos: number; formas: number }

export default function Plantilla() {
  const [r, setR] = useState<Resumen | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data: pl } = await sb.from("tenant").select("id,nombre").eq("es_plantilla", true).maybeSingle();
      const t = pl as { id: string; nombre: string } | null;
      if (!t) { setR({ nombre: "—", productos: 0, familias: 0, impuestos: 0, formas: 0 }); return; }
      const cnt = async (tabla: TablaPublica) =>
        (await sb.from(tabla).select("id", { count: "exact", head: true }).eq("tenant_id", t.id)).count ?? 0;
      setR({
        nombre: t.nombre,
        productos: await cnt("product"), familias: await cnt("family"),
        impuestos: await cnt("tax_rate"), formas: await cnt("payment_method"),
      });
    })();
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-muted"><LayoutTemplate className="h-4.5 w-4.5 text-muted-foreground" aria-hidden /></span>
        <div>
          <h1 className="text-lg font-semibold">Plantilla base</h1>
          <p className="text-[13px] text-muted-foreground">Lo que se clona en cada empresa nueva según lo que marques al crearla.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Cómo se edita</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-[13px] text-(--text-secondary)">
          <p>La plantilla es la empresa <strong>«{r?.nombre ?? "…"}»</strong>. Tu cuenta de Gluuh es su dueña, así que la editas como cualquier backoffice: entra a <strong>app.gluuh.com</strong> con tu correo y modifica su <strong>carta, impuestos y formas de pago</strong>. Lo que dejes ahí es lo que heredan las empresas nuevas.</p>
          <Button variant="outline" size="sm" onClick={() => window.open("https://app.gluuh.com", "_blank", "noopener,noreferrer")}>
            <ExternalLink className="h-4 w-4" /> Abrir el backoffice de la plantilla
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Contenido actual</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { l: "Familias", v: r?.familias }, { l: "Productos", v: r?.productos },
              { l: "Impuestos", v: r?.impuestos }, { l: "Formas de pago", v: r?.formas },
            ].map((x) => (
              <div key={x.l} className="rounded-md border border-border bg-surface p-3 text-center">
                <div className="text-xl font-semibold tabular-nums">{r ? x.v : "—"}</div>
                <div className="text-[11px] text-muted-foreground">{x.l}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
