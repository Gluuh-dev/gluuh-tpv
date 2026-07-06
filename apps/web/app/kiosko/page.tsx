"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Delete, Minus, Plus, ShoppingBag, Utensils } from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { BRANDING_DEFAULT, leerBranding, textoSobre, type Branding } from "../lib/branding";
import {
  CONFIG_KIOSKO_DEF, DISENOS_KIOSKO, configCon,
  type ConfigKiosko, type DisenoKiosko,
} from "../lib/modulos";

interface Cat { id: string; nombre: string; family_id: string | null; foto_url?: string | null }
interface Prod { id: string; nombre: string; precio: number; tipo_impositivo: number; category_id: string | null; foto_url: string | null }
type Paso = "inicio" | "carta" | "nombre" | "pago" | "ok";

const eur = (n: number) => Number(n).toFixed(2) + " €";
const FILAS_TECLADO = ["QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM"];

/* ── Plantillas de diseño ──────────────────────────────────────────────
   Mismo flujo y componentes en los 4 diseños; cada tema solo cambia la
   piel (colores inline, porque salen del branding del tenant) y tres
   decisiones de disposición (nav estrecha, dónde vive el carrito, aire).
   Campo undefined ⇒ se conservan las clases del diseño "marca" (original). */
interface Tema {
  fondo?: string;         // fondo general (carta y pantallas del flujo)
  texto?: string;
  suave?: string;         // texto secundario
  panel?: string;         // nav de categorías, panel de pedido, hoja inferior
  tarjeta?: string;       // tarjetas de producto, teclas, pies con nombre/precio
  borde?: string;
  boton?: string;         // botones secundarios (equivalente a bg-muted)
  sombra?: string;        // sombra de tarjeta (claro: suave estilo McDonald's)
  precio?: string;        // acento de marca reservado a precios
  portadaBg?: string;     // fondo de la portada (por defecto, color de marca)
  portadaTexto?: string;
  tileBg?: string;        // botones grandes de la portada
  tileTexto?: string;
  cabeceraBg?: string;    // cabecera de la carta (por defecto, color de marca)
  cabeceraTexto?: string;
  radio?: string;         // clase de esquinas de la tarjeta de producto
  aire?: boolean;         // más separación y padding en la rejilla
  navEstrecha?: boolean;  // categorías en barra estrecha (miniatura + nombre)
  carrito?: "lateral" | "lateralLg" | "hoja";
}

function crearTema(diseno: DisenoKiosko, c: string, fg: string, colorFondo: string): Tema {
  let t: Tema;
  switch (diseno) {
    case "claro": // estilo McDonald's: blanco, aire, la marca solo en precios/badges/pagar
      t = {
        fondo: "#f5f5f6", texto: "#18181b", suave: "#71717a",
        panel: "#ffffff", tarjeta: "#ffffff", borde: "#ececee",
        boton: "#f1f1f2", sombra: "0 2px 10px rgba(0,0,0,.07)", precio: c,
        portadaBg: "#f5f5f6", portadaTexto: "#18181b", tileBg: "#ffffff", tileTexto: c,
        cabeceraBg: "#ffffff", cabeceraTexto: "#18181b",
        radio: "rounded-3xl", aire: true, carrito: "lateralLg",
      };
      break;
    case "calido": { // fondo tintado con la marca, nav estrecha, carrito en hoja inferior
      const fondo = `color-mix(in srgb, ${c} 10%, #ffffff)`;
      t = {
        fondo, texto: "#1c1917", suave: "#78716c",
        panel: `color-mix(in srgb, ${c} 5%, #ffffff)`, tarjeta: "#ffffff",
        borde: `color-mix(in srgb, ${c} 22%, #ffffff)`,
        boton: `color-mix(in srgb, ${c} 14%, #ffffff)`, precio: c,
        portadaBg: fondo, portadaTexto: "#1c1917", tileBg: "#ffffff", tileTexto: c,
        navEstrecha: true, carrito: "hoja",
      };
      break;
    }
    case "oscuro": // locales nocturnos: casi negro, marca en botones y precios
      t = {
        fondo: "#0b0b0c", texto: "#fafafa", suave: "#9f9fa8",
        panel: "#151517", tarjeta: "#1e1e21", borde: "#2a2a2e",
        boton: "#28282c", precio: c,
        portadaBg: "#0b0b0c", portadaTexto: "#fafafa", tileBg: c, tileTexto: fg,
        cabeceraBg: "#151517", cabeceraTexto: "#fafafa",
      };
      break;
    default: // "marca": el diseño original, sin overrides
      t = {};
  }
  if (colorFondo) {
    // Fondo personalizado: sustituye el fondo del diseño con contraste garantizado.
    const tx = textoSobre(colorFondo);
    t.fondo = colorFondo;
    t.texto = tx;
    t.suave = tx === "#0f172a" ? "rgba(15,23,42,.65)" : "rgba(255,255,255,.75)";
    if (diseno !== "marca") { t.portadaBg = colorFondo; t.portadaTexto = tx; }
  }
  return t;
}

