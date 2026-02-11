import ReactDOM from "react-dom/client";
import App from "./App";
import "@shared/styles/globals.css";
import { initLogger } from "@shared/lib/logger";

initLogger().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
});
