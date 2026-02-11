use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn open_reader(app_handle: &AppHandle, file_path: &str, hash: &str) -> Result<(), String> {
    let label = format!("reader-{}", hash);

    // Check if window already exists
    if let Some(window) = app_handle.get_webview_window(&label) {
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus window: {}", e))?;
        return Ok(());
    }

    let url = format!(
        "src/windows/reader/index.html?path={}&hash={}",
        urlencoding::encode(file_path),
        hash
    );

    WebviewWindowBuilder::new(app_handle, &label, WebviewUrl::App(url.into()))
        .title("PDF Reader")
        .inner_size(900.0, 800.0)
        .min_inner_size(500.0, 400.0)
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
        .build()
        .map_err(|e| format!("Failed to create reader window: {}", e))?;

    Ok(())
}
