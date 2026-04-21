/**
 * Onboarding — wizard inicial em 3 passos (placeholder visual da Etapa 1).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Sparkles, Rocket, ArrowRight, Check } from "lucide-react";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { segmentLabels, type TenantSegment } from "@/domain/tenant";
import { cn } from "@/lib/utils";

const steps = [
  { id: 1, title: "Seu negócio", icon: Building2 },
  { id: 2, title: "Segmento", icon: Sparkles },
  { id: 3, title: "Tudo pronto", icon: Rocket },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <div className="mb-8">
        <ol className="flex items-center gap-2">
          {steps.map((s, i) => {
            const active = s.id === step;
            const done = s.id < step;
            return (
              <li key={s.id} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full text-xs font-semibold transition-colors",
                    done && "bg-success text-success-foreground",
                    active && "bg-primary text-primary-foreground",
                    !done && !active && "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : s.id}
                </div>
                {i < steps.length - 1 && (
                  <div className={cn("h-px flex-1", done ? "bg-success" : "bg-border")} />
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
          Passo {step} de {steps.length} — {steps[step - 1].title}
        </p>
      </div>

      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <h1 className="text-2xl font-semibold">Vamos conhecer seu negócio</h1>
          <p className="text-sm text-muted-foreground">Essas informações ajudam a personalizar o Cativa para você.</p>
          <div className="space-y-2">
            <Label htmlFor="bizname">Nome do estabelecimento</Label>
            <Input id="bizname" placeholder="Ex.: Studio Aurora" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bizphone">Telefone de contato</Label>
            <Input id="bizphone" placeholder="(11) 99999-0000" className="h-11 rounded-xl" />
          </div>
          <Button onClick={() => setStep(2)} className="h-11 w-full rounded-xl bg-gradient-brand">
            Continuar <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <h1 className="text-2xl font-semibold">Qual seu segmento?</h1>
          <p className="text-sm text-muted-foreground">Adaptamos serviços, protocolos e relatórios.</p>
          <Select>
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder="Selecione um segmento" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(segmentLabels) as TenantSegment[]).map((seg) => (
                <SelectItem key={seg} value={seg}>{segmentLabels[seg]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="h-11 flex-1 rounded-xl">Voltar</Button>
            <Button onClick={() => setStep(3)} className="h-11 flex-1 rounded-xl bg-gradient-brand">Continuar</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 text-center animate-fade-in">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground">
            <Rocket className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold">Tudo pronto!</h1>
          <p className="text-sm text-muted-foreground">
            Seu workspace foi preparado. Vamos para o painel.
          </p>
          <Button onClick={() => navigate("/app")} className="h-11 w-full rounded-xl bg-gradient-brand">
            Acessar o Cativa
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
