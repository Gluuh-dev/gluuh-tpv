"use client";

import { useMemo } from "react";
import { assetPorId, dim, mesaPorCapacidad } from "../../lib/plano-assets";
import type { Mesa } from "../hooks/useTpvStore";

export interface EstadoMesaSimplificada {
  etiqueta: string;
  color: string;
  borde: string;
  texto: string;
}

export interface SeparacionPlanoSimplificada {
  id: string;
  tipo: string;
  icono: string | null;
  pos_x: number;
  pos_y: number;
  ancho: number;
  alto: number;
  rotacion: number;
}

interface Props {
  mesas: Mesa[];
  separaciones: SeparacionPlanoSimplificada[];
  zoom: number;
  mesaSeleccionadaId: string | null;
  estadoDe: (mesa: Mesa) => EstadoMesaSimplificada;
  onSeleccionar: (mesaId: string) => void;
}

function formaDe(mesa: Mesa): "cuadrada" | "redonda" | "rectangular" | "taburete" {
  const asset = (mesa.sprite ? assetPorId(mesa.sprite) : undefined) ?? mesaPorCapacidad(mesa.capacidad || 4);
  if (asset.file.includes("taburete")) return "taburete";
  if (asset.file.includes("redonda") || asset.file.includes("toldo")) return "redonda";
  if (asset.file.includes("hamaca") || mesa.capacidad > 4) return "rectangular";
  return "cuadrada";
}

function medidasDe(mesa: Mesa, forma: ReturnType<typeof formaDe>) {
  const asset = (mesa.sprite ? assetPorId(mesa.sprite) : undefined) ?? mesaPorCapacidad(mesa.capacidad || 4);
  const medidas = dim(asset);
  if (forma === "redonda") {
    const lado = Math.max(58, medidas.w, medidas.h);
    return { w: lado, h: lado };
  }
  if (forma === "taburete") return { w: Math.max(34, medidas.w), h: Math.max(34, medidas.h) };
  if (forma === "rectangular") return { w: Math.max(68, medidas.w), h: Math.max(48, medidas.h) };
  return { w: Math.max(48, medidas.w), h: Math.max(48, medidas.h) };
}

export function PlanoMesasSimplificado({ mesas, separaciones, zoom, mesaSeleccionadaId, estadoDe, onSeleccionar }: Readonly<Props>) {
  // El plano original puede tener taburetes con 20-30 px entre sí porque su SVG es
  // diminuto. En este selector las formas tienen mínimos táctiles: se conservan el
  // orden y la zona, pero se deja una separación visible entre piezas vecinas.
  const posiciones = useMemo(() => {
    const situadas: { id: string; x: number; y: number; w: number; h: number }[] = [];
    const resultado = new Map<string, { x: number; y: number }>();
    const ordenadas = [...mesas].sort((a, b) => (a.pos_y ?? 0) - (b.pos_y ?? 0) || (a.pos_x ?? 0) - (b.pos_x ?? 0));

    for (const mesa of ordenadas) {
      const forma = formaDe(mesa);
      const medidas = medidasDe(mesa, forma);
      let x = mesa.pos_x ?? (40 + (situadas.length % 5) * 130);
      let y = mesa.pos_y ?? (40 + Math.floor(situadas.length / 5) * 110);
      let intentos = 0;

      while (intentos < 32) {
        const choque = situadas.find((otra) => x < otra.x + otra.w + 8 && x + medidas.w + 8 > otra.x && y < otra.y + otra.h + 8 && y + medidas.h + 8 > otra.y);
        if (!choque) break;
        x = choque.x + choque.w + 8;
        if (x + medidas.w > 790) {
          x = mesa.pos_x ?? 40;
          y = choque.y + choque.h + 12;
        }
        intentos++;
      }

      situadas.push({ id: mesa.id, x, y, w: medidas.w, h: medidas.h });
      resultado.set(mesa.id, { x, y });
    }
    return resultado;
  }, [mesas]);

  return (
    <>
      {separaciones.filter((separacion) => (
        separacion.tipo === "BARRA" || separacion.tipo === "PARED" || separacion.tipo === "PUERTA" || /^(barra|muro|separador|puerta|entrada)/i.test(separacion.icono ?? "")
      )).map((separacion) => {
        return (
          <span
            key={separacion.id}
            aria-hidden
            className="pointer-events-none absolute rounded-sm border border-dashed border-[#cbd5e1] bg-transparent opacity-80"
            style={{
              left: separacion.pos_x * zoom,
              top: separacion.pos_y * zoom,
              width: separacion.ancho * zoom,
              height: separacion.alto * zoom,
              transform: separacion.rotacion ? `rotate(${separacion.rotacion}deg)` : undefined,
              transformOrigin: "center",
            }}
          />
        );
      })}
      {mesas.map((mesa, indice) => {
        const forma = formaDe(mesa);
        const medidas = medidasDe(mesa, forma);
        const estado = estadoDe(mesa);
        const posicion = posiciones.get(mesa.id);
        const x = (posicion?.x ?? (40 + (indice % 5) * 130)) * zoom;
        const y = (posicion?.y ?? (40 + Math.floor(indice / 5) * 110)) * zoom;
        const seleccionada = mesa.id === mesaSeleccionadaId;
        const redondeado = forma === "redonda" || forma === "taburete" ? "rounded-full" : "rounded-md";

        return (
          <button
            key={mesa.id}
            type="button"
            onClick={() => onSeleccionar(mesa.id)}
            aria-label={`${mesa.nombre}, ${estado.etiqueta}`}
            title={`${mesa.nombre} · ${estado.etiqueta}`}
            style={{
              left: x,
              top: y,
              width: medidas.w * zoom,
              height: medidas.h * zoom,
              backgroundColor: estado.color,
              color: estado.texto,
              borderColor: estado.borde,
              transform: mesa.rotacion ? `rotate(${mesa.rotacion}deg)` : undefined,
            }}
            className={`absolute flex items-center justify-center border-2 text-[11px] font-extrabold tabular-nums transition-transform ${redondeado} ${seleccionada ? "z-20 scale-[1.1]" : "hover:scale-[1.05]"}`}
          >
            <span style={{ transform: mesa.rotacion ? `rotate(${-mesa.rotacion}deg)` : undefined }}>{mesa.nombre.replace("Mesa ", "")}</span>
          </button>
        );
      })}
    </>
  );
}