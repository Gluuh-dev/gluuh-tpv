"use client";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface UseTPVKeyboardProps {
  sb: SupabaseClient;
  operario: { id: string; nombre: string } | null;
  bloqueado: boolean;
  loginOperario: (u: { id: string; nombre: string }) => void;
}

/**
 * Hook para abstraer la captura de eventos de teclado físico en el TPV.
 * 
 * Principalmente:
 * - Login por PULSERA RFID (escáner emula pulsaciones rápidas y termina con Enter).
 * - Ignora atajos y lecturas si el usuario está escribiendo en campos de formulario.
 */
export function useTPVKeyboard({
  sb,
  operario,
  bloqueado,
  loginOperario,
}: UseTPVKeyboardProps) {
  useEffect(() => {
    // Solo activo si no hay operario en sesión O si la pantalla está bloqueada (velo puesto).
    if (operario && !bloqueado) return;

    let buffer = "";
    let ultimo = 0;

    const onKey = async (e: KeyboardEvent) => {
      // Evitar capturar si se está escribiendo en un input, textarea o select.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      ) {
        return;
      }

      const ahora = Date.now();
      
      // Si pasa más de 300 ms entre pulsaciones, consideramos que no es un escaneo RFID
      // sino tipeo manual lento de un usuario, por lo que limpiamos el buffer.
      if (ahora - ultimo > 300) {
        buffer = "";
      }
      ultimo = ahora;

      if (e.key === "Enter") {
        const codigo = buffer;
        buffer = "";
        if (codigo.length < 4) return;

        try {
          const { data, error } = await sb.rpc("validar_pulsera", {
            p_codigo: codigo,
          });
          const u = (data as { id: string; nombre: string }[] | null)?.[0];
          if (u && !error) {
            loginOperario(u);
          }
        } catch (err) {
          // Silent catch to prevent UI crash during keyboard swipe
        }
        return;
      }

      // Concatenar caracteres de 1 solo byte (evitar Shift, Ctrl, Alt, etc.)
      if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sb, operario, bloqueado, loginOperario]);
}
