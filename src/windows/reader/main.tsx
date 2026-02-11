import ReactDOM from "react-dom/client";
import App from "./App";
import "@shared/styles/globals.css";
import { initLogger } from "@shared/lib/logger";

// Prevent WebView default pinch-zoom globally
document.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey) e.preventDefault();
  },
  { passive: false },
);

// Prevent WebKit gesture-based native zoom (macOS WKWebView)
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());

initLogger().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
});
