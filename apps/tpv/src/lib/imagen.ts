/**
 * Medida final de una foto que se reduce para caber en `maxLado`.
 *
 * `Math.min(1, …)`: una foto que ya es pequeña se deja como está. Si se
 * escalara sin tope, un icono de 64px se estiraría a 320 y saldría borroso.
 */
export function medidaReducida(ancho: number, alto: number, maxLado: number) {
  const escala = Math.min(1, maxLado / Math.max(ancho, alto));
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

/**
 * Reduce una foto de artículo a un data URL pequeño.
 *
 * Por qué reducir: el tile del TPV mide ~120px y la foto llega del móvil del
 * dueño con 4000px y 5 MB. Sin reducir, la carta entera se arrastra por la LAN
 * del bar cada vez que arranca un terminal.
 *
 * JPEG a propósito: la foto va a pantalla completa dentro del tile (`object-fit:
 * cover`), así que la transparencia no pinta nada y pesa la mitad que un PNG.
 *
 * ponytail: devuelve data URL porque hoy la ficha vive en memoria. Cuando se
 * cablee al nodo, esto pasa a `subirMedia()` — la reducción sigue valiendo igual.
 */
export async function fotoReducida(file: File, maxLado = 320): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const { ancho, alto } = medidaReducida(bitmap.width, bitmap.height, maxLado);

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) throw new Error("El navegador no ha dado lienzo para reducir la foto");
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    return lienzo.toDataURL("image/jpeg", 0.82);
  } finally {
    bitmap.close();
  }
}
