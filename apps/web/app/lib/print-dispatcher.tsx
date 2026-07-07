"use client";

// Despachador de impresión compartida (guía 15 §6, C3). SOLO en Gluuh Desktop:
// este equipo se suscribe a los print_job de SUS impresoras (las que tiene
// asignadas por device_id + las "cualquiera" = null) y los imprime con la cola
// local (window.gluuh.imprimir), marcando IMPRESO/ERROR. Un job se "reclama"
// atómicamente (estado ENCOLADO + intentos 0 → 1) para que, si hay varios
// equipos suscritos, solo uno lo imprima.
// ponytail: reclamo por `intentos` en vez de una columna claimed_by; suficiente
// contra doble impresión sin tocar el esquema.
import { useEffect } from "react";
import { supabaseBrowser } from "./supabaseBrowser";

interface Printer { id: string; transporte: string; destino: string | null; ancho: number; tipo: string; activa: boolean; device_id: string | null }
interface Job { id: string; printer_id: string; payload: { lineas?: string[]; cortar?: boolean; abrirCajon?: boolean; qr?: string } | null }

export function PrintDispatcher() {
  useEffect(() => {
    const g = typeof window !== "undefined" ? window.gluuh : undefined;
    const miDevice = g?.device?.id;
    if (!g || !miDevice) return; // solo en Desktop con dispositivo vinculado
    const sb = supabaseBrowser();
    let vivo = true;
    const impresoras = new Map<string, Printer>();

    // Imprime un job si su impresora es de este equipo; lo reclama antes.
    async function procesar(jobId: string, printerId: string) {
      const pr = impresoras.get(printerId);
      if (!pr || !pr.activa) return;
      // Reclamo atómico: solo el primero que pase ENCOLADO/intentos=0 → 1 gana.
      const { data: reclamado } = await sb.from("print_job")
        .update({ intentos: 1, updated_at: new Date().toISOString() })
        .eq("id", jobId).eq("estado", "ENCOLADO").eq("intentos", 0)
        .select("id,printer_id,payload").maybeSingle();
      if (!reclamado) return;
      const job = reclamado as Job;
      const impresora = pr.transporte === "RED" && pr.destino
        ? { uri: pr.destino, tipo: pr.tipo as "EPSON" | "STAR", ancho: pr.ancho }
        : undefined;
      let ok = false; let error: string | null = null;
      try {
        const res = await g!.imprimir({ ...job.payload, lineas: job.payload?.lineas ?? [], impresora });
        ok = res.ok; error = res.error ?? null;
      } catch (e) { error = e instanceof Error ? e.message : String(e); }
      if (!vivo) return;
      await sb.from("print_job")
        .update({ estado: ok ? "IMPRESO" : "ERROR", error, updated_at: new Date().toISOString() })
        .eq("id", job.id);
    }

    (async () => {
      // Impresoras que despacha este equipo (asignadas a él o "cualquiera").
      const { data } = await sb.from("printer")
        .select("id,transporte,destino,ancho,tipo,activa,device_id")
        .or(`device_id.eq.${miDevice},device_id.is.null`);
      for (const p of (data as Printer[] | null) ?? []) impresoras.set(p.id, p);
      if (!impresoras.size || !vivo) return;

      // Drena lo que quedó pendiente mientras el equipo estaba apagado.
      const { data: pend } = await sb.from("print_job")
        .select("id,printer_id").eq("estado", "ENCOLADO").eq("intentos", 0)
        .in("printer_id", [...impresoras.keys()]);
      for (const j of (pend as { id: string; printer_id: string }[] | null) ?? []) await procesar(j.id, j.printer_id);
    })();

    // Heartbeat: marca este equipo "en línea" para el panel de dispositivos (D1).
    const latir = () => { void sb.rpc("device_heartbeat", { p_device: miDevice, p_version: g!.version ?? null }); };
    latir();
    const heartbeat = setInterval(latir, 60_000);

    // Nuevos trabajos en tiempo real.
    const canal = sb.channel("print_job_dispatch")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "print_job" }, (payload) => {
        const j = payload.new as { id: string; printer_id: string; estado: string };
        if (j.estado === "ENCOLADO") void procesar(j.id, j.printer_id);
      })
      .subscribe();

    return () => { vivo = false; clearInterval(heartbeat); void sb.removeChannel(canal); };
  }, []);

  return null;
}
