use serde::{Deserialize, Serialize};

use crate::icloud;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadingProgress {
    pub hash: String,
    pub current_page: u32,
    pub total_pages: u32,
    pub zoom: f64,
    pub scroll_mode: String,
    pub scroll_position: f64,
    pub last_read: String,
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
            last_read: chrono::Utc::now().to_rfc3339(),
        }
    }
}

fn progress_file_path(hash: &str) -> std::path::PathBuf {
    icloud::get_progress_dir().join(format!("{}.json", hash))
}

pub fn load(hash: &str) -> Result<Option<ReadingProgress>, String> {
    let path = progress_file_path(hash);
    if !path.exists() {
        return Ok(None);
    }
    let data =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read progress: {}", e))?;
    let progress: ReadingProgress =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse progress: {}", e))?;
    Ok(Some(progress))
}

pub fn save(progress: &ReadingProgress) -> Result<(), String> {
    let path = progress_file_path(&progress.hash);
    let tmp_path = path.with_extension("json.tmp");

    let data = serde_json::to_string_pretty(progress)
        .map_err(|e| format!("Failed to serialize progress: {}", e))?;

    std::fs::write(&tmp_path, &data)
        .map_err(|e| format!("Failed to write temp progress: {}", e))?;

    std::fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Failed to rename progress file: {}", e))?;

    Ok(())
}
