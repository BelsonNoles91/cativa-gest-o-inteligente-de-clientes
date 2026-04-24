import { existsSync } from "node:fs";
import { resolve } from "node:path";

const HAS_ENV_AUTH = Boolean(process.env.E2E_USER && process.env.E2E_PASS);
const HAS_STORAGE_STATE = existsSync(
  resolve(process.cwd(), "e2e/.auth/storageState.json"),
);

export const HAS_E2E_AUTH = HAS_ENV_AUTH || HAS_STORAGE_STATE;

export const AUTH_SKIP_REASON =
  "E2E_USER/E2E_PASS ausentes e storageState não encontrado para validar fluxos autenticados.";
