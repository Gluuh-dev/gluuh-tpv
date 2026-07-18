"use client";

// HUB de configuración dentro del TPV (F4 de docs/implementacion/17-tpv-perfecto.md).
// Tarjetas grandes táctiles a las pantallas de config; navbar morado del TPV para
// no "salir" de la app. Cada pantalla vive en su ruta (code-splitting).
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Package, UtensilsCrossed, MonitorSmartphone, Settings2 } from "lucide-react";
import { NavbarTPV } from "../components/NavbarTPV";

const PANTALLAS = [
  { ruta: "/tpv/config/empleados", nombre: "Empleados", detalle: "Altas, PIN, pulseras y perfiles", icono: Users },
  { ruta: "/tpv/config/articulos", nombre: "Artículos", detalle: "Precios, IVA, zonas de impresión, visibilidad", icono: Package },
  { ruta: "/tpv/config/menu", nombre: "Menús", detalle: "Menús del día: grupos y opciones", icono: UtensilsCrossed },
  { ruta: "/tpv/config/terminales", nombre: "Terminales", detalle: "Dispositivos vinculados y su estado", icono: MonitorSmartphone },
  { ruta: "/tpv/config/ajustes", nombre: "Ajustes del terminal", detalle: "Tema, modo zurdo y preferencias locales", icono: Settings2 },
];

export default function ConfigTPV() {
  const router = useRouter();
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <NavbarTPV operario="Configuración" subtitulo="TPV">
        <h1 className="flex-none text-lg font-bold tracking-tight">Configuración</h1>
        <span className="flex-1" />
        <button type="button" onClick={() => router.push("/tpv")}
          className="flex flex-none items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/25">
          <ArrowLeft size={16} /> Volver al TPV
        </button>
      </NavbarTPV>
      <div className="mx-auto grid w-full max-w-3xl flex-1 auto-rows-min grid-cols-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2">
        {PANTALLAS.map((p) => (
          <button key={p.ruta} type="button" onClick={() => router.push(p.ruta)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-brand/40 hover:bg-brand/5 active:scale-[.99]">
            <span className="grid h-12 w-12 flex-none place-items-center rounded-lg bg-brand/10 text-brand"><p.icono size={24} /></span>
            <span className="min-w-0">
              <b className="block text-base">{p.nombre}</b>
              <span className="text-sm text-muted-foreground">{p.detalle}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
