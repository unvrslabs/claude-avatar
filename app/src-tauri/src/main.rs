#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use tauri::{Manager, PhysicalPosition};

/* GET minimale verso il server avatar locale (niente dipendenze HTTP) */
fn http_get(path: &str) -> Option<String> {
    let mut s = std::net::TcpStream::connect("127.0.0.1:4848").ok()?;
    s.set_read_timeout(Some(std::time::Duration::from_millis(1500))).ok()?;
    write!(s, "GET {} HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n", path).ok()?;
    let mut buf = String::new();
    s.read_to_string(&mut buf).ok()?;
    buf.split("\r\n\r\n").nth(1).map(|b| b.to_string())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // niente icona nel Dock: vive come desktop pet
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            if let Some(win) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(400));

                    // reclama una sessione Claude Code dal server: {session,label,slot}
                    let winid = format!("rs{}", std::process::id());
                    let claim = http_get(&format!("/claim?win={}", winid))
                        .and_then(|b| serde_json::from_str::<serde_json::Value>(&b).ok());
                    let (sid, label, slot) = match &claim {
                        Some(j) => (
                            j["session"].as_str().unwrap_or("").to_string(),
                            j["label"].as_str().unwrap_or("").to_string(),
                            j["slot"].as_i64().unwrap_or(0),
                        ),
                        None => (String::new(), String::new(), 0),
                    };

                    // impila le finestre in basso a destra (slot 0 = la prima, le altre sopra)
                    if let Ok(Some(mon)) = win.primary_monitor() {
                        let ms = mon.size();
                        let ws = win.outer_size().unwrap_or(tauri::PhysicalSize::new(480, 480));
                        let sf = mon.scale_factor();
                        let margin_x = (24.0 * sf) as i64;
                        let margin_y = (60.0 * sf) as i64;
                        let gap = (10.0 * sf) as i64;
                        let x = ms.width as i64 - ws.width as i64 - margin_x;
                        let mut y = ms.height as i64 - ws.height as i64 - margin_y
                            - slot * (ws.height as i64 + gap);
                        if y < 10 { y = 10; }
                        let _ = win.set_position(PhysicalPosition::new(x as i32, y as i32));
                    }

                    // passa sessione/etichetta alla pagina (ripetuto: la pagina puo' non essere ancora pronta)
                    let js = format!(
                        "window.__SESSION__={};window.__LABEL__={};window.__WIN__={};",
                        serde_json::to_string(&sid).unwrap_or_default(),
                        serde_json::to_string(&label).unwrap_or_default(),
                        serde_json::to_string(&winid).unwrap_or_default()
                    );
                    for wait in [0u64, 800, 2000] {
                        std::thread::sleep(std::time::Duration::from_millis(wait));
                        let _ = win.eval(&js);
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("errore avvio Claude Avatar");
}
