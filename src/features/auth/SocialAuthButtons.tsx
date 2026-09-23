import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";

type Provider = "google" | "apple";

const LABELS: Record<Provider, string> = {
  google: "Continuar com Google",
  apple: "Continuar com Apple",
};

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.5 5.5 0 0 1-2.39 3.6v3h3.86c2.26-2.08 3.58-5.15 3.58-8.79Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.92l-3.87-3c-1.08.72-2.45 1.15-4.08 1.15-3.13 0-5.79-2.11-6.74-4.96H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.26 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.3a12 12 0 0 0 0 10.74l3.96-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.18 15.24 0 12 0A12 12 0 0 0 1.3 6.63l3.96 3.1C6.21 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M16.36 12.7c-.03-2.63 2.15-3.9 2.25-3.96-1.23-1.79-3.13-2.04-3.8-2.07-1.62-.16-3.16.95-3.98.95-.82 0-2.09-.93-3.43-.9-1.77.02-3.4 1.03-4.3 2.61-1.83 3.18-.47 7.88 1.31 10.46.87 1.26 1.91 2.68 3.28 2.63 1.32-.05 1.81-.85 3.4-.85 1.59 0 2.03.85 3.42.82 1.41-.02 2.3-1.29 3.16-2.55.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.72-1.04-2.73-4.2ZM13.9 4.2c.72-.88 1.21-2.1 1.08-3.32-1.04.04-2.3.69-3.05 1.56-.67.78-1.25 2.02-1.09 3.21 1.16.09 2.34-.59 3.06-1.45Z" />
    </svg>
  );
}

export function SocialAuthButtons({
  redirectPath = "/",
  className,
}: {
  redirectPath?: string;
  className?: string;
}) {
  const [pending, setPending] = useState<Provider | null>(null);

  async function handleClick(provider: Provider) {
    setPending(provider);
    try {
      sessionStorage.setItem("cativa:auth_redirect", redirectPath);
    } catch {
      /* storage indisponível */
    }
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setPending(null);
        toast.error("Não foi possível entrar", {
          description: "Tente novamente em instantes.",
        });
        return;
      }
      if (result.redirected) return;
      window.location.assign(redirectPath);
    } catch {
      setPending(null);
      toast.error("Não foi possível entrar", { description: "Tente novamente em instantes." });
    }
  }

  return (
    <div className={className ? `grid gap-3 ${className}` : "grid gap-3"}>
      {(["google", "apple"] as Provider[]).map((provider) => (
        <button
          key={provider}
          type="button"
          disabled={pending !== null}
          onClick={() => handleClick(provider)}
          className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card text-base font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {pending === provider ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : provider === "google" ? (
            <GoogleMark />
          ) : (
            <AppleMark />
          )}
          {LABELS[provider]}
        </button>
      ))}
    </div>
  );
}
