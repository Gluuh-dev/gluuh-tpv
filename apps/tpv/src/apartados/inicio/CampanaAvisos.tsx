import { useEffect, useState } from "react";
import { Bell, TriangleAlert, Info, CircleAlert, Check } from "lucide-react";
import { cargarAvisos, type Aviso, type TonoAviso } from "./avisos";

// ────────────────────────────────────────────────────────────────────────────
// CAMPANA DE AVISOS — el icono en la barra superior + un POPUP que cuelga de él.
//
// Popup, no panel lateral ni modal: no tapa la pantalla, se abre pegado a la
// campana y se cierra al pulsar fuera. El icono lleva un punto con el número de
// avisos SIN LEER; lo leído se recuerda (localStorage), así que un aviso que ya
// viste no vuelve a marcar el punto al recargar — pero SIGUE en la lista
// mientras la causa exista (el stock sigue bajo).
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

  // `relative` para colgar el popup del propio botón. Al pulsar fuera se cierra:
  // un click en cualquier sitio que no sea el popup ni la campana.
  return (
    <div className="relative">
      <button type="button" onClick={() => (abierto ? setAbierto(false) : abrir())}
        aria-label={sinLeer ? `Avisos (${sinLeer} sin leer)` : "Avisos"} aria-expanded={abierto}
        className="relative grid h-10.5 w-10.5 place-items-center rounded-full border border-line bg-paper/5 text-paper/80 transition-transform active:scale-90">
        <Bell size={17} />
        {sinLeer > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {sinLeer > 9 ? "9+" : sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <>
          {/* Capa invisible para cerrar al pulsar fuera. Sin velo oscuro: es un
              popup, no un modal — no debe tapar la pantalla. */}
          <button type="button" aria-label="Cerrar avisos" tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default" onClick={() => setAbierto(false)} />
          <div role="group" aria-label="Avisos"
            className="gl-aparecer absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[70vh] w-[min(340px,86vw)] origin-top-right flex-col overflow-hidden rounded-[12px] border border-line bg-panel shadow-2xl">
            {/* Piquito hacia la campana, para que se lea «esto cuelga de ahí». */}
            <span className="absolute -top-1.5 right-3.5 h-3 w-3 rotate-45 border-l border-t border-line bg-panel" />
            <header className="flex flex-none items-center gap-2 border-b border-line px-3.5 py-2.5">
              <Bell size={15} className="text-brand-lit" />
              <h2 className="mr-auto text-[13px] font-semibold text-paper">Avisos</h2>
              {avisos.length > 0 && <span className="text-[11.5px] text-muted">{avisos.length}</span>}
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto p-2">
              {avisos.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 px-4 py-7 text-center">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-mint/10 text-mint">
                    <Check size={19} />
                  </span>
                  <p className="text-[12.5px] font-semibold text-paper">Todo en orden</p>
                  <p className="text-[11.5px] leading-snug text-muted">Nada que requiera tu atención.</p>
                </div>
              ) : (
                avisos.map((a) => {
                  const e = ESTILO[a.tono];
                  return (
                    <div key={a.id} className={`flex items-start gap-2.5 rounded-[8px] border p-2.5 ${e.clase}`}>
                      <e.Icono size={16} className="mt-px flex-none" />
                      <div className="min-w-0">
                        <b className="block text-[12.5px] font-semibold text-paper">{a.titulo}</b>
                        <span className="block text-[11.5px] leading-snug text-muted">{a.detalle}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
