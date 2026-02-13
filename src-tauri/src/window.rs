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

    // Limit max reader windows
    const MAX_READER_WINDOWS: usize = 3;

    let reader_count = app_handle
        .webview_windows()
        .keys()
        .filter(|l| l.starts_with("reader-"))
        .count();

    if reader_count >= MAX_READER_WINDOWS {
        return Err(format!(
            "最多只能同时打开 {} 个阅读窗口，请关闭一些窗口后再试",
            MAX_READER_WINDOWS
        ));
    }

    let title = std::path::Path::new(file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("PDF Reader");

    let url = format!(
        "src/windows/reader/index.html?path={}&hash={}",
        urlencoding::encode(file_path),
        hash
    );

    let webview_window =
        WebviewWindowBuilder::new(app_handle, &label, WebviewUrl::App(url.into()))
            .title(title)
            .inner_size(900.0, 800.0)
            .min_inner_size(500.0, 400.0)
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true)
            .build()
            .map_err(|e| format!("Failed to create reader window: {}", e))?;

    // Enable trackpad pinch-to-zoom by setting WKWebView allowsMagnification
    #[cfg(target_os = "macos")]
    {
        let _ = webview_window.with_webview(|webview| {
            use objc2_web_kit::WKWebView;
            unsafe {
                let wk: &WKWebView = &*(webview.inner() as *const WKWebView);
                wk.setAllowsMagnification(true);
                wk.setMagnification(1.0);
            }
        });
    }

    // Suppress unused variable warning on non-macOS platforms
    #[cfg(not(target_os = "macos"))]
    let _ = webview_window;

    Ok(())
}
