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

initLogger().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
});
