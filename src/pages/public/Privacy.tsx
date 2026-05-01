import { PremiumHeader as Navbar } from "@/components/marketing/layout/PremiumHeader";
import { PremiumFooter as Footer } from "@/components/marketing/layout/PremiumFooter";
import { PremiumSection } from "@/components/marketing/layout/PremiumSection";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="pt-32">
        <PremiumSection variant="soft" padding="lg">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="font-display text-5xl md:text-7xl text-primary-dark tracking-tighter mb-12">
              Política de <span className="italic serif text-accent">Privacidade</span>
            </h1>
            <div className="prose prose-slate max-w-none space-y-8 text-primary-dark/80">
              <section>
                <h2 className="text-2xl font-bold text-primary-dark mb-4 uppercase tracking-widest text-xs">1. Introdução</h2>
                <p className="leading-relaxed">A Cativa valoriza a sua privacidade. Esta política descreve como coletamos, usamos e protegemos seus dados pessoais ao utilizar nossa plataforma de gestão.</p>
              </section>
              <section>
                <h2 className="text-2xl font-bold text-primary-dark mb-4 uppercase tracking-widest text-xs">2. Coleta de Dados</h2>
                <p className="leading-relaxed">Coletamos informações necessárias para a prestação de nossos serviços, como dados de cadastro, informações de agendamentos e interações com a plataforma.</p>
              </section>
              <section>
                <h2 className="text-2xl font-bold text-primary-dark mb-4 uppercase tracking-widest text-xs">3. Uso das Informações</h2>
                <p className="leading-relaxed">Seus dados são utilizados para personalizar sua experiência, processar pagamentos, enviar comunicações importantes e melhorar continuamente nossos serviços.</p>
              </section>
              <section>
                <h2 className="text-2xl font-bold text-primary-dark mb-4 uppercase tracking-widest text-xs">4. Segurança</h2>
                <p className="leading-relaxed">Implementamos medidas de segurança de ponta para proteger seus dados contra acessos não autorizados e garantir a integridade das informações do seu negócio.</p>
              </section>
            </div>
          </div>
        </PremiumSection>
      </main>
      <Footer />
    </div>
  );
}
