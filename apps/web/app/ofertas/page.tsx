"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { textoSobre } from "../lib/branding";

interface Offer {
  id: string; titulo: string; descripcion: string | null; precio: string | null;
  media_tipo: "EMOJI" | "IMAGEN" | "VIDEO"; media_url: string | null; emoji: string | null; color: string;
}

/**
 * Cartelería digital (digital signage). Autenticada: rota SOLO las ofertas de la
 * empresa de la sesión. Soporta emoji, imagen o vídeo a pantalla completa.
 */
export default function Ofertas() {
  const sb = supabaseBrowser();
  const [estado, setEstado] = useState<"cargando" | "sin-sesion" | "vacio" | "ok">("cargando");
  const [ofertas, setOfertas] = useState<Offer[]>([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setEstado("sin-sesion"); return; }
      const { data } = await sb.from("offer").select("id,titulo,descripcion,precio,media_tipo,media_url,emoji,color").eq("activa", true).order("orden");
      const list = (data as Offer[]) ?? [];
      setOfertas(list);
      setEstado(list.length ? "ok" : "vacio");
    })();
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => {
    if (ofertas.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % ofertas.length), 6000);
    return () => clearInterval(t);
  }, [ofertas.length]);

  if (estado === "cargando") return (
    <div className="dark grid min-h-screen place-items-center bg-background text-muted-foreground">
      Cargando…
    </div>
  );
  if (estado === "sin-sesion") return (
    <div className="dark grid min-h-screen place-items-center bg-background p-6 text-center text-foreground">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cartelería sin configurar</h1>
        <p className="mt-2 text-muted-foreground">Inicia sesión con la cuenta del restaurante.</p>
        <a href="/login" className="mt-5 inline-block rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground">
          Iniciar sesión
        </a>
      </div>
    </div>
  );
  if (estado === "vacio") return (
    <div className="dark grid min-h-screen place-items-center bg-background p-6 text-center text-foreground">
      <div>
        <div className="text-6xl">🖼️</div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sin ofertas todavía</h1>
        <p className="mt-2 text-muted-foreground">Crea ofertas en Panel → Personalización.</p>
        <a href="/personalizar" className="mt-5 inline-block rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground">
          Crear ofertas
        </a>
      </div>
    </div>
  );

  const o = ofertas[i]!;
  /* o.color: color de la oferta del tenant (dato dinámico, no paleta fija) */
  const fg = textoSobre(o.color);
  return (
    <main
      className="relative grid min-h-screen place-items-center overflow-hidden"
      style={{ background: o.color, color: fg, transition: "background .6s" }}
    >
      {o.media_tipo === "VIDEO" && o.media_url && (
        <video key={o.id} src={o.media_url} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
      )}
      {o.media_tipo === "IMAGEN" && o.media_url && (
        <img key={o.id} src={o.media_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {o.media_tipo !== "EMOJI" && o.media_url && <div className="absolute inset-0 bg-foreground/35" />}

      <div className="relative z-10 px-6 text-center">
        {o.media_tipo === "EMOJI" && <div style={{ fontSize: 140 }}>{o.emoji || "🍔"}</div>}
        <h1 className="text-6xl font-black drop-shadow sm:text-7xl">{o.titulo}</h1>
        {o.descripcion && <p className="mt-3 text-2xl drop-shadow sm:text-3xl">{o.descripcion}</p>}
        {o.precio && (
          <div className="mt-6 inline-block rounded-lg bg-background/95 px-8 py-3 text-5xl font-black tabular-nums text-foreground shadow-sm">
            {o.precio}
          </div>
        )}
      </div>

      {ofertas.length > 1 && (
        <div className="absolute bottom-8 z-10 flex gap-3">
          {ofertas.map((_, k) => (
            <span key={k} className="h-3 w-3 rounded-full bg-foreground" style={{ opacity: k === i ? 1 : 0.4 }} />
          ))}
        </div>
      )}
    </main>
  );
}