export default function Kiosko() {
  const sb = supabaseBrowser();
  const [estado, setEstado] = useState<"cargando" | "sin-sesion" | "ok">("cargando");
  const [brand, setBrand] = useState<Branding>(BRANDING_DEFAULT);
  const [empresa, setEmpresa] = useState("");
  const [cfg, setCfg] = useState<ConfigKiosko>(CONFIG_KIOSKO_DEF);
  const [cats, setCats] = useState<Cat[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [colorCat, setColorCat] = useState<Record<string, string>>({});
  const [paso, setPaso] = useState<Paso>("inicio");
  const [tipoConsumo, setTipoConsumo] = useState<"LOCAL" | "PARA_LLEVAR">("LOCAL");
  const [catSel, setCatSel] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [nombre, setNombre] = useState("");
  const [numero, setNumero] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [hojaAbierta, setHojaAbierta] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setEstado("sin-sesion"); return; }
      const [{ data: t }, b, { data: f }, { data: c }, { data: p }, { data: m }] = await Promise.all([
        sb.from("tenant").select("nombre").limit(1).maybeSingle(),
        leerBranding(sb),
        sb.from("family").select("id,color"),
        sb.from("category").select("id,nombre,orden,family_id").order("orden"),
        sb.from("product").select("id,nombre,precio,tipo_impositivo,category_id,foto_url").eq("disponible", true).or(`agotado_hasta.is.null,agotado_hasta.lt.${new Date().toISOString()}`).order("nombre"),
        sb.from("tenant_module").select("config").eq("modulo", "KIOSKO").maybeSingle(),
      ]);
      setBrand(b);
      setEmpresa(b.nombre_comercial || t?.nombre || "");
      setCfg(configCon(CONFIG_KIOSKO_DEF, (m?.config && typeof m.config === "object" ? m.config : {}) as Record<string, unknown>));
      const fams = Object.fromEntries(((f as { id: string; color: string }[]) ?? []).map((x) => [x.id, x.color]));
      const catsArr = (c as Cat[]) ?? [];
      setCats(catsArr);
      setColorCat(Object.fromEntries(catsArr.map((cc) => [cc.id, cc.family_id ? (fams[cc.family_id] ?? "") : ""])));
      // Fotos de categoría (best-effort; la columna foto_url puede no existir aún, 0044).
      void sb.from("category").select("id,foto_url").then(({ data, error }) => {
        if (error || !data) return;
        const fotos = Object.fromEntries((data as { id: string; foto_url: string | null }[]).map((r) => [r.id, r.foto_url]));
        setCats((prev) => prev.map((cc) => ({ ...cc, foto_url: fotos[cc.id] ?? null })));
      });
      setProds((p as Prod[]) ?? []);
      setCatSel(catsArr[0]?.id ?? null);
      setEstado("ok");
    })();
    /* eslint-disable-next-line */
  }, []);

  // Auto-reset tras la confirmación: el kiosko vuelve solo a la bienvenida.
  useEffect(() => {
    if (paso !== "ok") return;
    const t = setTimeout(reiniciar, 15000);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [paso]);

  // c / fg: colores de marca del tenant (vienen de datos, no son paleta Tailwind)
  const c = brand.color_primario;
  const fg = textoSobre(c);
  const diseno: DisenoKiosko =
    cfg.diseno && (DISENOS_KIOSKO as readonly string[]).includes(cfg.diseno) ? cfg.diseno : "marca";
  const t = crearTema(diseno, c, fg, cfg.colorFondo ?? "");
  const sFondo = { background: t.fondo, color: t.texto };
  const sSuave = { color: t.suave };
  const sTecla = { background: t.tarjeta, borderColor: t.borde };

  const total = useMemo(() => Object.entries(carrito).reduce((s, [id, q]) => s + (prods.find((p) => p.id === id)?.precio ?? 0) * q, 0), [carrito, prods]);
  const unidades = Object.values(carrito).reduce((s, q) => s + q, 0);
  const add = (id: string) => setCarrito((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }));
  const sub = (id: string) => setCarrito((m) => { const n = (m[id] ?? 0) - 1; const { [id]: _, ...r } = m; return n > 0 ? { ...m, [id]: n } : r; });

  async function pagar() {
    setBusy(true);
    try {
      const items = Object.entries(carrito).flatMap(([id, cantidad]) => {
        const p = prods.find((x) => x.id === id);
        return p ? [{ product_id: id, nombre: p.nombre, cantidad, precio: p.precio, tipo: p.tipo_impositivo }] : [];
      });
      // ponytail: crear_pedido no acepta nombre; añadir parámetro en migración futura
      const { data, error } = await sb.rpc("crear_pedido", { p_tipo_consumo: tipoConsumo, p_items: items });
      if (error) { alert("No se pudo enviar el pedido. Avisa al personal."); return; }
      setNumero((data as { numero: number })?.numero ?? null);
      setPaso("ok");
    } finally { setBusy(false); }
  }
  function reiniciar() { setCarrito({}); setNombre(""); setNumero(null); setTipoConsumo("LOCAL"); setHojaAbierta(false); setPaso("inicio"); }

  const Logo = () => brand.logo_url
    ? <img src={brand.logo_url} alt="" className="mx-auto h-24 w-auto object-contain" />
    : <div className="text-6xl">🍔</div>;

  if (estado === "cargando") return (
    <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
      Cargando…
    </div>
  );
  if (estado === "sin-sesion") return (
    /* Fondo con color de marca del tenant (dato dinámico, no paleta fija) */
    <div className="grid min-h-screen place-items-center p-6 text-center" style={{ background: c, color: fg }}>
      <div>
        <Utensils className="mx-auto h-12 w-12" />
        <h1 className="mt-3 text-2xl font-bold">Kiosko sin configurar</h1>
        <p className="mt-2 opacity-90">Inicia sesión en este dispositivo con la cuenta del restaurante.</p>
        <a href="/login" className="mt-5 inline-block rounded-md bg-background px-6 py-3 font-semibold" style={{ color: c }}>
          Iniciar sesión
        </a>
      </div>
    </div>
  );

  /* ---- INICIO: portada según diseño (marca = color pleno, resto según tema) ---- */
  if (paso === "inicio") return (
    <div className="grid min-h-screen place-items-center p-6 text-center" style={{ background: t.portadaBg ?? c, color: t.portadaTexto ?? fg }}>
      <div>
        <Logo />
        <h1 className="mt-4 text-4xl font-bold">{brand.kiosko_titulo || empresa || "Bienvenido"}</h1>
        <p className="mt-1 text-lg opacity-90">{brand.kiosko_subtitulo || "Haz tu pedido aquí"}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-6">
          <button
            onClick={() => { setTipoConsumo("LOCAL"); setPaso("carta"); }}
            className="flex h-52 w-52 flex-col items-center justify-center gap-3 rounded-2xl bg-background shadow-sm transition-transform active:scale-95"
            style={{ background: t.tileBg, color: t.tileTexto ?? c, boxShadow: t.sombra }}
          >
            <Utensils className="h-16 w-16" />
            <span className="text-2xl font-bold">{cfg.textoAqui}</span>
          </button>
          <button
            onClick={() => { setTipoConsumo("PARA_LLEVAR"); setPaso("carta"); }}
            className="flex h-52 w-52 flex-col items-center justify-center gap-3 rounded-2xl bg-background shadow-sm transition-transform active:scale-95"
            style={{ background: t.tileBg, color: t.tileTexto ?? c, boxShadow: t.sombra }}
          >
            <ShoppingBag className="h-16 w-16" />
            <span className="text-2xl font-bold">{cfg.textoLlevar}</span>
          </button>
        </div>
      </div>
    </div>
  );

  /* ---- CONFIRMACIÓN: número gigante (legible a 2 m) + auto-reset ---- */
  if (paso === "ok") return (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center text-foreground" style={sFondo}>
      <div>
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full" style={{ background: c, color: fg }}>
          <Check className="h-14 w-14" />
        </div>
        <h1 className="mt-6 text-4xl font-bold">{nombre ? `¡Gracias, ${nombre}!` : "¡Pedido confirmado!"}</h1>
        <p className="mt-4 text-2xl text-muted-foreground" style={sSuave}>Tu número de pedido</p>
        <div className="mt-2 text-8xl font-black leading-none tabular-nums sm:text-[10rem]">A-{numero}</div>
        <p className="mt-6 text-2xl text-muted-foreground" style={sSuave}>{cfg.textoConfirmacion}</p>
        <button
          onClick={reiniciar}
          className="mt-10 h-14 rounded-xl bg-muted px-8 text-lg font-semibold transition-transform active:scale-95"
          style={{ background: t.boton, color: t.texto }}
        >
          Nuevo pedido
        </button>
      </div>
    </div>
  );

  /* ---- NOMBRE (opcional, según config): teclado táctil en pantalla ---- */
  if (paso === "nombre") return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground" style={sFondo}>
      <h1 className="text-3xl font-bold">¿Cómo te llamas?</h1>
      <p className="mt-1 text-muted-foreground" style={sSuave}>Aparecerá con tu pedido.</p>
      <div className="mt-6 grid h-16 w-full max-w-xl place-items-center rounded-xl border-2 border-border bg-card text-3xl font-bold tracking-wide" style={sTecla}>
        {nombre || <span className="font-normal text-muted-foreground/60" style={sSuave}>Escribe tu nombre…</span>}
      </div>
      <div className="mt-6 flex flex-col items-center gap-2">
        {FILAS_TECLADO.map((fila) => (
          <div key={fila} className="flex gap-2">
            {[...fila].map((l) => (
              <button
                key={l}
                onClick={() => setNombre((n) => (n + (!n || n.endsWith(" ") ? l : l.toLowerCase())).slice(0, 20))}
                className="grid h-14 w-12 place-items-center rounded-lg border border-border bg-card text-xl font-semibold transition-transform active:scale-95"
                style={sTecla}
              >
                {l}
              </button>
            ))}
          </div>
        ))}
        <div className="flex gap-2">
          <button
            onClick={() => setNombre((n) => (n && !n.endsWith(" ") ? (n + " ").slice(0, 20) : n))}
            className="h-14 w-64 rounded-lg border border-border bg-card font-semibold transition-transform active:scale-95"
            style={sTecla}
          >
            Espacio
          </button>
          <button
            onClick={() => setNombre((n) => n.slice(0, -1))}
            className="grid h-14 w-24 place-items-center rounded-lg border border-border bg-card transition-transform active:scale-95"
            style={sTecla}
            aria-label="Borrar"
          >
            <Delete className="h-6 w-6" />
          </button>
        </div>
      </div>
      <button
        onClick={() => setPaso("pago")}
        className="mt-8 h-16 w-full max-w-xl rounded-xl text-xl font-bold shadow-sm transition-transform active:scale-95"
        style={{ background: c, color: fg }}
      >
        Continuar
      </button>
      <button onClick={() => setPaso("carta")} className="mt-3 p-3 text-muted-foreground" style={sSuave}>← Volver</button>
    </div>
  );

  /* ---- PAGO: un solo botón honesto (pago simulado hasta el módulo PAGOS) ---- */
  if (paso === "pago") return (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center text-foreground" style={sFondo}>
      <div className="w-full max-w-md">
        <p className="text-lg text-muted-foreground" style={sSuave}>
          {unidades} producto(s) · {tipoConsumo === "LOCAL" ? cfg.textoAqui : cfg.textoLlevar}{nombre ? ` · ${nombre}` : ""}
        </p>
        <div className="my-4 text-7xl font-black tabular-nums">{eur(total)}</div>
        <button
          onClick={pagar}
          disabled={busy}
          className="grid h-24 w-full place-items-center rounded-2xl text-3xl font-bold shadow-sm transition-transform active:scale-95 disabled:opacity-50"
          style={{ background: c, color: fg }}
        >
          {busy ? "Procesando…" : "Pagar ahora"}
        </button>
        <p className="mt-3 text-xs text-muted-foreground" style={sSuave}>Modo demostración — pago real con el módulo PAGOS</p>
        <button onClick={() => setPaso("carta")} className="mt-6 p-3 text-muted-foreground" style={sSuave}>← Volver</button>
      </div>
    </div>
  );

  /* ---- CARTA: categorías con foto/color · productos con foto · carrito táctil ----
     Disposición según diseño: carrito lateral (marca/oscuro), lateral solo en
     pantallas anchas + hoja inferior en estrechas (claro), o solo hoja (cálido). */
  const productos = prods.filter((p) => p.category_id === catSel);
  const hayAside = t.carrito !== "hoja";
  const hayHoja = t.carrito === "hoja" || t.carrito === "lateralLg";

  // Líneas del pedido: mismas en el panel lateral y en la hoja inferior.
  const lineasCarrito = Object.entries(carrito).map(([id, q]) => {
    const p = prods.find((x) => x.id === id);
    if (!p) return null;
    return (
      <div key={id} className="flex items-center gap-2 border-b border-border/60 py-2" style={{ borderColor: t.borde }}>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{p.nombre}</div>
          {cfg.mostrarPrecios && <div className="text-sm tabular-nums text-muted-foreground" style={sSuave}>{eur(p.precio * q)}</div>}
        </div>
        <button
          onClick={() => sub(id)}
          className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-muted transition-transform active:scale-95"
          style={{ background: t.boton }}
          aria-label={`Quitar ${p.nombre}`}
        >
          <Minus className="h-5 w-5" />
        </button>
        <span className="w-8 flex-none text-center text-lg font-bold tabular-nums">{q}</span>
        <button
          onClick={() => add(id)}
          className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-muted transition-transform active:scale-95"
          style={{ background: t.boton }}
          aria-label={`Añadir ${p.nombre}`}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    );
  });

  // Botón de pagar gigante con el total siempre visible (único acento de dinero).
  const botonPagar = (alto: string) => (
    <button
      onClick={() => setPaso(cfg.pedirNombre ? "nombre" : "pago")}
      disabled={!unidades}
      className={`flex ${alto} w-full items-center justify-between rounded-2xl px-6 font-bold shadow-sm transition-transform active:scale-95 disabled:opacity-40`}
      style={{ background: c, color: fg }}
    >
      <span>Pagar</span>
      <span className="tabular-nums">{eur(total)}</span>
    </button>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground" style={sFondo}>
      <header
        className="flex flex-none items-center justify-between px-5 py-3"
        style={{
          background: t.cabeceraBg ?? c,
          color: t.cabeceraTexto ?? fg,
          borderBottom: t.cabeceraBg ? `1px solid ${t.borde ?? "transparent"}` : undefined,
        }}
      >
        <strong className="flex items-center gap-2 text-lg">
          {brand.logo_url ? <img src={brand.logo_url} alt="" className="h-7 w-auto object-contain" /> : "🍔"}
          {empresa}
        </strong>
        <span className="text-sm font-semibold">{tipoConsumo === "LOCAL" ? `🍽️ ${cfg.textoAqui}` : `🛍️ ${cfg.textoLlevar}`}</span>
      </header>
      <div className="flex min-h-0 flex-1">
        {/* Navegación de categorías: la foto o el color ES el botón */}
        <nav
          className={`${t.navEstrecha ? "w-24" : "w-44"} flex flex-none flex-col gap-2 overflow-y-auto border-r border-border bg-card p-2`}
          style={{ background: t.panel, borderColor: t.borde }}
        >
          {cats.map((cat) => {
            const sel = catSel === cat.id;
            const color = colorCat[cat.id] || "#64748b";
            return t.navEstrecha ? (
              /* Barra estrecha (cálido): miniatura + nombre debajo */
              <button
                key={cat.id}
                onClick={() => setCatSel(cat.id)}
                className="flex w-full flex-none flex-col items-center gap-1 rounded-xl p-2 transition-transform active:scale-95"
                style={{ background: sel ? t.boton : undefined, boxShadow: sel ? `inset 0 0 0 2px ${c}` : undefined }}
              >
                <span className="relative block h-12 w-12 overflow-hidden rounded-lg" style={{ background: color }}>
                  {cat.foto_url && <img src={cat.foto_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                </span>
                <span className="w-full text-center text-xs font-bold leading-tight">{cat.nombre}</span>
              </button>
            ) : (
              <button
                key={cat.id}
                onClick={() => setCatSel(cat.id)}
                className="relative aspect-square w-full flex-none overflow-hidden rounded-xl transition-transform active:scale-95"
                style={{ background: color, boxShadow: sel ? `inset 0 0 0 4px ${c}, 0 0 0 2px ${c}` : undefined }}
              >
                {cat.foto_url ? (<>
                  <img src={cat.foto_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-background/95 px-1 py-1 text-center text-sm font-bold leading-tight text-foreground" style={{ background: t.tarjeta, color: t.texto }}>{cat.nombre}</span>
                </>) : (
                  <span className="grid h-full w-full place-items-center px-1 text-center text-base font-bold leading-tight text-white">{cat.nombre}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Rejilla de productos: foto grande o color de familia */}
        <section
          className={`grid min-w-0 flex-1 content-start overflow-y-auto ${t.aire ? "gap-5 p-6" : "gap-3 p-4"}`}
          style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${t.aire ? 180 : 160}px,1fr))` }}
        >
          {productos.map((p) => {
            const color = colorCat[p.category_id ?? ""] || "#64748b";
            const q = carrito[p.id];
            return (
              <button
                key={p.id}
                onClick={() => add(p.id)}
                className={`relative aspect-square overflow-hidden border border-border shadow-sm transition-transform active:scale-95 ${t.radio ?? "rounded-xl"}`}
                style={{ background: t.tarjeta, borderColor: t.borde, boxShadow: t.sombra }}
              >
                {p.foto_url ? (<>
                  <img src={p.foto_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-background/95 px-2 py-1.5 text-center leading-tight" style={{ background: t.tarjeta, color: t.texto }}>
                    <div className="line-clamp-2 font-semibold">{p.nombre}</div>
                    {cfg.mostrarPrecios && <div className="font-bold tabular-nums" style={{ color: t.precio }}>{eur(p.precio)}</div>}
                  </div>
                </>) : (
                  <div className="grid h-full w-full content-center gap-1 px-2 text-center text-white" style={{ background: color }}>
                    <div className="line-clamp-3 text-lg font-bold leading-tight">{p.nombre}</div>
                    {cfg.mostrarPrecios && <div className="text-base font-semibold tabular-nums opacity-90">{eur(p.precio)}</div>}
                  </div>
                )}
                {q ? (
                  <span className="absolute right-2 top-2 grid h-9 min-w-9 place-items-center rounded-full px-1 text-lg font-bold" style={{ background: c, color: fg }}>
                    {q}
                  </span>
                ) : null}
              </button>
            );
          })}
          {productos.length === 0 && (
            <p className="col-span-full text-muted-foreground" style={sSuave}>Sin productos. Añade carta en el panel.</p>
          )}
        </section>

        {/* Panel de pedido lateral: controles ≥48px + botón Pagar gigante */}
        {hayAside && (
          <aside
            className={`w-96 min-h-0 flex-none flex-col border-l border-border bg-card ${t.carrito === "lateralLg" ? "hidden lg:flex" : "flex"}`}
            style={{ background: t.panel, borderColor: t.borde }}
          >
            <h2 className="flex-none border-b border-border px-4 py-3 text-lg font-semibold" style={{ borderColor: t.borde }}>Tu pedido</h2>
            <div className="flex-1 overflow-y-auto px-4">
              {unidades === 0 && <p className="py-4 text-muted-foreground" style={sSuave}>Toca un producto para añadirlo.</p>}
              {lineasCarrito}
            </div>
            <div className="flex-none border-t border-border p-4" style={{ borderColor: t.borde }}>
              {botonPagar("h-20 text-2xl")}
            </div>
          </aside>
        )}
      </div>

      {/* Hoja inferior colapsable: el total va siempre visible en el botón Pagar */}
      {hayHoja && (
        <div
          className={`flex-none border-t border-border bg-card ${t.carrito === "lateralLg" ? "lg:hidden" : ""}`}
          style={{ background: t.panel, borderColor: t.borde }}
        >
          {hojaAbierta && unidades > 0 && (
            <div className="max-h-64 overflow-y-auto border-b border-border px-4" style={{ borderColor: t.borde }}>
              {lineasCarrito}
            </div>
          )}
          <div className="flex items-center gap-3 p-3">
            <button
              type="button"
              onClick={() => setHojaAbierta((v) => !v)}
              disabled={!unidades}
              className="flex h-16 flex-none items-center gap-2 rounded-2xl bg-muted px-4 text-lg font-semibold transition-transform active:scale-95 disabled:opacity-40"
              style={{ background: t.boton }}
              aria-expanded={hojaAbierta}
              aria-label={hojaAbierta ? "Ocultar el pedido" : "Ver el pedido"}
            >
              {hojaAbierta ? <ChevronDown className="h-6 w-6" aria-hidden /> : <ChevronUp className="h-6 w-6" aria-hidden />}
              <span className="tabular-nums">{unidades}</span> art.
            </button>
            <div className="min-w-0 flex-1">{botonPagar("h-16 text-xl")}</div>
          </div>
        </div>
      )}
    </div>
  );
}
