import { PremiumSection } from "../layout/PremiumSection";
import { Users, Calendar, Globe, BarChart, MessageSquare, CheckCircle2, Sparkles, Hourglass, Trophy, Smartphone, Gift, Package } from "lucide-react";
import { motion } from "framer-motion";

const modules = [
  {
    title: "Agenda sem conflitos",
    desc: "Agenda por profissional, sala e unidade. O sistema bloqueia horários duplicados automaticamente, mesmo com várias pessoas marcando ao mesmo tempo.",
    benefit: "Fim do encaixe errado e do cliente esperando por horário que já estava ocupado.",
    icon: Calendar,
    id: "01"
  },
  {
    title: "Página de agendamento própria",
    desc: "Um link exclusivo do seu negócio, com QR code para o balcão e Instagram. O cliente vê os horários livres e marca sozinho, 24 horas por dia.",
    benefit: "Sua agenda enche até de madrugada, sem a recepção precisar responder mensagem.",
    icon: Globe,
    id: "02"
  },
  {
    title: "Central de Confirmação",
    desc: "Lista do dia com mensagem pronta: um toque abre o WhatsApp do cliente e você registra a resposta. Sem robô e sem custo por mensagem.",
    benefit: "Menos faltas, sem risco de bloqueio do seu número.",
    icon: MessageSquare,
    id: "03"
  },
  {
    title: "Lista de espera inteligente",
    desc: "Quando alguém cancela, o sistema mostra quem está esperando aquele horário para você oferecer na hora.",
    benefit: "Cancelamento deixa de ser prejuízo e vira atendimento.",
    icon: Hourglass,
    id: "04"
  },
  {
    title: "Clientes e retorno",
    desc: "Histórico, ficha de anamnese, fotos e a data ideal de volta de cada cliente. Veja quem está sumindo e envie um cupom de retorno.",
    benefit: "Você para de perder cliente em silêncio.",
    icon: Users,
    id: "05"
  },
  {
    title: "Resumo com IA",
    desc: "Ao fim do atendimento, a IA organiza as anotações em um resumo claro para o próximo profissional.",
    benefit: "Todo atendimento começa sabendo o que o cliente fez e prefere.",
    icon: Sparkles,
    id: "06"
  },
  {
    title: "Espaço do Cliente",
    desc: "O cliente entra com Google ou Apple, agenda, remarca, cancela, acompanha pacotes, preenche a anamnese e avalia o atendimento.",
    benefit: "Menos trabalho na recepção e uma marca com cara profissional.",
    icon: Smartphone,
    id: "07"
  },
  {
    title: "Serviços, pacotes e fidelidade",
    desc: "Cadastre serviços e pacotes de sessões, controle o saldo de cada cliente e premie os mais fiéis.",
    benefit: "Venda o tratamento completo, não só a sessão avulsa.",
    icon: Package,
    id: "08"
  },
  {
    title: "Equipe, metas e comissões",
    desc: "Portal do profissional, metas com ranking e fechamento mensal de comissões calculado automaticamente.",
    benefit: "Equipe motivada e acerto do mês sem planilha.",
    icon: Trophy,
    id: "09"
  },
  {
    title: "Relatórios e Índice Cativa",
    desc: "Faltas, ocupação, retorno, valor de cada cliente, previsão de faturamento e um índice único da saúde do negócio, com sugestões do que fazer.",
    benefit: "Decisões com base em números reais, não em achismo.",
    icon: BarChart,
    id: "10"
  },
  {
    title: "Avisos no celular e app instalável",
    desc: "Instale a Cativa na tela do celular e receba aviso de novo agendamento e cancelamento. A agenda do dia funciona até sem internet.",
    benefit: "Você sabe o que acontece no negócio de qualquer lugar.",
    icon: Gift,
    id: "11"
  }
];

export function ModulesSection() {
  return (
    <PremiumSection variant="light" padding="lg" id="modulos">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-4xl mx-auto text-center mb-16 md:mb-24 px-4 md:px-0"
      >
        <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-[10px] font-bold uppercase tracking-[0.2em] text-accent-strong mb-6 md:mb-8">
          Módulos do Sistema
        </div>
        <h2 className="text-4xl md:text-7xl font-display font-bold text-primary-dark leading-[0.95] tracking-tight mb-6 md:mb-8">
          Tudo o que sua operação precisa, <br className="hidden md:block" />
          <span className="text-accent-strong italic serif font-normal">em um único sistema.</span>
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground font-light leading-relaxed max-w-2xl mx-auto">
          Cada parte da Cativa foi desenhada para resolver um problema real do dia a dia e, ao mesmo tempo, fortalecer a fidelidade dos seus clientes.
        </p>
      </motion.div>

      <div className="grid gap-6 md:gap-10 px-4 md:px-0">
        {modules.map((module, idx) => (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: idx * 0.05 }}
            key={idx} 
            className="group relative bg-white rounded-[2rem] md:rounded-[3rem] border border-border/30 p-6 md:p-14 transition-all duration-700 hover:border-accent/40 hover:shadow-xl overflow-hidden"
          >
            {/* Identificador de Fundo */}
            <div className="absolute -top-6 -right-6 text-[8rem] md:text-[12rem] font-display font-bold text-primary-dark/[0.03] select-none pointer-events-none transition-all duration-1000 group-hover:text-accent/[0.08] group-hover:scale-110">
              {module.id}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 lg:gap-20 items-center relative z-10">
              <div className="lg:col-span-1">
                <motion.div 
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] md:rounded-[2.5rem] bg-[#FAF7F9] flex items-center justify-center text-primary-dark transition-all duration-700 group-hover:bg-accent group-hover:text-white border border-border/10"
                >
                  <module.icon className="h-8 w-8 md:h-10 md:w-10" />
                </motion.div>
              </div>
              
              <div className="lg:col-span-5">
                <div className="flex items-center gap-3 mb-4 md:mb-6">
                   <span className="text-[10px] font-bold text-accent-strong tracking-[0.3em] uppercase">Módulo {module.id}</span>
                   <div className="h-px w-8 bg-accent/20" />
                </div>
                <h3 className="text-3xl md:text-5xl font-display font-bold text-primary-dark mb-4 md:mb-6 group-hover:text-accent transition-colors tracking-tighter">
                  {module.title}
                </h3>
                <p className="text-muted-foreground text-base md:text-xl font-light leading-relaxed max-w-lg">
                  {module.desc}
                </p>
              </div>
              
              <div className="lg:col-span-6">
                <div className="bg-[#FAF7F9]/80 backdrop-blur-sm p-6 md:p-12 rounded-[1.5rem] md:rounded-[2.5rem] border border-border/40 group-hover:border-accent/30 transition-all duration-700 relative overflow-hidden group/benefit">
                  <div className="absolute top-0 left-0 w-1 md:w-1.5 h-full bg-accent/10 group-hover:bg-accent transition-all duration-700" />
                  <div className="flex items-start gap-4 md:gap-6">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white flex items-center justify-center border border-border/20 shrink-0 shadow-sm transition-transform duration-500 group-hover/benefit:scale-110">
                       <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-accent" />
                    </div>
                    <div className="space-y-2 md:space-y-4">
                      <p className="text-[9px] md:text-[11px] font-bold uppercase tracking-[0.25em] text-accent-strong">Vantagem Principal</p>
                      <p className="text-primary-dark font-medium leading-[1.3] italic text-xl md:text-2xl tracking-tight">
                        "{module.benefit}"
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </PremiumSection>
  );
}
