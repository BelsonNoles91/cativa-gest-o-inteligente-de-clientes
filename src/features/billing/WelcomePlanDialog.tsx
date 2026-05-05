import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plan } from "@/domain/billing";
import { Sparkles, CheckCircle2, Rocket } from "lucide-react";
import { formatPrice } from "@/domain/billing";
import { useNavigate } from "react-router-dom";

interface WelcomePlanDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan | null;
  isTrial: boolean;
}

export function WelcomePlanDialog({
  isOpen,
  onOpenChange,
  plan,
  isTrial,
}: WelcomePlanDialogProps) {
  const navigate = useNavigate();

  if (!plan) return null;

  const isFree = plan.priceCents <= 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center flex flex-col items-center">
        <DialogHeader className="w-full flex flex-col items-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            {isFree ? (
              <CheckCircle2 className="h-8 w-8 text-primary" />
            ) : (
              <Rocket className="h-8 w-8 text-primary" />
            )}
          </div>
          <DialogTitle className="text-2xl font-display font-bold">
            Bem-vindo ao {plan.name}!
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground mt-2">
            {isTrial
              ? `Seu período de testes de ${plan.trialDays || 14} dias começou.`
              : isFree
                ? "Sua assinatura gratuita foi ativada com sucesso."
                : "Sua assinatura foi ativada com sucesso."}
          </DialogDescription>
        </DialogHeader>

        <div className="w-full bg-muted/30 rounded-xl p-4 my-4 text-left border border-border/50">
          <h4 className="font-semibold text-sm mb-3">O que está incluído agora:</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {plan.description && (
              <li className="flex gap-2 items-start">
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>{plan.description}</span>
              </li>
            )}
            <li className="flex gap-2 items-start">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                Limites: {plan.maxUnits ? `${plan.maxUnits} unidades` : "Unidades ilimitadas"},{" "}
                {plan.maxProfessionals ? `${plan.maxProfessionals} profissionais` : "Equipe ilimitada"}.
              </span>
            </li>
            {isTrial && (
              <li className="flex gap-2 items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  Acesso total aos módulos do plano {plan.name} durante o trial. Você não será cobrado agora.
                </span>
              </li>
            )}
          </ul>
        </div>

        <DialogFooter className="sm:justify-center w-full">
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => {
              onOpenChange(false);
              navigate("/app");
            }}
          >
            Começar a usar a plataforma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
