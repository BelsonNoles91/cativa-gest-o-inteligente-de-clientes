import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const HAS_ENV_AUTH = Boolean(process.env.E2E_USER && process.env.E2E_PASS);
const storageStatePath = resolve(process.cwd(), "e2e/.auth/storageState.json");

function hasSessionInStorageState(): boolean {
  if (!existsSync(storageStatePath)) return false;
  try {
    const state = JSON.parse(readFileSync(storageStatePath, "utf8")) as {
      origins?: Array<{ localStorage?: Array<{ name?: string; value?: string }> }>;
    };
    return (state.origins ?? []).some((origin) =>
      (origin.localStorage ?? []).some((entry) =>
        /^sb-.*-auth-token$/.test(entry.name ?? "") && Boolean(entry.value),
      ),
    );
  } catch {
    return false;
  }
}

const HAS_STORAGE_STATE = hasSessionInStorageState();

export const HAS_E2E_AUTH = HAS_ENV_AUTH || HAS_STORAGE_STATE;

export const AUTH_SKIP_REASON =
  "E2E_USER/E2E_PASS ausentes e storageState sem sessão para validar fluxos autenticados.";
