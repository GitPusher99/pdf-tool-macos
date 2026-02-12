import ReactDOM from "react-dom/client";
import App from "./App";
import "@shared/styles/globals.css";
import { initLogger } from "@shared/lib/logger";

// Prevent WebView default pinch-zoom globally
// capture: true is critical for WKWebView — without a capture-phase listener,
// the native gesture recognizer consumes events before JS bubble phase sees them.
document.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey) e.preventDefault();
  },
  { capture: true, passive: false },
);

initLogger().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
});
