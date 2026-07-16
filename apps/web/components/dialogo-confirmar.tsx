"use client";

// Diálogo de confirmación REUTILIZABLE (eliminar/cancelar/…). Dos formas de usarlo:
//
//  1) Declarativo:  <DialogoConfirmar abierto={x} titulo=… onConfirmar=… onCancelar=… />
//  2) Con promesa (reemplaza al confirm() del navegador):
//        const { confirmar, dialogo } = useConfirmar();
//        ...render... {dialogo}
//        if (!(await confirmar({ titulo:"¿Borrar?", peligroso:true }))) return;
//
// Sigue el tema (claro/oscuro) por tokens. z alto para salir por encima de cualquier modal.
import { useCallback, useRef, useState, type ReactNode } from "react";

export interface OpcionesConfirmar {
  titulo?: string;
  mensaje?: ReactNode;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Acción destructiva → botón rojo. */
  peligroso?: boolean;
}

export function DialogoConfirmar({
  titulo = "¿Seguro?", mensaje, textoConfirmar = "Confirmar", textoCancelar = "Cancelar", peligroso = false,
  onConfirmar, onCancelar,
}: Readonly<OpcionesConfirmar & { onConfirmar: () => void; onCancelar: () => void }>) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4" onClick={onCancelar} role="presentation">
      <div className="w-full max-w-xs rounded-xl border border-border bg-card p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className="mb-1 text-base font-semibold text-foreground">{titulo}</h3>
        {mensaje && <div className="mb-4 text-sm text-muted-foreground">{mensaje}</div>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancelar}
            className="h-11 flex-1 rounded-md border border-border bg-background text-sm font-semibold text-foreground hover:bg-accent">{textoCancelar}</button>
          <button type="button" onClick={onConfirmar}
            className={`h-11 flex-1 rounded-md text-sm font-bold text-white ${peligroso ? "bg-rose-600 hover:bg-rose-700" : "bg-brand hover:bg-brand-hover"}`}>{textoConfirmar}</button>
        </div>
      </div>
    </div>
  );
}

/** Hook para confirmar con promesa (sustituye a window.confirm). Devuelve `confirmar()` y el
 *  `dialogo` que hay que renderizar en el componente. */
export function useConfirmar() {
  const [op, setOp] = useState<OpcionesConfirmar | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirmar = useCallback((o: OpcionesConfirmar = {}) =>
    new Promise<boolean>((res) => { resolver.current = res; setOp(o); }), []);

  const responder = useCallback((v: boolean) => {
    setOp(null);
    resolver.current?.(v);
    resolver.current = null;
  }, []);

  const dialogo = op ? (
    <DialogoConfirmar {...op} onConfirmar={() => responder(true)} onCancelar={() => responder(false)} />
  ) : null;

  return { confirmar, dialogo };
}
