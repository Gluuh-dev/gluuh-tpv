// Kit de UI reutilizable de la operativa (design system del TPV).
// Import limpio: `import { Modal, Escudo, TecladoNumerico } from "../../ui"`.
export { Modal } from "./Modal";
export { CabeceraModal } from "./CabeceraModal";
export { BarraVentana } from "./BarraVentana";
export { Flechas, Desplazable } from "./Flechas";
export { Select, type OpcionSelect } from "./Select";
export { CampoTexto } from "./CampoTexto";
export { Escudo } from "./Escudo";
export { Fkey } from "./Fkey";
export { Chip } from "./Chip";
export { Marca } from "./Marca";
export { TecladoNumerico } from "./TecladoNumerico";
export { TecladoEnPantalla, abrirTeclado, getTecladoAuto, setTecladoAuto } from "./TecladoEnPantalla";
export { EnObras } from "./EnObras";
export { MarcoApartado } from "./MarcoApartado";
export { BarraInforme } from "./BarraInforme";
export { descargarCSV, imprimirInforme, type ColumnaInforme } from "../lib/exportar";
// Lenguaje de los apartados de GESTIÓN (Análisis, Administrador, Visor Node).
export {
  ShellApartado, PlacaMarca, Boton, Tarjeta, Campo, Segmento,
  R, RC, TH, TD, type SeccionShell, type GrupoShell,
} from "./ShellApartado";
