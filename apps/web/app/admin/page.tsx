"use client";

// Empresas (consola de plataforma) — LISTA/análisis. El alta vive en su propia
// pantalla (/admin/empresas/nueva) y la gestión de cada empresa en su ficha
// (/admin/empresas/[id]). Aquí: tabla con suscripción + uso, clicable, y las
// solicitudes de acceso (leads).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Package, Users, MonitorSmartphone } from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { estadoSuscripcion, fechaCorta, type ResumenEmpresa } from "../lib/admin-empresas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Lead { id: string; nombre: string | null; email: string | null; telefono: string | null; mensaje: string | null; created_at: string }

export default function Empresas() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [empresas, setEmpresas] = useState<ResumenEmpresa[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    // Sesión y gate es_admin_plataforma los resuelve la consola (admin/layout).
    (async () => {
      const [{ data: e }, { data: l }] = await Promise.all([
        sb.rpc("admin_resumen_empresas"),
        sb.from("contact_request").select("id,nombre,email,telefono,mensaje,created_at").order("created_at", { ascending: false }).limit(50),
      ]);
      setEmpresas((e as ResumenEmpresa[]) ?? []);
      setLeads((l as Lead[]) ?? []);
    })();
    /* eslint-disable-next-line */
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Empresas</h1>
          <p className="text-[13px] text-muted-foreground">Todas las empresas con su suscripción y uso. Pulsa una para su ficha.</p>
        </div>
        <Button onClick={() => router.push("/admin/empresas/nueva")}><Plus className="h-4 w-4" /> Nueva empresa</Button>
      </div>

      <Card>
        <CardContent className="px-0 pt-0">
          <Table>
            <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Suscripción</TableHead><TableHead className="text-center">Prod.</TableHead><TableHead className="text-center">Usu.</TableHead><TableHead className="text-center">Disp.</TableHead></TableRow></TableHeader>
            <TableBody>
              {empresas.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Aún no hay empresas. Crea la primera con «Nueva empresa».</TableCell></TableRow>}
              {empresas.map((e) => {
                const sub = estadoSuscripcion(e.licencia_hasta);
                return (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => router.push(`/admin/empresas/${e.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        {e.nombre}
                        {e.es_plantilla && <Badge variant="info">Plantilla</Badge>}
                        {!e.activo && <Badge variant="destructive">Suspendida</Badge>}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{e.codigo_instalacion ?? "sin código"}</div>
                    </TableCell>
                    <TableCell><Badge variant={sub.variant}>{sub.texto}</Badge> <span className="text-[11px] text-muted-foreground">{fechaCorta(e.licencia_hasta)}</span></TableCell>
                    <TableCell className="text-center tabular-nums text-muted-foreground"><Package className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />{e.n_productos}</TableCell>
                    <TableCell className="text-center tabular-nums text-muted-foreground"><Users className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />{e.n_usuarios}</TableCell>
                    <TableCell className="text-center tabular-nums text-muted-foreground"><MonitorSmartphone className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />{e.n_dispositivos_online}/{e.n_dispositivos}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {leads.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Solicitudes de acceso ({leads.length})</CardTitle></CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Contacto</TableHead><TableHead>Mensaje</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader>
              <TableBody>
                {leads.map((l) => (
                  <TableRow key={l.id}><TableCell>{l.nombre}</TableCell><TableCell className="text-muted-foreground">{l.email} {l.telefono}</TableCell><TableCell>{l.mensaje}</TableCell><TableCell className="text-muted-foreground">{new Date(l.created_at).toLocaleDateString("es-ES")}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
