import { PremiumSection } from "../layout/PremiumSection";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const steps = [
  {
    title: "Cadastro e Organização",
    desc: "O cliente entra na sua rotina com muito mais organização. Preferências e histórico ficam centralizados.",
    step: "01"
  },
  {
    title: "Operação da Agenda",
    desc: "Sua equipe visualiza horários, profissionais e serviços com agilidade, reduzindo erros e esperas.",
    step: "02"
  },
  {
    title: "Rotina de Confirmação",
    desc: "A recepção trabalha com filas e templates organizados, reduzindo faltas de forma profissional.",
    step: "03"
  },
  {
    title: "Continuidade e Retorno",
    desc: "O sistema ajuda a acompanhar protocolos e oportunidades de próxima visita automaticamente.",
    step: "04"
  },
  {
    title: "Visibilidade Gerencial",
    desc: "Você acompanha indicadores reais e identifica onde melhorar a saúde financeira do negócio.",
    step: "05"
  }
];

export function ProcessSection() {
  return (
    <PremiumSection variant="dark" padding="lg" id="processo">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-4xl mx-auto text-center mb-24"
      >
        <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-8 border border-white/10">
          Como Funciona
        </div>
        <h2 className="text-5xl md:text-7xl font-display font-bold text-white leading-[0.95] tracking-tight mb-8">
          Entenda em minutos como a <br />
          <span className="text-accent italic serif font-normal">Cativa funciona no dia a dia.</span>
        </h2>
      </motion.div>

      <div className="grid lg:grid-cols-5 gap-8 max-w-7xl mx-auto px-4 md:px-0">
        {steps.map((step, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            key={idx} className="relative group"
          >
            <div className="mb-10 text-8xl font-display font-bold text-white/5 transition-all duration-700 group-hover:text-accent/10">
              {step.step}
            </div>
            <div className="h-px w-full bg-white/10 mb-8 relative">
              <motion.div 
                initial={{ width: 0 }}
                whileInView={{ width: "100%" }}
                transition={{ duration: 1, delay: idx * 0.1 }}
                className="absolute top-0 left-0 h-px bg-accent/30"
              />
              <div className="absolute top-0 left-0 w-4 h-4 rounded-full bg-accent -translate-y-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-transform duration-500 shadow-[0_0_15px_rgba(168,76,134,0.5)]" />
            </div>
            <h4 className="text-white text-xl font-bold mb-4 group-hover:text-accent transition-colors">
              {step.title}
            </h4>
            <p className="text-white/40 font-light leading-relaxed">
              {step.desc}
            </p>
          </motion.div>
        ))}
      </div>
      
      <div className="mt-24 text-center">
        <p className="text-accent text-2xl md:text-3xl font-display italic serif">
          "Menos operação no improviso. Mais controle sobre a experiência e o crescimento do negócio."
        </p>
      </div>
    </PremiumSection>
  );
}
