import { PremiumSection } from "../layout/PremiumSection";
import { XCircle, ChevronRight } from "lucide-react";

export function ProblemSection() {
  const problems = [
    "No-show excessivo e falta de confirmações organizadas.",
    "Perda de tempo em tarefas repetitivas na recepção.",
    "Dificuldade em visualizar o lucro real por profissional.",
    "Falta de um histórico detalhado para decisões de marketing."
  ];

  return (
    <PremiumSection variant="dark" padding="lg" id="problem">
      <div className="grid lg:grid-cols-2 gap-24 items-center">
        <div>
          <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-8 border border-white/10">
            O Status Quo
          </div>
          <h2 className="text-5xl md:text-7xl font-display font-bold text-white leading-[0.95] tracking-tight mb-12">
            Gestão genérica <br />
            gera <span className="text-accent italic serif font-normal">resultados genéricos.</span>
          </h2>
          <p className="text-xl text-white/60 font-light leading-relaxed max-w-xl mb-12">
            A maioria dos softwares de agendamento foca na transação, não na experiência. Isso cria gargalos que custam caro ao seu faturamento mensal.
          </p>
          
          <div className="space-y-6">
            {problems.map((problem, i) => (
              <div key={i} className="flex items-start gap-4 group">
                <div className="mt-1">
                  <XCircle className="h-5 w-5 text-accent/50 group-hover:text-accent transition-colors" />
                </div>
                <p className="text-lg text-white/80 font-light">{problem}</p>
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
