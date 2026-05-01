import { PremiumHeader as Navbar } from "@/components/marketing/layout/PremiumHeader";
import { PremiumFooter as Footer } from "@/components/marketing/layout/PremiumFooter";
import { PremiumSection } from "@/components/marketing/layout/PremiumSection";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="pt-32">
        <PremiumSection variant="soft" padding="lg">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="font-display text-5xl md:text-7xl text-primary-dark tracking-tighter mb-12">
              Termos de <span className="italic serif text-accent">Uso</span>
            </h1>
            <div className="prose prose-slate max-w-none space-y-8 text-primary-dark/80">
              <section>
                <h2 className="text-2xl font-bold text-primary-dark mb-4 uppercase tracking-widest text-xs">1. Aceitação dos Termos</h2>
                <p className="leading-relaxed">Ao acessar e utilizar a Cativa, você concorda em cumprir estes termos de uso e todas as leis e regulamentos aplicáveis.</p>
              </section>
              <section>
                <h2 className="text-2xl font-bold text-primary-dark mb-4 uppercase tracking-widest text-xs">2. Uso da Licença</h2>
                <p className="leading-relaxed">A Cativa concede a você uma licença pessoal, limitada e não exclusiva para usar nossa plataforma de acordo com o plano contratado.</p>
              </section>
              <section>
                <h2 className="text-2xl font-bold text-primary-dark mb-4 uppercase tracking-widest text-xs">3. Responsabilidades</h2>
                <p className="leading-relaxed">Você é responsável por manter a confidencialidade de sua conta e por todas as atividades que ocorrem sob seu login.</p>
              </section>
              <section>
                <h2 className="text-2xl font-bold text-primary-dark mb-4 uppercase tracking-widest text-xs">4. Alterações nos Termos</h2>
                <p className="leading-relaxed">Reservamo-nos o direito de modificar estes termos a qualquer momento, notificando os usuários sobre mudanças significativas.</p>
              </section>
            </div>
          </div>
        </PremiumSection>
      </main>
      <Footer />
    </div>
  );
}
