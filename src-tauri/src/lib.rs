mod commands;
mod icloud;
mod pdf_info;
mod progress;
mod watcher;
mod window;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub fn run() {
    let watcher_stop = Arc::new(AtomicBool::new(false));

    let stop_flag = watcher_stop.clone();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            commands::scan_books,
            commands::import_pdf,
            commands::get_pdf_outline,
            commands::load_progress,
            commands::save_progress,
            commands::open_reader_window,
            commands::get_books_directory,
            commands::reveal_in_finder,
            commands::is_debug_enabled,
            commands::reset_magnification,
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // Initialize iCloud directory
            if let Err(e) = icloud::ensure_directories() {
                log::error!("Failed to initialize directories: {}", e);
            }

            // Start file watcher
            let handle = app_handle.clone();
            let stop = stop_flag.clone();
            std::thread::spawn(move || {
                if let Err(e) = watcher::start_watching(handle, stop) {
                    log::error!("File watcher error: {}", e);
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app, event| {
            if let tauri::RunEvent::Exit = event {
                watcher_stop.store(true, Ordering::Relaxed);
            }
        });
}
