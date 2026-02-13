import ReactDOM from "react-dom/client";
import App from "./App";
import "@shared/styles/globals.css";
import { initLogger } from "@shared/lib/logger";
import { initI18n } from "@shared/lib/i18n";

initLogger()
  .then(() => initI18n())
  .then(() => {
    ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
  });
