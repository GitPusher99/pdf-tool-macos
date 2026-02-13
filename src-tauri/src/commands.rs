use crate::{icloud, locale, pdf_info, progress, window};
use std::fs;
use std::path::PathBuf;
use std::time::Instant;
use tauri::Emitter;

#[tauri::command]
pub fn scan_books() -> Result<Vec<pdf_info::PdfInfo>, String> {
    let start = Instant::now();
    let books_dir = icloud::get_books_dir();
    log::info!("scan_books: scanning {}", books_dir.display());

    if !books_dir.exists() {
        log::info!("scan_books: directory does not exist, returning empty");
        return Ok(Vec::new());
    }

    let mut books = Vec::new();
    let mut pdf_count = 0;
    let entries =
        std::fs::read_dir(&books_dir).map_err(|e| format!("read_dir_failed|detail={}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();

        // Skip .icloud placeholder files
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') && name.ends_with(".icloud") {
                continue;
            }
        }

        if path
            .extension()
            .map_or(false, |ext| ext.eq_ignore_ascii_case("pdf"))
        {
            pdf_count += 1;
            let file_start = Instant::now();
            match pdf_info::extract_info(&path) {
                Ok(info) => {
                    let elapsed = file_start.elapsed();
                    if elapsed.as_millis() > 200 {
                        log::info!("scan_books: slow extract_info for {:?}: {}ms", path, elapsed.as_millis());
                    }
                    books.push(info);
                }
                Err(e) => log::warn!("Failed to extract info from {:?}: {}", path, e),
            }
        }
    }

    books.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    log::info!("scan_books: done in {}ms, {} PDFs found, {} loaded", start.elapsed().as_millis(), pdf_count, books.len());
    Ok(books)
}

#[tauri::command]
pub fn import_pdf(source_path: String) -> Result<pdf_info::PdfInfo, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err("source_not_exist".to_string());
    }

    let filename = source
        .file_name()
        .ok_or("invalid_filename")?
        .to_string_lossy()
        .to_string();

    let dest = icloud::get_books_dir().join(&filename);

    if dest.exists() {
        return Err(format!("file_already_exists|filename={}", filename));
    }

    std::fs::copy(&source, &dest).map_err(|e| format!("copy_failed|detail={}", e))?;

    pdf_info::extract_info(&dest)
}

#[tauri::command]
pub fn get_pdf_outline(file_path: String) -> Result<Vec<pdf_info::OutlineItem>, String> {
    let path = PathBuf::from(&file_path);
    pdf_info::extract_outline(&path)
}

#[tauri::command]
pub fn load_progress(hash: String) -> Result<Option<progress::ReadingProgress>, String> {
    progress::load(&hash)
}

#[tauri::command]
pub fn save_progress(
    app_handle: tauri::AppHandle,
    progress_data: progress::ReadingProgress,
) -> Result<(), String> {
    progress::save_local(&progress_data)?;
    let _ = app_handle.emit("progress:changed", &progress_data);
    Ok(())
}

#[tauri::command]
pub fn sync_progress(hash: String) -> Result<Option<progress::ReadingProgress>, String> {
    progress::sync(&hash)
}

#[tauri::command]
pub fn sync_all_progress(hashes: Vec<String>) -> Result<Vec<progress::ReadingProgress>, String> {
    progress::sync_all(&hashes)
}

#[tauri::command]
pub fn open_reader_window(
    app_handle: tauri::AppHandle,
    file_path: String,
    hash: String,
) -> Result<(), String> {
    window::open_reader(&app_handle, &file_path, &hash)
}

#[tauri::command]
pub fn get_books_directory() -> String {
    icloud::get_books_dir().to_string_lossy().to_string()
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("reveal_failed|detail={}", e))?;
    Ok(())
}

#[tauri::command]
pub fn is_debug_enabled() -> bool {
    std::env::var("PDF_DEBUG").as_deref() == Ok("1")
}

#[tauri::command]
pub fn delete_pdf(file_path: String, hash: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    let books_dir = icloud::get_books_dir();

    // Safety: ensure the file is inside the Books directory
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("resolve_path_failed|detail={}", e))?;
    let canonical_books = books_dir
        .canonicalize()
        .map_err(|e| format!("resolve_books_dir_failed|detail={}", e))?;
    if !canonical_path.starts_with(&canonical_books) {
        return Err("file_not_in_books".to_string());
    }

    // Move to trash
    trash::delete(&path).map_err(|e| format!("trash_failed|detail={}", e))?;
    log::info!("delete_pdf: moved to trash: {}", file_path);

    // Remove associated progress files (both local and central)
    progress::delete(&hash);
    log::info!("delete_pdf: removed progress for {}", hash);

    Ok(())
}

#[tauri::command]
pub fn rename_pdf(file_path: String, new_filename: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    let books_dir = icloud::get_books_dir();

    // Safety: ensure the file is inside the Books directory
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("resolve_path_failed|detail={}", e))?;
    let canonical_books = books_dir
        .canonicalize()
        .map_err(|e| format!("resolve_books_dir_failed|detail={}", e))?;
    if !canonical_path.starts_with(&canonical_books) {
        return Err("file_not_in_books".to_string());
    }

    // Validate new filename
    let new_filename = new_filename.trim().to_string();
    if new_filename.is_empty() {
        return Err("filename_empty".to_string());
    }
    if new_filename.contains('/') || new_filename.contains('\\') {
        return Err("filename_invalid_separator".to_string());
    }

    // Ensure .pdf extension
    let final_filename = if new_filename.to_lowercase().ends_with(".pdf") {
        new_filename
    } else {
        format!("{}.pdf", new_filename)
    };

    let new_path = books_dir.join(&final_filename);

    // Prevent overwrite
    if new_path.exists() {
        return Err(format!("rename_file_exists|filename={}", final_filename));
    }

    fs::rename(&path, &new_path).map_err(|e| format!("rename_failed|detail={}", e))?;
    log::info!("rename_pdf: {} -> {}", file_path, new_path.display());

    // Clean stale cache entries for the old path
    pdf_info::invalidate_cache(&path);

    Ok(())
}

#[tauri::command]
pub fn get_system_locale() -> String {
    locale::get_system_locale()
}

/// Reset WKWebView native magnification to 1.0 after JS-driven pinch zoom.
#[tauri::command]
pub fn reset_magnification(webview_window: tauri::WebviewWindow) {
    #[cfg(target_os = "macos")]
    {
        let _ = webview_window.with_webview(|webview| {
            use objc2_web_kit::WKWebView;
            unsafe {
                let wk: &WKWebView = &*(webview.inner() as *const WKWebView);
                wk.setMagnification(1.0);
            }
        });
    }

    #[cfg(not(target_os = "macos"))]
    let _ = webview_window;
}
