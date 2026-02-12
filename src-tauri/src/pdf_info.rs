use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Instant, SystemTime};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfInfo {
    pub path: String,
    pub filename: String,
    pub title: String,
    pub page_count: u32,
    pub hash: String,
    pub file_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutlineItem {
    pub title: String,
    pub page: u32,
    pub children: Vec<OutlineItem>,
}

pub fn compute_hash(path: &Path) -> Result<String, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut reader = std::io::BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = reader
            .read(&mut buf)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    let hash = hasher.finalize();
    Ok(hex::encode(&hash[..8]))
}

mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{:02x}", b)).collect()
    }
}

// --- Persistent hash cache ---

fn hash_cache_path() -> PathBuf {
    crate::icloud::get_base_dir().join("hash-cache.json")
}

fn hash_cache() -> &'static Mutex<HashMap<String, String>> {
    static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    CACHE.get_or_init(|| {
        let path = hash_cache_path();
        let map = if path.exists() {
            match std::fs::read_to_string(&path) {
                Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
                Err(e) => {
                    log::warn!("Failed to load hash cache: {}", e);
                    HashMap::new()
                }
            }
        } else {
            HashMap::new()
        };
        log::info!("Hash cache loaded: {} entries", map.len());
        Mutex::new(map)
    })
}

fn hash_cache_key(path: &Path, mtime_secs: u64, size: u64) -> String {
    format!("{}:{}:{}", path.display(), mtime_secs, size)
}

fn save_hash_cache() {
    if let Ok(cache) = hash_cache().lock() {
        let path = hash_cache_path();
        if let Ok(data) = serde_json::to_string(&*cache) {
            if let Err(e) = std::fs::write(&path, data) {
                log::warn!("Failed to save hash cache: {}", e);
            }
        }
    }
}

pub fn compute_hash_cached(path: &Path) -> Result<String, String> {
    let meta = std::fs::metadata(path).map_err(|e| format!("Failed to get metadata: {}", e))?;
    let size = meta.len();
    let mtime_secs = meta
        .modified()
        .map_err(|e| format!("Failed to get mtime: {}", e))?
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let key = hash_cache_key(path, mtime_secs, size);

    if let Ok(cache) = hash_cache().lock() {
        if let Some(hash) = cache.get(&key) {
            log::debug!("Hash cache hit: {}", path.display());
            return Ok(hash.clone());
        }
    }

    log::debug!("Hash cache miss: {}", path.display());
    let start = Instant::now();
    let hash = compute_hash(path)?;
    let elapsed = start.elapsed();

    if elapsed.as_millis() > 100 {
        log::info!("Slow hash for {}: {}ms", path.display(), elapsed.as_millis());
    }

    if let Ok(mut cache) = hash_cache().lock() {
        cache.insert(key, hash.clone());
    }
    save_hash_cache();

    Ok(hash)
}

// --- PDF info cache ---

type CacheKey = (PathBuf, SystemTime);

fn pdf_cache() -> &'static Mutex<HashMap<CacheKey, PdfInfo>> {
    static CACHE: OnceLock<Mutex<HashMap<CacheKey, PdfInfo>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Remove all cached entries (pdf info + hash) for a given path.
pub fn invalidate_cache(path: &Path) {
    if let Ok(mut cache) = pdf_cache().lock() {
        cache.retain(|(p, _), _| p != path);
    }
    if let Ok(mut cache) = hash_cache().lock() {
        let prefix = format!("{}:", path.display());
        cache.retain(|k, _| !k.starts_with(&prefix));
    }
    save_hash_cache();
}

pub fn extract_info(path: &Path) -> Result<PdfInfo, String> {
    // Check cache by path + mtime
    let mtime = std::fs::metadata(path)
        .and_then(|m| m.modified())
        .map_err(|e| format!("Failed to get metadata: {}", e))?;

    let key = (path.to_path_buf(), mtime);

    if let Ok(cache) = pdf_cache().lock() {
        if let Some(cached) = cache.get(&key) {
            return Ok(cached.clone());
        }
    }

    let info = extract_info_uncached(path)?;

    if let Ok(mut cache) = pdf_cache().lock() {
        // Remove stale entries for the same path with different mtime
        cache.retain(|(p, _), _| p != &key.0);
        cache.insert(key, info.clone());
    }

    Ok(info)
}

