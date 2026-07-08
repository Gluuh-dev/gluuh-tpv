"use client";

// Editar datos de una empresa (consola de plataforma). Carga los datos actuales
// (admin_empresa_datos, 0086) y guarda con la acción "editar" de /api/admin/empresa.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { buscarEmpresa, type ResumenEmpresa } from "@/app/lib/admin-empresas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Datos { nombre: string; cif: string; emailContacto: string; direccion: string; poblacion: string; provincia: string; codigoPostal: string; telefono: string }
const VACIO: Datos = { nombre: "", cif: "", emailContacto: "", direccion: "", poblacion: "", provincia: "", codigoPostal: "", telefono: "" };

export default function EditarEmpresa() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Datos>(VACIO);
  const [tid, setTid] = useState("");   // UUID real (el parámetro puede ser el slug)
  const [cargando, setCargando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data: lista } = await sb.rpc("admin_resumen_empresas");
      const emp = buscarEmpresa(((lista as ResumenEmpresa[] | null) ?? []), id);
      if (!emp) { setCargando(false); return; }
      setTid(emp.id);
      const { data } = await sb.rpc("admin_empresa_datos", { p_tenant: emp.id });
      const r = (Array.isArray(data) ? data[0] : data) as Record<string, string | null> | undefined;
      if (r) setD({
        nombre: r.nombre ?? "", cif: r.cif ?? "", emailContacto: r.email_admin ?? "",
        direccion: r.direccion ?? "", poblacion: r.poblacion ?? "", provincia: r.provincia ?? "",
        codigoPostal: r.codigo_postal ?? "", telefono: r.telefono ?? "",
      });
      setCargando(false);
    })();
  }, [id]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { data: { session } } = await supabaseBrowser().auth.getSession();
    const res = await fetch("/api/admin/empresa", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ accion: "editar", tenantId: tid || id, ...d }),
    });
    setBusy(false);
    if (!res.ok) { const o = await res.json(); setErr(o.error ?? "Error"); return; }
    router.push(`/admin/empresas/${id}`);
  }

  if (cargando) return <div className="grid h-64 place-items-center text-muted-foreground">Cargando…</div>;

  const campo = (k: keyof Datos, label: string, extra?: Record<string, string>) => (
    <div className="space-y-1.5"><Label>{label}</Label><Input value={d[k]} onChange={(e) => setD((s) => ({ ...s, [k]: e.target.value }))} {...extra} /></div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href={`/admin/empresas/${id}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Ficha</Link>
      <Card>
        <CardHeader><CardTitle className="text-base">Editar datos de la empresa</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={guardar} className="space-y-3">
            {campo("nombre", "Nombre de la empresa")}
            <div className="grid grid-cols-2 gap-3">{campo("cif", "CIF/NIF")}{campo("telefono", "Teléfono")}</div>
            {campo("emailContacto", "Email de contacto", { type: "email" })}
            {campo("direccion", "Dirección")}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">{campo("poblacion", "Población")}</div>
              {campo("codigoPostal", "C. P.")}
            </div>
            {campo("provincia", "Provincia")}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
              <Button type="button" variant="ghost" onClick={() => router.push(`/admin/empresas/${id}`)}>Cancelar</Button>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
