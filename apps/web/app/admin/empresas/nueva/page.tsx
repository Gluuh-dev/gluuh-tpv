"use client";

// Crear empresa (consola de plataforma) — pantalla propia. Alta completa en un
// paso: datos + duración + módulos contratados + qué importar de la plantilla.
// Devuelve el pack de entrega (usuario+password, código de instalación, clave
// técnica) una sola vez.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { MODULOS, type DefModulo } from "@/app/lib/modulos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MODULOS_PREMIUM = (Object.entries(MODULOS) as [string, DefModulo][]).filter(([, d]) => d.requiereLicencia).map(([k, d]) => ({ k, nombre: d.nombre }));
const IMPORTABLES = [
  { k: "catalogo", nombre: "Familias y productos" },
  { k: "impuestos", nombre: "Impuestos" },
  { k: "formas_pago", nombre: "Formas de pago" },
  // 0127: fuera "Plantillas de ticket" — la tabla era un stub que nunca clonó
  // nada; el diseño del ticket vive en `setting` (`impresion.config.ticket`).
];
const normalizarUsuario = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const VACIO = { empresa: "", usuario: "", emailContacto: "", cif: "", direccion: "", poblacion: "", provincia: "", codigoPostal: "", telefono: "", meses: "12", modulos: [] as string[], importar: ["catalogo", "impuestos", "formas_pago"] as string[] };

export default function NuevaEmpresa() {
  const router = useRouter();
  const [f, setF] = useState(VACIO);
  const [usrManual, setUsrManual] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; x: string } | null>(null);
  const [alta, setAlta] = useState<{ codigo: string | null; clave: string | null; usuario: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setAlta(null);
    const { data: { session } } = await supabaseBrowser().auth.getSession();
    const res = await fetch("/api/admin/crear-empresa", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ ...f, meses: Number(f.meses) }),
    });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg({ t: "err", x: out.error ?? "Error" }); return; }
    setMsg({ t: "ok", x: `Empresa "${f.empresa}" creada.` });
    setAlta({ codigo: out.codigoInstalacion ?? null, clave: out.claveTecnica ?? null, usuario: out.usuario ?? "", password: out.passwordInicial ?? "" });
    setF(VACIO); setUsrManual(false);
  }

  const toggleMod = (k: string) => setF((s) => ({ ...s, modulos: s.modulos.includes(k) ? s.modulos.filter((m) => m !== k) : [...s.modulos, k] }));
  const toggleImp = (k: string) => setF((s) => ({ ...s, importar: s.importar.includes(k) ? s.importar.filter((m) => m !== k) : [...s.importar, k] }));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Empresas</Link>

      {alta ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Empresa creada ✓ — pack de entrega</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[13px] text-muted-foreground">Apúntalo, no se vuelve a mostrar. El código activa cada equipo en /instalar; el usuario+password es el acceso al backoffice.</p>
            <div className="grid gap-1.5 rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
              <p>Usuario backoffice: <span className="font-mono font-semibold">{alta.usuario}</span></p>
              <p>Password inicial: <span className="font-mono font-semibold">{alta.password}</span> <span className="text-xs text-muted-foreground">(la cambia al entrar)</span></p>
              {alta.codigo && <p>Código de instalación: <span className="font-mono font-semibold tracking-wider">{alta.codigo}</span></p>}
              {alta.clave && <p>Clave técnica: <span className="font-mono font-semibold">{alta.clave}</span></p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAlta(null)}>Crear otra</Button>
              <Button onClick={() => router.push("/admin")}>Ir a Empresas</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" /> Nueva empresa</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={crear} className="space-y-3">
              <div className="space-y-1.5"><Label>Nombre de la empresa</Label><Input required value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value, ...(usrManual ? {} : { usuario: normalizarUsuario(e.target.value) }) })} /></div>
              <div className="space-y-1.5">
                <Label>Usuario de acceso (backoffice)</Label>
                <Input required minLength={3} value={f.usuario} placeholder="barpepe" onChange={(e) => { setUsrManual(true); setF({ ...f, usuario: normalizarUsuario(e.target.value) }); }} />
                <p className="text-[11px] text-muted-foreground">Con él entra el cliente (sin email). La password inicial se genera sola y la cambia en su primer acceso.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Email de contacto <span className="text-muted-foreground">(opcional)</span></Label>
                <Input type="email" value={f.emailContacto} onChange={(e) => setF({ ...f, emailContacto: e.target.value })} placeholder="avisos de caducidad — no es para entrar" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>CIF/NIF</Label><Input value={f.cif} onChange={(e) => setF({ ...f, cif: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Teléfono</Label><Input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Dirección</Label><Input value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5"><Label>Población</Label><Input value={f.poblacion} onChange={(e) => setF({ ...f, poblacion: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>C. P.</Label><Input value={f.codigoPostal} onChange={(e) => setF({ ...f, codigoPostal: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Provincia</Label><Input value={f.provincia} onChange={(e) => setF({ ...f, provincia: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Duración de la licencia</Label>
                <Select value={f.meses} onValueChange={(v) => setF({ ...f, meses: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="12">12 meses</SelectItem><SelectItem value="24">24 meses</SelectItem><SelectItem value="36">36 meses</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Módulos contratados</Label>
                <div className="flex flex-wrap gap-2">
                  {MODULOS_PREMIUM.map(({ k, nombre }) => (
                    <label key={k} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
                      <input type="checkbox" checked={f.modulos.includes(k)} onChange={() => toggleMod(k)} className="accent-primary" /> {nombre}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Importar de la plantilla base</Label>
                <div className="flex flex-wrap gap-2">
                  {IMPORTABLES.map(({ k, nombre }) => (
                    <label key={k} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
                      <input type="checkbox" checked={f.importar.includes(k)} onChange={() => toggleImp(k)} className="accent-primary" /> {nombre}
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">Se clona de «Plantilla base». Los usuarios (admin/camarero/técnico) y perfiles se crean siempre.</p>
              </div>
              <Button className="w-full" disabled={busy}>{busy ? "Creando…" : "Crear empresa"}</Button>
              {msg && msg.t === "err" && <p className="text-sm text-destructive">{msg.x}</p>}
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
