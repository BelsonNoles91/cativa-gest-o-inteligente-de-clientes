/**
 * Service Worker registration helper.
 *
 * ⚠️ NUNCA registra o SW quando estamos:
 *  - dentro de um iframe (preview do Lovable)
 *  - em domínios *.lovableproject.com / id-preview--*.lovable.app
 *  - em desenvolvimento (vite dev)
 *
 * Em qualquer um desses casos, faz o oposto: desregistra qualquer SW
 * remanescente para evitar cache de builds antigos no preview.
 *
 * Em produção (app publicado em *.lovable.app ou domínio próprio),
 * registra o SW gerado pelo vite-plugin-pwa com auto-update.
 */

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin → assume iframe
  }
})();

const isPreviewHost = (() => {
  const host = window.location.hostname;
  const isLoopbackHost = new Set(["localhost", "127.0.0.1", "::1"]).has(
    host.replace(/^\[|\]$/g, ""),
  );
  // E2E usa um build de produção isolado em loopback para validar cache/offline.
  // O opt-in não habilita SW no Vite dev e não altera previews sem esta variável.
  const allowLocalPwaE2E =
    import.meta.env.PROD && import.meta.env.VITE_E2E_ENABLE_LOCAL_PWA === "true";

  return (
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    (isLoopbackHost && !allowLocalPwaE2E)
  );
})();

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // Em preview/iframe/dev → garante que nenhum SW antigo siga ativo
  if (isInIframe || isPreviewHost || import.meta.env.DEV) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
      // Limpa caches do Workbox/precache para não servir build velho
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* noop */
    }
    return;
  }

  // Produção real → registra o SW gerado pelo vite-plugin-pwa
  try {
    const { Workbox } = await import("workbox-window");
    const wb = new Workbox("/sw.js");

    wb.addEventListener("waiting", () => {
      // Quando há nova versão pronta, ativa imediatamente.
      wb.messageSkipWaiting();
    });

    wb.addEventListener("controlling", (event) => {
      // Atualização aplicada — recarrega para garantir bundle novo
      // O primeiro controle (instalação inicial) não é uma atualização e
      // não deve interromper a navegação que acabou de carregar o app.
      if (!event.isUpdate) return;
      window.location.reload();
    });

    await wb.register();
  } catch (error) {
    if (import.meta.env.DEV) console.warn("[pwa] registration failed", error);
  }
}
