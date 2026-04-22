import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./pwa/registerSW";

createRoot(document.getElementById("root")!).render(<App />);

// Registra (ou desregistra) o SW de acordo com o ambiente.
// Ver src/pwa/registerSW.ts para detalhes dos guards.
void registerServiceWorker();
