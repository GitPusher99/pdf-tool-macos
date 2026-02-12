use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use crate::icloud;

static PROGRESS_LOCK: Mutex<()> = Mutex::new(());
static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadingProgress {
    pub hash: String,
    pub current_page: u32,
    pub total_pages: u32,
    pub zoom: f64,
    pub scroll_mode: String,
    pub scroll_position: f64,
    pub last_read: String,
    #[serde(default)]
    pub version: u64,
}

impl Default for ReadingProgress {
    fn default() -> Self {
        Self {
            hash: String::new(),
            current_page: 1,
            total_pages: 0,
            zoom: 1.0,
            scroll_mode: "continuous".to_string(),
            scroll_position: 0.0,
            last_read: chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string(),
            version: 0,
        }
    }
}

fn local_progress_file(hash: &str) -> std::path::PathBuf {
    icloud::get_local_progress_dir().join(format!("{}.json", hash))
}

fn central_progress_file(hash: &str) -> std::path::PathBuf {
    icloud::get_progress_dir().join(format!("{}.json", hash))
}

fn read_progress_file(path: &Path) -> Result<Option<ReadingProgress>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let data =
        std::fs::read_to_string(path).map_err(|e| format!("Failed to read progress: {}", e))?;
    let progress: ReadingProgress =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse progress: {}", e))?;
    Ok(Some(progress))
}

fn write_progress_file(path: &Path, progress: &ReadingProgress) -> Result<(), String> {
    let seq = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let tmp_path = path.with_extension(format!("json.{}.tmp", seq));
    let data = serde_json::to_string_pretty(progress)
        .map_err(|e| format!("Failed to serialize progress: {}", e))?;
    std::fs::write(&tmp_path, &data)
        .map_err(|e| format!("Failed to write temp progress: {}", e))?;
    std::fs::rename(&tmp_path, path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp_path);
        format!("Failed to rename progress file: {}", e)
    })?;
    Ok(())
}

fn load_local(hash: &str) -> Result<Option<ReadingProgress>, String> {
    read_progress_file(&local_progress_file(hash))
}

fn save_local_inner(progress: &ReadingProgress) -> Result<ReadingProgress, String> {
    let path = local_progress_file(&progress.hash);
    let current_version = read_progress_file(&path)?
        .map(|p| p.version)
        .unwrap_or(0);
    let mut to_save = progress.clone();
    to_save.version = current_version + 1;
    write_progress_file(&path, &to_save)?;
    Ok(to_save)
}

/// Save locally (version+1). Central is updated only via sync_inner to avoid iCloud conflicts.
pub fn save_local(progress: &ReadingProgress) -> Result<(), String> {
    let _guard = PROGRESS_LOCK.lock().unwrap();
    let saved = save_local_inner(progress)?;
    log::warn!(
        "save: hash={}, page={}, version={}",
        &saved.hash[..8.min(saved.hash.len())],
        saved.current_page,
        saved.version
    );
    Ok(())
}

fn load_central(hash: &str) -> Result<Option<ReadingProgress>, String> {
    read_progress_file(&central_progress_file(hash))
}

fn save_central(progress: &ReadingProgress) -> Result<(), String> {
    write_progress_file(&central_progress_file(&progress.hash), progress)
}

fn sync_inner(hash: &str) -> Result<Option<ReadingProgress>, String> {
    if !icloud::is_icloud_active() {
        return Ok(None);
    }

    let local = load_local(hash)?;
    let central = load_central(hash)?;

    match (local, central) {
        (Some(l), Some(c)) => {
            if l.version > c.version {
                log::info!(
                    "sync: hash={}, pushing local v{} (page={}) over central v{} (page={})",
                    &hash[..8.min(hash.len())], l.version, l.current_page, c.version, c.current_page
                );
                save_central(&l)?;
                Ok(None)
            } else if c.version > l.version {
                log::info!(
                    "sync: hash={}, pulling central v{} (page={}) over local v{} (page={})",
                    &hash[..8.min(hash.len())], c.version, c.current_page, l.version, l.current_page
                );
                write_progress_file(&local_progress_file(hash), &c)?;
                Ok(Some(c))
            } else {
                // Versions equal — use last_read as tiebreaker
                if c.last_read > l.last_read {
                    log::warn!(
                        "sync: hash={}, equal v{} but central is newer (last_read), pulling page={}",
                        &hash[..8.min(hash.len())], c.version, c.current_page
                    );
                    write_progress_file(&local_progress_file(hash), &c)?;
                    Ok(Some(c))
                } else if l.last_read > c.last_read {
                    log::warn!(
                        "sync: hash={}, equal v{} but local is newer (last_read), pushing page={}",
                        &hash[..8.min(hash.len())], l.version, l.current_page
                    );
                    save_central(&l)?;
                    Ok(None)
                } else {
                    Ok(None)
                }
            }
        }
        (Some(l), None) => {
            log::info!(
                "sync: hash={}, no central, pushing local v{} (page={})",
                &hash[..8.min(hash.len())], l.version, l.current_page
            );
            save_central(&l)?;
            Ok(None)
        }
        (None, Some(c)) => {
            log::info!(
                "sync: hash={}, no local, pulling central v{} (page={})",
                &hash[..8.min(hash.len())], c.version, c.current_page
            );
            write_progress_file(&local_progress_file(hash), &c)?;
            Ok(Some(c))
        }
        (None, None) => Ok(None),
    }
}

/// Core sync logic. Returns Some(progress) if central was newer (UI should update).
pub fn sync(hash: &str) -> Result<Option<ReadingProgress>, String> {
    let _guard = PROGRESS_LOCK.lock().unwrap();
    sync_inner(hash)
}

/// Batch sync for multiple hashes. Returns only the progresses that were updated from central.
pub fn sync_all(hashes: &[String]) -> Result<Vec<ReadingProgress>, String> {
    let _guard = PROGRESS_LOCK.lock().unwrap();
    let mut updated = Vec::new();
    for hash in hashes {
        match sync_inner(hash) {
            Ok(Some(progress)) => updated.push(progress),
            Ok(None) => {}
            Err(e) => log::warn!("sync_all: failed to sync {}: {}", hash, e),
        }
    }
    Ok(updated)
}

/// Load progress with sync: try central sync first, then local, then central fallback.
pub fn load(hash: &str) -> Result<Option<ReadingProgress>, String> {
    let _guard = PROGRESS_LOCK.lock().unwrap();
    // Sync first so we get the latest from central if available
    if let Some(synced) = sync_inner(hash)? {
        return Ok(Some(synced));
    }
    if let Some(local) = load_local(hash)? {
        return Ok(Some(local));
    }
    if let Some(central) = load_central(hash)? {
        write_progress_file(&local_progress_file(hash), &central)?;
        return Ok(Some(central));
    }
    Ok(None)
}

/// Delete both local and central progress files for a hash.
pub fn delete(hash: &str) {
    let _guard = PROGRESS_LOCK.lock().unwrap();
    let local = local_progress_file(hash);
    let central = central_progress_file(hash);
    if local.exists() {
        let _ = std::fs::remove_file(&local);
    }
    if central.exists() {
        let _ = std::fs::remove_file(&central);
    }
}
