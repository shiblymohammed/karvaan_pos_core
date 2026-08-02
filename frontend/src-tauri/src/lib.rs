// use tauri::Manager;

// ─── Thermal Printer Commands ─────────────────────────────────────────────────

/// List available serial ports (USB/COM ports for receipt printers)
#[tauri::command]
fn list_serial_ports() -> Vec<String> {
    match serialport::available_ports() {
        Ok(ports) => ports.into_iter().map(|p| p.port_name).collect(),
        Err(_) => vec![],
    }
}

/// Send raw ESC/POS bytes to a thermal receipt printer via serial port.
/// The frontend constructs the ESC/POS byte sequence and passes it here.
///
/// # Arguments
/// * `port_name` - COM port name e.g. "COM3" or "/dev/ttyUSB0"
/// * `data` - Raw bytes as array of u8 values (ESC/POS commands)
#[tauri::command]
fn print_receipt(port_name: String, data: Vec<u8>) -> Result<String, String> {
    use std::io::Write;

    let mut port = serialport::new(&port_name, 9600)
        .timeout(std::time::Duration::from_secs(3))
        .open()
        .map_err(|e| format!("Failed to open port {}: {}", port_name, e))?;

    port.write_all(&data)
        .map_err(|e| format!("Failed to write to printer: {}", e))?;

    port.flush()
        .map_err(|e| format!("Failed to flush printer buffer: {}", e))?;

    Ok(format!("Receipt sent to {} ({} bytes)", port_name, data.len()))
}

/// Trigger cash drawer via serial port.
/// Most cash drawers use a CD (cash drawer) kick pulse byte sequence.
/// Standard: ESC p 0 25 250 (0x1B 0x70 0x00 0x19 0xFA)
#[tauri::command]
fn kick_cash_drawer(port_name: String) -> Result<String, String> {
    use std::io::Write;

    // ESC p — Cash drawer kick pulse command (standard for most drawers)
    let kick_pulse: Vec<u8> = vec![0x1B, 0x70, 0x00, 0x19, 0xFA];

    let mut port = serialport::new(&port_name, 9600)
        .timeout(std::time::Duration::from_secs(2))
        .open()
        .map_err(|e| format!("Failed to open cash drawer port {}: {}", port_name, e))?;

    port.write_all(&kick_pulse)
        .map_err(|e| format!("Failed to trigger cash drawer: {}", e))?;

    Ok(format!("Cash drawer triggered on {}", port_name))
}

// ─── System Info Commands ─────────────────────────────────────────────────────

/// Get the application version from Cargo.toml
#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Check if the app is running in Tauri (desktop) vs browser
#[tauri::command]
fn is_tauri_app() -> bool {
    true
}

// ─── App Entry Point ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ── Plugins ──────────────────────────────────────────────────────────
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .build(),
        )
        // ── Custom Commands ───────────────────────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            list_serial_ports,
            print_receipt,
            kick_cash_drawer,
            get_app_version,
            is_tauri_app,
        ])
        // ── Setup ─────────────────────────────────────────────────────────────
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                // Open DevTools in development mode
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Karvaan POS application");
}
