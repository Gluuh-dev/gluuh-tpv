"use client";

// Cabecera común de la empresa en la consola: volver, título con badges,
// estado de suscripción, editar y pestañas Ficha · Suscripción · Uso.
import Link from "next/link";
import { ArrowLeft, Building2, Pencil } from "lucide-react";
import { estadoSuscripcion, fechaCorta, urlEmpresa, type ResumenEmpresa } from "@/app/lib/admin-empresas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TABS = [
  { k: "ficha", t: "Ficha", sufijo: "" },
  { k: "suscripcion", t: "Suscripción", sufijo: "/suscripcion" },
  { k: "uso", t: "Uso", sufijo: "/uso" },
] as const;
export type TabEmpresa = (typeof TABS)[number]["k"];

export function EncabezadoEmpresa({ emp, tab }: { emp: ResumenEmpresa; tab: TabEmpresa }) {
  const base = urlEmpresa(emp);
  const sub = estadoSuscripcion(emp.licencia_hasta);
  return (
    <div className="space-y-4">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Empresas</Link>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-surface-muted"><Building2 className="h-5 w-5 text-muted-foreground" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">{emp.nombre} {emp.es_plantilla && <Badge variant="info">Plantilla</Badge>} {!emp.activo && <Badge variant="destructive">Suspendida</Badge>}</h1>
          <p className="text-[13px] text-muted-foreground">{emp.cif ? `CIF ${emp.cif} · ` : ""}Alta {fechaCorta(emp.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={sub.variant}>{sub.texto}</Badge>
          <Link href={`${base}/editar`}><Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5" /> Editar datos</Button></Link>
        </div>
      </div>
      <nav className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link key={t.k} href={`${base}${t.sufijo}`}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] transition-colors ${tab === t.k ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.t}
          </Link>
        ))}
      </nav>
    </div>
  );
}
