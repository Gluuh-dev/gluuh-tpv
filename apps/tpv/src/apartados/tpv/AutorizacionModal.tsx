import { ShieldCheck } from "lucide-react";
import { CredencialModal } from "../acceso/CredencialModal";
import { cumpleRol, type Rol } from "../../lib/nav";
import type { Usuario } from "../acceso/tipos";
import { ACCIONES, type Accion } from "./permisos";

// AUTORIZACIÓN DE UN RESPONSABLE. Cuando el operario activo intenta algo que su
// perfil no permite (un descuento, anular una línea), no se le bloquea a secas:
// un encargado mete su PIN y la acción sale adelante — atribuida a QUIEN autoriza,
// no al operario (eso lo sella el llamador). El operario activo NO cambia: el
// responsable pasa, autoriza y se va; sigue operando el mismo camarero.
//
// Reusa la puerta de credencial (ya valida PIN + rol y pone candado a quien no
// llega): aquí la puerta exige rol de administrador.
export function AutorizacionModal({
  accion, usuarios, demo, onConcedido, onCancelar, validarPin,
}: Readonly<{
  accion: Accion;
  usuarios: Usuario[];
  demo?: boolean;
  /** El responsable autorizó: entra su identidad para atribuirle la acción. */
  onConcedido: (autorizador: Usuario) => void;
  onCancelar: () => void;
  validarPin?: (pin: string) => Promise<Usuario | null>;
}>) {
  const etiqueta = ACCIONES.find((a) => a.clave === accion)?.etiqueta ?? accion;

  async function validar(pin: string, ctx: { usuario?: Usuario; requiere: Rol }): Promise<boolean> {
    // En demo hay que ELEGIR al responsable (su cara) y meter un PIN de 4: sin
    // validación real, es la única forma de exigir que autorice un admin.
    if (demo) return !!ctx.usuario && ctx.usuario.rol === "admin" && pin.length === 4;
    const op = validarPin ? await validarPin(pin) : null;
    return !!op && cumpleRol(op.rol, ctx.requiere) && (!ctx.usuario || ctx.usuario.id === op.id);
  }

  return (
    <CredencialModal
      titulo={etiqueta}
      Icono={ShieldCheck}
      color="var(--brand)"
      requiere="admin"
      modo="pasos"
      usuarios={usuarios}
      demo={demo}
      onValidar={validar}
      onOk={(u) => { if (u) onConcedido(u); }}
      onCancelar={onCancelar}
    />
  );
}
