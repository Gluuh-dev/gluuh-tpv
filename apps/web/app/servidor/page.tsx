"use client";

// PANEL DEL SERVIDOR — "abrirlo y ver qué lleva creado, cuánto ocupa, última actualización".
//
// Lo abre quien está delante del mini-PC de la barra, no el dueño desde casa: por eso
// vive fuera del panel y no pide login. Sólo enseña si los servicios están vivos y
// cuántas filas hay — ni una sola venta, ni un secreto.
//
// Si el nodo no contesta, esta pantalla tiene que decirlo GRANDE: es justo el momento en
// que alguien está mirando porque algo va mal.

import * as React from "react";

interface Estado {
  servicios: Record<string, boolean>;
  contenido: { productos: number; categorias: number; mesas: number; usuarios: number; pedidos: number; pedidosAbiertos: number };
  ocupa: { baseDatos: number; imagenes: number };
  sincronizacion: {
    imagenesPorSubir: number;
    ventasPorSubir: number;
    conError: number;
    ultimaSync: string | null;
    ultimaVenta: string | null;
  };
  ahora: string;
}

const NOMBRES: Record<string, string> = {
  datos: "Datos",
  auth: "Usuarios",
  realtime: "Avisos en vivo",
  imagenes: "Imágenes",
};

function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function cuando(iso: string | null): string {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString("es-ES");
}

export default function Servidor() {
  const [e, setE] = React.useState<Estado | null>(null);
  const [caido, setCaido] = React.useState(false);

  React.useEffect(() => {
    const pedir = async () => {
      try {
        const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/nodo/estado`, { cache: "no-store" });
        if (!r.ok) throw new Error();
        setE((await r.json()) as Estado);
        setCaido(false);
      } catch {
        setCaido(true);
      }
    };
    void pedir();
    const t = setInterval(pedir, 5000);
    return () => clearInterval(t);
  }, []);

  if (caido) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-8 text-center">
        <div>
          <p className="text-6xl">🔌</p>
          <h1 className="mt-4 text-3xl font-bold text-rose-400">El nodo no responde</h1>
          <p className="mt-2 text-zinc-400">
            El servidor de la barra está apagado o se ha caído. Los TPV no pueden cobrar.
          </p>
        </div>
      </main>
    );
  }

  if (!e) {
    return <main className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-500">Consultando el nodo…</main>;
  }

  const pendientes = e.sincronizacion.imagenesPorSubir + e.sincronizacion.ventasPorSubir;

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold">Servidor del local</h1>
          <p className="mt-1 text-zinc-400">Todo lo que el bar necesita para funcionar sin internet.</p>
        </header>

        {/* Servicios: lo primero que se mira cuando algo va mal */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(e.servicios).map(([k, ok]) => (
            <div key={k} className={`rounded-xl border p-4 ${ok ? "border-emerald-800 bg-emerald-950/40" : "border-rose-800 bg-rose-950/40"}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"}`} />
                <span className="text-sm font-medium">{NOMBRES[k] ?? k}</span>
              </div>
              <p className={`mt-1 text-xs ${ok ? "text-emerald-400" : "text-rose-400"}`}>
                {ok ? "funcionando" : "CAÍDO"}
              </p>
            </div>
          ))}
        </section>

        {/* Qué lleva creado */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Qué lleva creado</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Productos", e.contenido.productos],
              ["Categorías", e.contenido.categorias],
              ["Mesas", e.contenido.mesas],
              ["Empleados", e.contenido.usuarios],
              ["Pedidos", e.contenido.pedidos],
              ["Abiertos", e.contenido.pedidosAbiertos],
            ].map(([t, n]) => (
              <div key={t as string} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-2xl font-bold tabular-nums">{n as number}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{t as string}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cuánto ocupa y qué falta por poner a salvo */}
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500">Base de datos</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{tamano(e.ocupa.baseDatos)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500">Imágenes</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{tamano(e.ocupa.imagenes)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500">Última venta</p>
            <p className="mt-1 text-xl font-semibold">{cuando(e.sincronizacion.ultimaVenta)}</p>
          </div>
        </section>

        {/* La copia de seguridad. Lo que aún NO está en la nube sólo existe en este
            ordenador: si se muere ahora, se pierde. Es lo primero que hay que mirar. */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Copia en la nube</h2>
            <span className="text-xs text-zinc-500">
              última: {cuando(e.sincronizacion.ultimaSync)}
            </span>
          </div>

          {pendientes === 0 ? (
            <p className="mt-3 text-sm text-emerald-400">
              Todo lo del bar está a salvo en la nube.
            </p>
          ) : (
            <div className="mt-3 rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-200">
              <p>
                <strong>
                  {e.sincronizacion.ventasPorSubir > 0 && `${e.sincronizacion.ventasPorSubir} venta(s)`}
                  {e.sincronizacion.ventasPorSubir > 0 && e.sincronizacion.imagenesPorSubir > 0 && " y "}
                  {e.sincronizacion.imagenesPorSubir > 0 && `${e.sincronizacion.imagenesPorSubir} imagen(es)`}
                </strong>{" "}
                existen sólo en este ordenador.
              </p>
              <p className="mt-1 text-amber-300/70">
                Se subirán solas en cuanto haya internet. No hace falta hacer nada.
              </p>
            </div>
          )}

          {e.sincronizacion.conError > 0 && (
            <p className="mt-3 text-sm text-rose-400">
              {e.sincronizacion.conError} tabla(s) fallaron al subir. Avisa al soporte.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
