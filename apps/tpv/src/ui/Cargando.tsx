import { useEffect, useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// PANTALLA DE CARGA — para el hueco mientras baja el código de un apartado.
//
// La clave es que NO PARPADEA: aparece con un retardo (por defecto 160 ms), así
// que una carga rápida (lo normal) no la llega a mostrar y no se ve un flash de
// «Cargando» de un suspiro. Solo sale si de verdad tarda —un mini-PC de bar el
// primer día, la red fría—, que es justo cuando el blanco molestaba.
//
// Ocupa el fondo del apartado (no es un modal): un modal para 80 ms parpadea más
// que el propio hueco.
// ────────────────────────────────────────────────────────────────────────────

export function Cargando({ etiqueta, retardoMs = 160 }: Readonly<{
  /** Qué se está abriendo: «Configuración», «Análisis»… */
  etiqueta?: string;
  retardoMs?: number;
}>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), retardoMs);
    return () => clearTimeout(t);
  }, [retardoMs]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      {visible && (
        <div className="gl-aparecer flex flex-col items-center gap-4">
          {/* Aro que gira: el hueco del aro es transparente y el resto es la
              marca, así el spinner se recolorea solo con `--brand`. */}
          <span
            className="h-11 w-11 animate-spin rounded-full border-[3px] border-brand/25 border-t-brand"
            role="status" aria-label="Cargando"
          />
          <p className="text-[13.5px] font-medium text-muted">
            {etiqueta ? `Abriendo ${etiqueta}…` : "Cargando…"}
          </p>
        </div>
      )}
    </div>
  );
}
