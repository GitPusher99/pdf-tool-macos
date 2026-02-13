use std::path::PathBuf;

const ICLOUD_CONTAINER: &str = "com~apple~CloudDocs";
const APP_FOLDER: &str = "PDFReader";

pub fn get_icloud_base() -> Option<PathBuf> {
    dirs::home_dir().map(|home| {
        home.join("Library")
            .join("Mobile Documents")
            .join(ICLOUD_CONTAINER)
            .join(APP_FOLDER)
    })
}

pub fn get_local_fallback() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".pdf-reader"))
}

pub fn get_base_dir() -> PathBuf {
    if let Some(icloud) = get_icloud_base() {
        // Check that the iCloud CloudDocs container exists
        let cloud_docs = dirs::home_dir()
            .map(|h| h.join("Library").join("Mobile Documents").join(ICLOUD_CONTAINER));
        if cloud_docs.map_or(false, |p| p.exists()) {
            return icloud;
        }
    }
    get_local_fallback().unwrap_or_else(|| {
        let mut tmp = std::env::temp_dir();
        tmp.push("pdf-reader");
        tmp
    })
}

pub fn get_books_dir() -> PathBuf {
    get_base_dir().join("Books")
}

pub fn get_progress_dir() -> PathBuf {
    get_base_dir().join("Progress")
}

pub fn get_local_progress_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("Library")
        .join("Application Support")
        .join("com.yangguanlin.pdf-reader")
        .join("Progress")
}

pub fn is_icloud_active() -> bool {
    let base = get_base_dir();
    get_icloud_base().map_or(false, |icloud| base == icloud)
}

pub fn ensure_directories() -> Result<(), String> {
    let books = get_books_dir();
    let progress = get_progress_dir();
    let local_progress = get_local_progress_dir();

    std::fs::create_dir_all(&books).map_err(|e| format!("create_books_dir_failed|detail={}", e))?;
    std::fs::create_dir_all(&progress)
        .map_err(|e| format!("create_progress_dir_failed|detail={}", e))?;
    std::fs::create_dir_all(&local_progress)
        .map_err(|e| format!("create_local_progress_dir_failed|detail={}", e))?;

    log::info!("Directories initialized at: {}", get_base_dir().display());
    log::info!("Local progress dir: {}", local_progress.display());
    Ok(())
}
