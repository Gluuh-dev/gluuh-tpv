import Link from "next/link";
import {
  WifiOff, ShieldCheck, Smartphone, ChefHat, Tag, MonitorSmartphone,
  ArrowRight, ShoppingCart, Store, Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const FEATURES = [
  { icon: WifiOff, title: "Funciona sin internet", desc: "Local-first: cobra, comanda e imprime aunque caiga la red. La caja nunca para." },
  { icon: ShieldCheck, title: "VERIFACTU · IGIC e IVA", desc: "Cumple la ley española de serie, con motor fiscal por territorio (Canarias incluido)." },
  { icon: Smartphone, title: "Comandera con PIN", desc: "Cada camarero entra con su PIN; sus comandas quedan a su nombre." },
  { icon: ChefHat, title: "Cocina en tiempo real", desc: "Las comandas llegan al KDS al instante (Supabase Realtime)." },
  { icon: MonitorSmartphone, title: "Web, Windows y móvil", desc: "Una sola plataforma: backoffice, TPV de barra, kiosko y app de camarero." },
  { icon: Tag, title: "Precio honesto", desc: "Sin permanencia, sin alta, precios públicos. Lo contrario al mercado." },
];

const PANTALLAS = [
  { icon: ShoppingCart, label: "TPV de barra", desc: "Cobro rápido, división de cuenta y ticket con QR fiscal." },
  { icon: Smartphone, label: "Comandera", desc: "El camarero toma nota desde el móvil con su PIN." },
  { icon: Store, label: "Kiosko de autopedido", desc: "Tus clientes piden y pagan solos, con tu marca." },
  { icon: ChefHat, label: "Cocina (KDS)", desc: "Las comandas llegan a cocina en tiempo real." },
  { icon: MonitorSmartphone, label: "Display de pedidos", desc: "Pantalla de “preparando / listo” para la sala." },
  { icon: Megaphone, label: "Cartelería y ofertas", desc: "Promos con imagen o vídeo, programables por cliente." },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">G</span>
            Gluuh <span className="text-slate-400">TPV</span>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link href="/login">Iniciar sesión</Link></Button>
            <Button asChild><Link href="/registro">Solicitar acceso</Link></Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16 text-center sm:py-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
          <ShieldCheck className="h-4 w-4" /> Compatible con VERIFACTU · IGIC e IVA
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          El TPV de hostelería que <span className="text-primary">no te deja tirado</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Vende, cobra y factura legalmente — en barra, en mesa y desde el móvil.
          Funciona sin internet, sin permanencia y con tu marca.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg"><Link href="/registro">Solicitar demo <ArrowRight className="h-4 w-4" /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/login">Ya tengo cuenta</Link></Button>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="p-5">
              <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-5 w-5" /></span>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pantallas */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Una plataforma, todas las pantallas</h2>
          <p className="mt-1 text-muted-foreground">Barra, sala, cocina, kiosko y cartelería — cada restaurante con sus datos y su marca.</p>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PANTALLAS.map(({ icon: Icon, label, desc }) => (
            <Card key={label} className="p-5">
              <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-5 w-5" /></span>
              <h3 className="text-base font-semibold">{label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </div>
        <Card className="mt-8 p-8 text-center">
          <h3 className="text-lg font-semibold">¿Lo quieres para tu restaurante?</h3>
          <p className="mt-1 text-muted-foreground">El alta la gestiona nuestro equipo. Te damos acceso y configuramos tu marca.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link href="/registro">Solicitar acceso <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/login">Ya tengo cuenta</Link></Button>
          </div>
        </Card>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <strong className="text-slate-700">Gluuh</strong> · familia Gluuh Campo · Gluuh TPV
      </footer>
    </div>
  );
}
