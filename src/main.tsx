import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./pwa/registerSW";
import {
  logBackendInitDiagnostics,
  installBackendInitErrorListener,
} from "./lib/backend-init-log";

// Log seguro de boot: presença de VITE_SUPABASE_URL, host (sem token),
// modo do bundle. Nunca imprime chaves. Ver src/lib/backend-init-log.ts.
installBackendInitErrorListener();
logBackendInitDiagnostics();

createRoot(document.getElementById("root")!).render(<App />);

// Registra (ou desregistra) o SW de acordo com o ambiente.
// Ver src/pwa/registerSW.ts para detalhes dos guards.
void registerServiceWorker();

