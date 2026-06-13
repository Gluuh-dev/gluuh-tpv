// Servio TPV — núcleo de escritorio (Tauri 2.0).
// La capa Rust es la responsable del hardware local: impresora ESC/POS, cajón
// portamonedas y datáfono. Ver docs/10-comanderas-kds-e-impresion.md §3.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Comando de impresión (esqueleto).
///
/// En la implementación real, aquí se envían los bytes ESC/POS a la impresora
/// (USB / serie / red) usando crates como `serialport` o un plugin ESC/POS, y se
/// abre el cajón con la secuencia `ESC p`. Por ahora solo registra el trabajo.
#[tauri::command]
fn imprimir_ticket(contenido: String) -> Result<String, String> {
    println!("[impresion] {} bytes recibidos para imprimir", contenido.len());
    // TODO: serializar a ESC/POS, enviar a la impresora y disparar el cajón.
    Ok("impreso (simulado)".to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![imprimir_ticket])
        .run(tauri::generate_context!())
        .expect("error al arrancar la aplicación Servio TPV");
}
