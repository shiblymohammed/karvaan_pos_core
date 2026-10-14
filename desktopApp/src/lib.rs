use tauri::Manager;
use std::sync::Mutex;
struct BackendChild(Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

#[tauri::command]
fn print_network_receipt(ip: String, port: u16, data: Vec<u8>) -> Result<String, String> {
    use std::io::Write;
    use std::net::{IpAddr, SocketAddr, TcpStream};
    let address: IpAddr = ip.parse().map_err(|_| "Enter a valid printer IP address")?;
    let local = match address {
        IpAddr::V4(value) => value.is_private() || value.is_loopback(),
        IpAddr::V6(value) => value.is_loopback() || (value.segments()[0] & 0xfe00) == 0xfc00,
    };
    if !local || port == 0 || data.is_empty() || data.len() > 1_000_000 { return Err("Invalid local printer target or print data".into()); }
    let mut stream = TcpStream::connect_timeout(&SocketAddr::new(address, port), std::time::Duration::from_secs(3)).map_err(|error| format!("Printer connection failed: {}", error))?;
    stream.set_write_timeout(Some(std::time::Duration::from_secs(3))).map_err(|error| error.to_string())?;
    stream.write_all(&data).map_err(|error| format!("Printer write failed: {}", error))?;
    stream.flush().map_err(|error| error.to_string())?;
    Ok("Receipt sent to the local network printer".into())
}

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
            print_network_receipt,
            kick_cash_drawer,
            get_app_version,
            is_tauri_app,
        ])
        // ── Setup ─────────────────────────────────────────────────────────────
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                // Open DevTools in development mode
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            // Launch the NestJS Backend Sidecar
            use tauri_plugin_shell::ShellExt;
            use tauri::Manager;

            let resource_path = app.path().resource_dir().unwrap().join("backend").join("dist").join("src").join("main.js");
            
            // Note: If running locally in dev mode, the resource_dir might be different,
            // but in production, this perfectly points to the bundled resource.
            // We only spawn if the file actually exists to prevent crash in dev mode
            if resource_path.exists() {
                let resource_str = resource_path.to_str().unwrap().replace("\\\\?\\", "");
                let sidecar_command = app.shell().sidecar("node").unwrap().arg(&resource_str).env("KARVAAN_DESKTOP", "true");
                let (mut rx, child) = sidecar_command.spawn().expect("Failed to spawn backend sidecar");
                app.manage(BackendChild(Mutex::new(Some(child))));
                println!("✅ Backend Sidecar spawned: {}", resource_str);
                
                tauri::async_runtime::spawn(async move {
                    while let Some(event) = rx.recv().await {
                        if let tauri_plugin_shell::process::CommandEvent::Stdout(line) = event {
                            println!("[Node Sidecar] {}", String::from_utf8_lossy(&line));
                        } else if let tauri_plugin_shell::process::CommandEvent::Stderr(line) = event {
                            eprintln!("[Node Sidecar ERR] {}", String::from_utf8_lossy(&line));
                        }
                    }
                });
            } else {
                println!("⚠️ Backend resource not found at {:?}. Skipping sidecar launch. (This is normal in dev mode)", resource_path);
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Karvaan POS application")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(backend) = app.try_state::<BackendChild>() {
                    if let Some(child) = backend.0.lock().unwrap().take() { let _ = child.kill(); }
                }
            }
        });
}
