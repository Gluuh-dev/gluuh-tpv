import { useEffect, type ReactNode } from "react";
import { Phone, MessageCircle, Mail, MonitorUp, FileText } from "lucide-react";

// Modal de "Ayuda y soporte técnico" (del diseño gluuh-inicio-diseño.html):
// vías de contacto directas para cuando el bar está parado. Los datos concretos
// (teléfono, licencia, terminal) se cablean a la config del nodo después.
function Fila({
  icono, titulo, sub, tag, href, onClick,
}: Readonly<{ icono: ReactNode; titulo: string; sub: string; tag: string; href?: string; onClick?: () => void }>) {
  const contenido = (
    <>
      <span className="grid h-9.5 w-9.5 flex-none place-items-center rounded-xl bg-paper/[.07] text-paper/85">{icono}</span>
      <span className="min-w-0">
        <b className="block text-[14.5px] font-semibold">{titulo}</b>
        <small className="text-[12.5px] text-muted">{sub}</small>
      </span>
      <span className="ml-auto font-mono text-[11px] text-muted">{tag}</span>
    </>
  );
  const clase = "flex w-full items-center gap-3.5 rounded-2xl border border-line bg-paper/[.045] px-4 py-3.5 text-left transition-transform active:scale-[.98] active:bg-paper/[.09]";
  return href
    ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener" className={clase}>{contenido}</a>
    : <button type="button" onClick={onClick} className={clase}>{contenido}</button>;
}

export function AyudaModal({ licencia, terminal, version, onCerrar }: Readonly<{ licencia: string; terminal: string; version: string; onCerrar: () => void }>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a040e]/75 p-4 backdrop-blur-md" onClick={onCerrar}>
      <div className="w-full max-w-[560px] rounded-3xl border border-line bg-linear-165 from-panel to-ink-2 p-8 text-paper shadow-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-2xl font-bold tracking-tight">Hablar con el servicio técnico</h3>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-muted">Estamos de 8:00 a 00:00, todos los días del año. Si el local está parado, llama: es la vía más rápida.</p>

        <div className="flex flex-col gap-2.5">
          <Fila icono={<Phone size={19} />} titulo="900 123 456" sub="Teléfono de urgencias · caja parada, impresoras, cobros" tag="Llamar" href="tel:+34900123456" />
          <Fila icono={<MessageCircle size={19} />} titulo="WhatsApp 600 123 456" sub="Dudas del día a día, fotos del error, capturas" tag="Escribir" href="https://wa.me/34600123456" />
          <Fila icono={<Mail size={19} />} titulo="soporte@gluuh.com" sub="Respondemos en menos de 4 horas laborables" tag="Enviar" href={`mailto:soporte@gluuh.com?subject=Soporte%20TPV%20-%20${licencia}`} />
          <Fila icono={<MonitorUp size={19} />} titulo="Dar control remoto de este terminal" sub="Un técnico ve tu pantalla contigo. Puedes cortar cuando quieras." tag="Abrir" onClick={onCerrar} />
          <Fila icono={<FileText size={19} />} titulo="Crear informe de diagnóstico" sub="Guarda un archivo con los registros para adjuntarlo" tag="Generar" onClick={onCerrar} />
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-dashed border-paper/20 px-4 py-3.5 font-mono text-[12.5px] text-muted">
          <span>Da estos datos al técnico:</span>
          <b className="tracking-wider text-paper">{licencia} · {terminal} · {version}</b>
        </div>

        <button type="button" onClick={onCerrar} className="btn-ghost mt-5 w-full">Cerrar</button>
      </div>
    </div>
  );
}
