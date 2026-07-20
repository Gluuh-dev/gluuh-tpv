import { useEffect, useState } from "react";
import { Bell, X, TriangleAlert, Info, CircleAlert, Check } from "lucide-react";
import { cargarAvisos, type Aviso, type TonoAviso } from "./avisos";

// ────────────────────────────────────────────────────────────────────────────
// CAMPANA DE AVISOS — el icono en la barra superior + el panel lateral.
//
// El icono lleva un punto con el número de avisos SIN LEER; al pulsarlo, un
// panel entra por la derecha con la lista. Lo leído se recuerda (localStorage),
// así que un aviso que ya viste no vuelve a marcar el punto al recargar — pero
// SIGUE en la lista mientras la causa exista (el stock sigue bajo).
// ────────────────────────────────────────────────────────────────────────────

const ESTILO: Record<TonoAviso, { Icono: typeof Info; clase: string; punto: string }> = {
  urgente: { Icono: CircleAlert, clase: "border-danger/40 bg-danger/8 text-danger", punto: "bg-danger" },
  aviso: { Icono: TriangleAlert, clase: "border-amber/40 bg-amber/8 text-amber", punto: "bg-amber" },
  info: { Icono: Info, clase: "border-line bg-panel-2 text-muted", punto: "bg-muted" },
};

const CLAVE_LEIDOS = "gluuh_avisos_leidos";
const leerLeidos = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(CLAVE_LEIDOS) ?? "[]") as string[]); }
  catch { return new Set(); }
};

export function CampanaAvisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [leidos, setLeidos] = useState<Set<string>>(leerLeidos);

  useEffect(() => {
    let vivo = true;
    const cargar = () => { cargarAvisos().then((a) => { if (vivo) setAvisos(a); }); };
    cargar();
    // Se refresca cada par de minutos: el stock se mueve con las ventas, y un
    // aviso viejo que ya no aplica (repusieron) tiene que desaparecer solo.
    const t = setInterval(cargar, 120_000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const sinLeer = avisos.filter((a) => !leidos.has(a.id)).length;

  const abrir = () => {
    setAbierto(true);
    // Abrir el panel es haberlos visto: se marcan leídos los que hay ahora.
    const nuevos = new Set(leidos);
    for (const a of avisos) nuevos.add(a.id);
    setLeidos(nuevos);
    try { localStorage.setItem(CLAVE_LEIDOS, JSON.stringify([...nuevos])); } catch { /* noop */ }
  };

  return (
    <>
      <button type="button" onClick={abrir} aria-label={`Avisos${sinLeer ? ` (${sinLeer} sin leer)` : ""}`}
        className="relative grid h-10.5 w-10.5 place-items-center rounded-full border border-line bg-paper/5 text-paper/80 transition-transform active:scale-90">
        <Bell size={17} />
        {sinLeer > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {sinLeer > 9 ? "9+" : sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50">
          {/* Velo hermano del panel (no lo envuelve): botón dentro de botón es
              HTML inválido, la lección de los modales. */}
          <button type="button" aria-label="Cerrar avisos" tabIndex={-1}
            className="gl-velo absolute inset-0 cursor-default bg-black/25 backdrop-blur-[1.5px]"
            onClick={() => setAbierto(false)} />
          <aside className="gl-panel-derecha absolute inset-y-0 right-0 flex w-[min(400px,90vw)] flex-col border-l border-line bg-panel shadow-2xl">
            <header className="flex flex-none items-center gap-2 border-b border-line bg-brand px-4 py-3 text-white">
              <Bell size={17} />
              <h2 className="mr-auto text-[14px] font-semibold">Avisos</h2>
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar"
                className="grid h-8 w-8 place-items-center rounded-[5px] text-white/90 transition-transform active:scale-90">
                <X size={17} />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3">
              {avisos.length === 0 ? (
                <div className="grid flex-1 place-items-center p-8 text-center">
                  <div>
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-mint/10 text-mint">
                      <Check size={22} />
                    </span>
                    <p className="mt-3 text-[13.5px] font-semibold text-paper">Todo en orden</p>
                    <p className="mt-1 text-[12.5px] leading-snug text-muted">No hay nada que requiera tu atención.</p>
                  </div>
                </div>
              ) : (
                avisos.map((a) => {
                  const e = ESTILO[a.tono];
                  return (
                    <div key={a.id} className={`flex items-start gap-3 rounded-[8px] border p-3 ${e.clase}`}>
                      <e.Icono size={18} className="mt-px flex-none" />
                      <div className="min-w-0">
                        <b className="block text-[13.5px] font-semibold text-paper">{a.titulo}</b>
                        <span className="block text-[12.5px] leading-snug text-muted">{a.detalle}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
