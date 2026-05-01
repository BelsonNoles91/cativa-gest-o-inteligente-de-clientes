import { PremiumSection } from "../layout/PremiumSection";
import { XCircle, ChevronRight } from "lucide-react";

export function ProblemSection() {
  const problems = [
    { title: "Clientes não retornam no tempo ideal", desc: "Você atende bem hoje, mas não consegue acompanhar quem deveria voltar e quem está saindo da sua base." },
    { title: "Faltas e cancelamentos desorganizam a operação", desc: "Sem rotina clara de confirmação, a agenda perde eficiência e o negócio absorve o prejuízo silenciosamente." },
    { title: "A recepção trabalha no improviso", desc: "Decisões dependem de memória e conversas soltas, gerando retrabalho, falhas e pouca visibilidade." },
    { title: "Você tem dados, mas não tem direção", desc: "Quase nunca há uma visão consolidada de retenção, rebooking, ocupação e risco de perda de receita." }
  ];

  return (
    <PremiumSection variant="dark" padding="lg" id="problem">
      <div className="grid lg:grid-cols-2 gap-24 items-center">
        <div>
          <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-8 border border-white/10">
            O Status Quo
          </div>
          <h2 className="text-5xl md:text-7xl font-display font-bold text-white leading-[0.95] tracking-tight mb-12">
            Seu negócio pode estar <br />
            <span className="text-accent italic serif font-normal">perdendo receita todos os dias.</span>
          </h2>
          <p className="text-xl text-white/60 font-light leading-relaxed max-w-xl mb-12">
            Muitos negócios de estética acreditam que o desafio está apenas em “preencher a agenda”. Mas o que mais compromete o crescimento é a falta de controle sobre a previsibilidade da operação.
          </p>
          
          <div className="space-y-6">
            {problems.map((problem, i) => (
              <div key={i} className="flex items-start gap-6 group">
                <div className="mt-1 w-10 h-10 rounded-full border border-white/10 flex items-center justify-center shrink-0 group-hover:border-accent transition-colors">
                  <XCircle className="h-4 w-4 text-accent/50 group-hover:text-accent transition-colors" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-white font-bold tracking-tight">{problem.title}</h4>
                  <p className="text-base text-white/50 font-light leading-snug">{problem.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="aspect-[4/5] rounded-[4rem] overflow-hidden bg-[#2A1523] border border-white/10 relative group">
            {/* Editorial Image Overlay Simulation */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A0F16] via-transparent to-transparent z-10" />
            
            {/* Animated UI Elements over Dark background */}
            <div className="absolute top-12 left-12 right-12 space-y-4 z-20">
               <div className="h-24 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-6 transform hover:-translate-y-1 transition-transform">
                  <div className="flex justify-between items-center mb-4">
                     <div className="h-2 w-24 bg-white/20 rounded-full" />
                     <div className="h-5 w-5 rounded-full bg-rose-500/50" />
                  </div>
                  <div className="h-4 w-3/4 bg-white/10 rounded-full" />
               </div>
               <div className="h-24 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-6 ml-12 transform hover:-translate-y-1 transition-transform delay-100">
                  <div className="flex justify-between items-center mb-4">
                     <div className="h-2 w-20 bg-white/20 rounded-full" />
                     <div className="h-5 w-5 rounded-full bg-rose-500/50" />
                  </div>
                  <div className="h-4 w-1/2 bg-white/10 rounded-full" />
               </div>
            </div>

            <div className="absolute bottom-12 left-12 right-12 z-20">
               <div className="bg-accent p-10 rounded-[3rem] text-white shadow-2xl">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4 opacity-80">A Realidade</p>
                  <p className="text-3xl font-display font-bold leading-tight mb-6">
                    Sua recepção gasta 4h por dia apenas confirmando horários.
                  </p>
                  <button className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest group">
                    Mudar este cenário <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </button>
               </div>
            </div>
            
            {/* Abstract Shape */}
            <div className="absolute -right-20 top-1/2 w-64 h-64 bg-accent/20 blur-[100px] rounded-full" />
          </div>
        </div>
      </div>
    </PremiumSection>
  );
}
