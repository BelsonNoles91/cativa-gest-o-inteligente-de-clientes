/**
 * LockedFeatureHint — dica discreta para módulos bloqueados pelo plano.
 * Abre ao passar o mouse (desktop) ou ao tocar (celular) e sugere upgrade.
 */
import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  label: string;
  locked?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  onUpgrade?: () => void;
  children: ReactNode;
}

export function LockedFeatureHint({ label, locked, side = "right", onUpgrade, children }: Props) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  if (!locked) return <>{children}</>;

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        onMouseEnter={show}
        onMouseLeave={hide}
        onClickCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <div className="w-full">{children}</div>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="center"
        sideOffset={8}
        onMouseEnter={show}
        onMouseLeave={hide}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-64 rounded-xl p-3 text-sm shadow-md"
        data-testid="locked-feature-hint"
      >
        <div className="flex items-start gap-2">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-primary">
            <Lock className="h-3 w-3" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <p className="font-medium text-foreground">{label} não está no seu plano</p>
            <p className="text-xs text-muted-foreground">
              Faça upgrade para liberar este módulo e aproveitar tudo o que o Cativa oferece.
            </p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onUpgrade?.();
                navigate("/app/meu-plano");
              }}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" /> Ver planos
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
