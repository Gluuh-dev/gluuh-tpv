import Link from "next/link";
import {
  WifiOff, ShieldCheck, Smartphone, ChefHat, Tag, MonitorSmartphone,
  ArrowRight, ShoppingCart, Store, Megaphone,
} from "lucide-react";

const FEATURES = [
  { icon: WifiOff, title: "Funciona sin internet", desc: "Local-first: cobra, comanda e imprime aunque caiga la red. La caja nunca para." },
  { icon: ShieldCheck, title: "VERIFACTU · IGIC e IVA", desc: "Cumple la ley española de serie, con motor fiscal por territorio (Canarias incluido)." },
  { icon: Smartphone, title: "Comandera con PIN", desc: "Cada camarero entra con su PIN; sus comandas quedan a su nombre." },
  { icon: ChefHat, title: "Cocina en tiempo real", desc: "Las comandas llegan al KDS al instante (Supabase Realtime)." },
  { icon: MonitorSmartphone, title: "Web, Windows y móvil", desc: "Una sola plataforma: backoffice, TPV de barra, kiosko y app de camarero." },
  { icon: Tag, title: "Precio honesto", desc: "Sin permanencia, sin alta, precios públicos. Lo contrario al mercado." },
];

const DEMOS = [
  { href: "/tpv", label: "TPV", icon: ShoppingCart },
  { href: "/kiosko", label: "Kiosko", icon: Store },
  { href: "/kds", label: "Cocina (KDS)", icon: ChefHat },
  { href: "/pantalla", label: "Display", icon: MonitorSmartphone },
  { href: "/ofertas", label: "Ofertas", icon: Megaphone },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Barra superior */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-bold text-white">G</span>
            Gluuh <span className="text-slate-400">TPV</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost">Iniciar sesión</Link>
            <Link href="/registro" className="btn-primary">Solicitar acceso</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16 text-center sm:py-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
          <ShieldCheck className="h-4 w-4" /> Compatible con VERIFACTU · IGIC e IVA
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          El TPV de hostelería que <span className="text-brand-600">no te deja tirado</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Vende, cobra y factura legalmente — en barra, en mesa y desde el móvil.
          Funciona sin internet, sin permanencia y con tu marca.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/registro" className="btn-primary px-6 py-3 text-base">Solicitar demo <ArrowRight className="h-4 w-4" /></Link>
          <Link href="/login" className="btn-ghost px-6 py-3 text-base">Ya tengo cuenta</Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card">
              <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-5 w-5" /></span>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demos */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-2xl font-semibold">Míralo en acción</h2>
          <p className="mt-1 text-slate-600">Pantallas de demostración (datos de ejemplo).</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {DEMOS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium hover:bg-slate-100">
                <Icon className="h-4 w-4 text-brand-600" /> {label}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">Flujo completo: pide en <code>/kiosko</code>, gestiónalo en <code>/kds</code> y míralo en <code>/pantalla</code>.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        <strong className="text-slate-700">Gluuh</strong> · familia Gluuh Campo · Gluuh TPV
      </footer>
    </div>
  );
}
