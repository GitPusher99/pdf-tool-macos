use notify::Watcher;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::time::Duration;
use tauri::Emitter;

use crate::icloud;

pub fn start_watching(app_handle: tauri::AppHandle, stop: Arc<AtomicBool>) -> Result<(), String> {
    let books_dir = icloud::get_books_dir();
    if !books_dir.exists() {
        return Err("Books directory does not exist".to_string());
    }

    let (tx, rx) = mpsc::channel();

    let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        if let Ok(event) = res {
            let dominated_by_pdf = event.paths.iter().any(|p| {
                p.extension()
                    .map_or(false, |ext| ext.eq_ignore_ascii_case("pdf"))
            });
            if dominated_by_pdf {
                let _ = tx.send(());
            }
        }
    })
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher
        .watch(&books_dir, notify::RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    log::info!("Watching directory: {}", books_dir.display());

    // Debounce loop
    while !stop.load(Ordering::Relaxed) {
        match rx.recv_timeout(Duration::from_millis(500)) {
            Ok(()) => {
                // Debounce: wait 500ms for more events
                while rx.recv_timeout(Duration::from_millis(500)).is_ok() {}
                let _ = app_handle.emit("books:changed", ());
                log::info!("Books directory changed, emitted event");
            }
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    log::info!("File watcher stopped");
    Ok(())
}
