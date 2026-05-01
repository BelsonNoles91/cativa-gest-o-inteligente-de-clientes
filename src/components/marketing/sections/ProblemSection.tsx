import { PremiumSection } from "../layout/PremiumSection";
import { XCircle, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ProblemSection() {
  const problems = [
    { title: "Clientes não retornam no tempo ideal", desc: "Você atende bem hoje, mas não consegue acompanhar quem deveria voltar e quem está saindo da sua base." },
    { title: "Faltas e cancelamentos desorganizam o dia", desc: "Sem rotina clara de confirmação, a agenda perde eficiência e o seu negócio absorve o prejuízo silenciosamente." },
    { title: "A recepção trabalha sob pressão", desc: "Decisões dependem da memória ou de conversas soltas, gerando retrabalho, falhas e pouca visibilidade." },
    { title: "Você tem dados, mas não tem direção", desc: "Quase nunca há uma visão clara de fidelidade, novas marcações, ocupação e risco de perda de receita." }
  ];

  return (
    <PremiumSection variant="dark" padding="lg" id="problema">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="px-4 md:px-0 order-2 lg:order-1"
        >
          <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-8 border border-white/10">
            O Cenário Atual
          </div>
          <h2 className="text-4xl md:text-7xl font-display font-bold text-white leading-[0.95] tracking-tight mb-8 md:mb-12">
            Seu negócio pode estar <br className="hidden md:block" />
            <span className="text-accent italic serif font-normal">perdendo receita todos os dias.</span>
          </h2>
          <p className="text-lg md:text-xl text-white/60 font-light leading-relaxed max-w-xl mb-10 md:mb-12">
            Muitos negócios de estética acreditam que o desafio está apenas em “preencher a agenda”. Mas o que mais compromete o crescimento é a falta de controle sobre o que acontece na operação quando o cliente sai pela porta.
          </p>
          
          <div className="space-y-6">
            {problems.map((problem, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={i} className="flex items-start gap-4 md:gap-6 group"
              >
                <div className="mt-1 w-8 h-8 md:w-10 md:h-10 rounded-full border border-white/10 flex items-center justify-center shrink-0 group-hover:border-accent transition-colors">
                  <XCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-accent/50 group-hover:text-accent transition-colors" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-white text-base md:text-lg font-bold tracking-tight">{problem.title}</h4>
                  <p className="text-sm md:text-base text-white/50 font-light leading-snug">{problem.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="relative px-4 md:px-0 order-1 lg:order-2"
        >
          <div className="aspect-[4/5] rounded-[2.5rem] md:rounded-[4rem] overflow-hidden bg-[#2A1523] border border-white/10 relative group shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A0F16] via-transparent to-transparent z-10" />
            
            <div className="absolute top-8 md:top-12 left-8 md:left-12 right-8 md:right-12 space-y-3 md:space-y-4 z-20">
               {[1, 2].map((i) => (
                 <motion.div 
                    key={i}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
                    className={cn(
                      "h-20 md:h-24 bg-white/5 backdrop-blur-md rounded-2xl md:rounded-3xl border border-white/10 p-4 md:p-6",
                      i === 2 && "ml-8 md:ml-12"
                    )}
                 >
                    <div className="flex justify-between items-center mb-3 md:mb-4">
                       <div className={cn("h-2 bg-white/20 rounded-full", i === 1 ? "w-24" : "w-20")} />
                       <div className="h-4 w-4 md:h-5 md:w-5 rounded-full bg-rose-500/50 animate-pulse" />
                    </div>
                    <div className={cn("h-3 md:h-4 bg-white/10 rounded-full", i === 1 ? "w-3/4" : "w-1/2")} />
                 </motion.div>
               ))}
            </div>

            <div className="absolute bottom-8 md:bottom-12 left-8 md:left-12 right-8 md:right-12 z-20">
               <motion.div 
                 whileHover={{ scale: 1.02 }}
                 className="bg-accent p-8 md:p-10 rounded-[2rem] md:rounded-[3rem] text-white shadow-2xl"
               >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 md:mb-4 opacity-80">A Realidade</p>
                  <p className="text-2xl md:text-3xl font-display font-bold leading-tight mb-6">
                    A confirmação de horários pode consumir horas preciosas da recepção todos os dias.
                  </p>
                  <button className="flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest group">
                    Mudar este cenário <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 group-hover:translate-x-1 transition-transform" />
                  </button>
               </motion.div>
            </div>
            
            <div className="absolute -right-20 top-1/2 w-64 h-64 bg-accent/20 blur-[100px] rounded-full" />
          </div>
        </motion.div>
      </div>
    </PremiumSection>
  );
}
