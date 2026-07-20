import type { Usuario } from "./tipos";

// Equipo de EJEMPLO del terminal sin emparejar. Compartido por la puerta de
// apartados (App) y por el velo del TPV, para que los dos enseñen la misma gente
// y no diverja una copia. Va SIEMPRE marcado como demo en la pantalla: nada de
// datos fingidos como reales.
export const EQUIPO_DEMO: Usuario[] = [
  { id: "1", nombre: "María Ruiz", rol: "admin" },
  { id: "2", nombre: "Berto Sanz", rol: "operario" },
  { id: "3", nombre: "Lucía Gil", rol: "operario" },
  { id: "4", nombre: "Soporte Gluuh", rol: "tecnico", color: "linear-gradient(150deg,#54E3B1,#159C6E)" },
];