fn extract_info_uncached(path: &Path) -> Result<PdfInfo, String> {
    let total_start = Instant::now();

    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let file_size = std::fs::metadata(path)
        .map_err(|e| format!("Failed to get metadata: {}", e))?
        .len();

    let hash_start = Instant::now();
    let hash = compute_hash_cached(path)?;
    log::debug!("  hash: {}ms", hash_start.elapsed().as_millis());

    let load_start = Instant::now();
    let doc =
        lopdf::Document::load(path).map_err(|e| format!("Failed to load PDF: {}", e))?;
    log::debug!("  lopdf load: {}ms", load_start.elapsed().as_millis());

    let page_count = doc.get_pages().len() as u32;

    // Try to extract title from PDF metadata
    let title = doc
        .trailer
        .get(b"Info")
        .ok()
        .and_then(|info| doc.dereference(info).ok())
        .and_then(|(_, obj)| {
            if let lopdf::Object::Dictionary(dict) = obj {
                dict.get(b"Title")
                    .ok()
                    .and_then(|t| match t {
                        lopdf::Object::String(bytes, _) => {
                            String::from_utf8(bytes.clone()).ok().filter(|s| !s.trim().is_empty())
                        }
                        _ => None,
                    })
            } else {
                None
            }
        })
        .unwrap_or_else(|| {
            // Fallback: use filename without extension
            path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Untitled")
                .to_string()
        });

    log::debug!("  extract_info total for {}: {}ms", filename, total_start.elapsed().as_millis());

    Ok(PdfInfo {
        path: path.to_string_lossy().to_string(),
        filename,
        title,
        page_count,
        hash,
        file_size,
    })
}

pub fn extract_outline(path: &Path) -> Result<Vec<OutlineItem>, String> {
    let doc =
        lopdf::Document::load(path).map_err(|e| format!("Failed to load PDF: {}", e))?;

    let mut page_entries: Vec<(u32, lopdf::ObjectId)> = doc.get_pages().into_iter().collect();
    page_entries.sort_by_key(|(num, _)| *num);
    let pages: Vec<lopdf::ObjectId> = page_entries.into_iter().map(|(_, id)| id).collect();

    fn find_page_number(pages: &[lopdf::ObjectId], target: lopdf::ObjectId) -> u32 {
        pages
            .iter()
            .position(|&p| p == target)
            .map(|i| i as u32 + 1)
            .unwrap_or(1)
    }

    const MAX_OUTLINE_DEPTH: u32 = 32;

    fn parse_outline_items(
        doc: &lopdf::Document,
        obj_id: lopdf::ObjectId,
        pages: &[lopdf::ObjectId],
        depth: u32,
    ) -> Vec<OutlineItem> {
        if depth > MAX_OUTLINE_DEPTH {
            return Vec::new();
        }
        let mut items = Vec::new();
        let mut current_id = Some(obj_id);

        while let Some(id) = current_id {
            let Ok(obj) = doc.get_object(id) else {
                break;
            };
            let lopdf::Object::Dictionary(ref dict) = *obj else {
                break;
            };

            let title = dict
                .get(b"Title")
                .ok()
                .and_then(|t| match t {
                    lopdf::Object::String(bytes, _) => String::from_utf8(bytes.clone()).ok(),
                    _ => None,
                })
                .unwrap_or_default();

            let page = dict
                .get(b"Dest")
                .ok()
                .and_then(|dest| match dest {
                    lopdf::Object::Array(arr) => arr.first().and_then(|p| {
                        if let lopdf::Object::Reference(r) = p {
                            Some(find_page_number(pages, *r))
                        } else {
                            None
                        }
                    }),
                    _ => None,
                })
                .unwrap_or(1);

            let children = dict
                .get(b"First")
                .ok()
                .and_then(|f| {
                    if let lopdf::Object::Reference(r) = f {
                        Some(parse_outline_items(doc, *r, pages, depth + 1))
                    } else {
                        None
                    }
                })
                .unwrap_or_default();

            items.push(OutlineItem {
                title,
                page,
                children,
            });

            current_id = dict.get(b"Next").ok().and_then(|n| {
                if let lopdf::Object::Reference(r) = n {
                    Some(*r)
                } else {
                    None
                }
            });
        }

        items
    }

    // Get the document catalog -> Outlines -> First
    let catalog = doc
        .catalog()
        .map_err(|e| format!("Failed to get catalog: {}", e))?;

    let outlines_ref = match catalog.get(b"Outlines") {
        Ok(lopdf::Object::Reference(r)) => *r,
        _ => return Ok(Vec::new()),
    };

    let outlines = doc
        .get_object(outlines_ref)
        .map_err(|e| format!("Failed to get outlines: {}", e))?;

    let first_id = match outlines {
        lopdf::Object::Dictionary(ref dict) => match dict.get(b"First") {
            Ok(lopdf::Object::Reference(r)) => *r,
            _ => return Ok(Vec::new()),
        },
        _ => return Ok(Vec::new()),
    };

    Ok(parse_outline_items(&doc, first_id, &pages, 0))
}
