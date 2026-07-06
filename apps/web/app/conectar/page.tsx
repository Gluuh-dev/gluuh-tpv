"use client";

// Emparejado de dispositivos: teclea el código de 6 dígitos generado en el
// backoffice (Dispositivos) y esta pantalla queda vinculada al local.
// En Gluuh Desktop la credencial se guarda en el equipo; en navegador, en
// localStorage. Diseño: docs/implementacion/04-modulos-y-emparejado.md.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RUTA_MODULO } from "../lib/modulos";

export default function Conectar() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function tecla(d: string) {
    setError("");
    if (d === "C") return setCodigo("");
    if (d === "<") return setCodigo((c) => c.slice(0, -1));
    setCodigo((c) => (c + d).slice(0, 6));
  }

  async function canjear() {
    if (codigo.length !== 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/dispositivos/canjear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(j.error ?? "No se pudo vincular");
        return;
      }
      const cred = { device_id: j.device_id, nombre: j.nombre, modulo: j.modulo, token: j.token };
      const destino = RUTA_MODULO[j.modulo] ?? "/tpv";
      if (window.gluuh) {
        await window.gluuh.guardarDispositivo(cred);
        // Recarga COMPLETA (no SPA): el preload de Electron vuelve a ejecutarse y
        // window.gluuh.device pasa a reflejar el terminal recién vinculado.
        window.location.assign(destino);
      } else {
        localStorage.setItem("gluuh_device", JSON.stringify(cred));
        router.replace(destino);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background text-foreground p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold">Conectar esta pantalla</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Genera un código en el backoffice (Dispositivos) y tecléalo aquí.
        </p>

        <div className="mt-6 flex justify-center gap-2" aria-label="Código">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="grid h-14 w-11 place-items-center rounded-md border border-border bg-card text-2xl font-bold tabular-nums"
            >
              {codigo[i] ?? ""}
            </div>
          ))}
        </div>
        {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}

        <div className="mx-auto mt-6 grid max-w-60 grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => tecla(d)}
              className="h-14 rounded-md border border-border bg-card text-xl font-semibold hover:bg-accent"
            >
              {d}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={canjear}
          disabled={codigo.length !== 6 || busy}
          className="btn-primary mt-6 w-full py-3 text-base disabled:opacity-50"
        >
          {busy ? "Vinculando…" : "Vincular"}
        </button>
      </div>
    </div>
  );
}
