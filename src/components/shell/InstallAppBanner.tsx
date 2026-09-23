/**
 * InstallAppBanner — convite discreto para instalar o Cativa no celular.
 * No Android usa o evento nativo de instalação; no iPhone mostra o passo a passo.
 */
import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "cativa:install-dismissed";

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

export function InstallAppBanner() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  });

  useEffect(() => {
    if (dismissed || isStandalone()) return;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (isIos()) setShowIosHint(true);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [dismissed]);

  function close() {
    setDismissed(true);
    setPromptEvent(null);
    setShowIosHint(false);
    window.localStorage.setItem(DISMISS_KEY, "1");
  }

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    close();
  }

  if (dismissed || (!promptEvent && !showIosHint)) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-secondary/40 px-4 py-3 text-sm">
      <Download className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p className="flex-1">
        {promptEvent ? (
          "Instale o Cativa no seu celular para abrir mais rápido, mesmo com internet fraca."
        ) : (
          <>
            No iPhone, toque em <Share className="inline h-3.5 w-3.5" aria-hidden /> e depois em
            {" "}
            <strong>Adicionar à Tela de Início</strong> para instalar o Cativa.
          </>
        )}
      </p>
      {promptEvent ? (
        <Button size="sm" className="min-h-[40px]" onClick={() => void install()}>
          Instalar
        </Button>
      ) : null}
      <Button
        size="icon"
        variant="ghost"
        className="h-10 w-10"
        aria-label="Dispensar convite de instalação"
        onClick={close}
      >
        <X className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
