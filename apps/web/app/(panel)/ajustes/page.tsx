"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

const TERRITORIOS = [
  { v: "PENINSULA_BALEARES", t: "Península / Baleares (IVA)" },
  { v: "CANARIAS", t: "Canarias (IGIC)" },
  { v: "CEUTA_MELILLA", t: "Ceuta / Melilla (IPSI)" },
  { v: "FORAL_PV", t: "País Vasco (TicketBAI)" },
  { v: "FORAL_NAVARRA", t: "Navarra" },
];

export default function Ajustes() {
  const sb = supabaseBrowser();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [f, setF] = useState({ empresa: "", nombre: "", direccion: "", cif: "", razon_social: "", territorio_fiscal: "PENINSULA_BALEARES", serie_factura: "F" });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: t } = await sb.from("tenant").select("id,nombre").limit(1).maybeSingle();
      const { data: l } = await sb.from("location").select("id,nombre,direccion,cif,razon_social,territorio_fiscal,serie_factura").limit(1).maybeSingle();
      setTenantId(t?.id ?? null);
      setLocationId(l?.id ?? null);
      setF({
        empresa: t?.nombre ?? "",
        nombre: l?.nombre ?? "",
        direccion: l?.direccion ?? "",
        cif: l?.cif === "PENDIENTE" ? "" : l?.cif ?? "",
        razon_social: l?.razon_social ?? "",
        territorio_fiscal: l?.territorio_fiscal ?? "PENINSULA_BALEARES",
        serie_factura: l?.serie_factura ?? "F",
      });
    })();
    /* eslint-disable-next-line */
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    if (tenantId) await sb.from("tenant").update({ nombre: f.empresa }).eq("id", tenantId);
    if (locationId) await sb.from("location").update({
      nombre: f.nombre, direccion: f.direccion, cif: f.cif || "PENDIENTE",
      razon_social: f.razon_social, territorio_fiscal: f.territorio_fiscal, serie_factura: f.serie_factura,
    }).eq("id", locationId);
    setSaving(false);
    setMsg("Guardado ✓");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ajustes</h1>
        <p className="text-slate-500">Datos fiscales del local (necesarios para la facturación VERIFACTU).</p>
      </div>
      <form className="card space-y-4" onSubmit={guardar}>
        <div><label className="label">Nombre de la empresa</label><input className="input" value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value })} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Nombre del local</label><input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div>
          <div><label className="label">CIF/NIF</label><input className="input" value={f.cif} onChange={(e) => setF({ ...f, cif: e.target.value })} placeholder="B12345678" /></div>
        </div>
        <div><label className="label">Razón social</label><input className="input" value={f.razon_social} onChange={(e) => setF({ ...f, razon_social: e.target.value })} /></div>
        <div><label className="label">Dirección</label><input className="input" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Territorio fiscal</label><select className="input" value={f.territorio_fiscal} onChange={(e) => setF({ ...f, territorio_fiscal: e.target.value })}>{TERRITORIOS.map((t) => <option key={t.v} value={t.v}>{t.t}</option>)}</select></div>
          <div><label className="label">Serie de factura</label><input className="input" value={f.serie_factura} onChange={(e) => setF({ ...f, serie_factura: e.target.value })} /></div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
          {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        </div>
      </form>
    </div>
  );
}
