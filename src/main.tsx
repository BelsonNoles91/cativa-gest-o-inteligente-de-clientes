import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./pwa/registerSW";
import {
  logBackendInitDiagnostics,
  installBackendInitErrorListener,
} from "./lib/backend-init-log";
import { BackendConfigMissingScreen } from "./components/feedback/BackendConfigMissingScreen";

// Log seguro de boot: presença de VITE_SUPABASE_URL, host (sem token),
// modo do bundle. Nunca imprime chaves. Ver src/lib/backend-init-log.ts.
installBackendInitErrorListener();
logBackendInitDiagnostics();

// Guarda de configuração: se o bundle foi publicado sem as variáveis do
// Supabase, exibimos uma tela acionável em vez de deixar o supabase-js
// crashar com "supabaseUrl is required." e apresentar tela em branco.
const env = import.meta.env;
const missingBackendVars: string[] = [];
if (!env.VITE_SUPABASE_URL) missingBackendVars.push("VITE_SUPABASE_URL");
if (!env.VITE_SUPABASE_PUBLISHABLE_KEY && !env.VITE_SUPABASE_ANON_KEY) {
  missingBackendVars.push("VITE_SUPABASE_PUBLISHABLE_KEY");
}

const rootEl = document.getElementById("root")!;

if (missingBackendVars.length > 0) {
  createRoot(rootEl).render(
    <BackendConfigMissingScreen
      missing={missingBackendVars}
      mode={env.MODE ?? "unknown"}
    />,
  );
} else {
  createRoot(rootEl).render(<App />);
  // Registra (ou desregistra) o SW de acordo com o ambiente.
  // Ver src/pwa/registerSW.ts para detalhes dos guards.
  void registerServiceWorker();
}


