/**
 * InstallAppMenuItem — atalho fixo no menu para instalar o app no aparelho.
 * Mostra o ícone e o nome do estabelecimento; some quando já está instalado.
 */
import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTenant } from "@/features/tenant/TenantProvider";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallAppMenuItem({ collapsed = false }: { collapsed?: boolean }) {
  const { currentTenant, currentLogoUrl } = useTenant();
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const name = currentTenant?.name ?? "Cativa";

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setPromptEvent(null);
      return;
    }
    setShowSteps(true);
  }

  return (
    <>
      <Button
        variant="outline"
        className="min-h-[44px] w-full justify-start gap-2 rounded-xl"
        onClick={install}
        aria-label={`Instalar o app de ${name}`}
      >
        {currentLogoUrl ? (
          <img
            src={currentLogoUrl}
            alt=""
            className="h-6 w-6 shrink-0 rounded-md object-cover"
          />
        ) : (
          <Download className="h-4 w-4 shrink-0" />
        )}
        {!collapsed && <span className="truncate text-sm">Instalar {name}</span>}
      </Button>

      <Dialog open={showSteps} onOpenChange={setShowSteps}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Instalar {name} no aparelho</DialogTitle>
            <DialogDescription>
              O app abre com o ícone e o nome do seu estabelecimento, em tela cheia.
            </DialogDescription>
          </DialogHeader>
          {isIos() ? (
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <Share className="mt-0.5 h-4 w-4 shrink-0" /> Toque em Compartilhar, na barra do
                navegador.
              </li>
              <li>2. Escolha "Adicionar à Tela de Início".</li>
              <li>3. Confirme em "Adicionar".</li>
            </ol>
          ) : (
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>1. Abra o menu do navegador (três pontinhos).</li>
              <li>2. Toque em "Instalar app" ou "Adicionar à tela inicial".</li>
              <li>3. Confirme a instalação.</li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
