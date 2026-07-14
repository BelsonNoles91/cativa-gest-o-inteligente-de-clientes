/**
 * Tela cheia mostrada quando o bundle foi publicado sem as variáveis
 * VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Substitui o crash
 * `supabaseUrl is required.` por uma mensagem acionável.
 *
 * Não depende de nenhum contexto (Auth, Router, Query) porque roda
 * ANTES do <App /> montar.
 */
export function BackendConfigMissingScreen({
  missing,
  mode,
}: {
  missing: string[];
  mode: string;
}) {
  return (
    <div
      role="alert"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "hsl(220 15% 8%)",
        color: "hsl(0 0% 98%)",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          background: "hsl(220 15% 12%)",
          border: "1px solid hsl(0 70% 55% / 0.35)",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 10px",
            borderRadius: 999,
            background: "hsl(0 70% 55% / 0.15)",
            color: "hsl(0 90% 75%)",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          ⚠︎ Configuração ausente
        </div>

        <h1 style={{ fontSize: 22, margin: "16px 0 8px", lineHeight: 1.3 }}>
          Não foi possível conectar ao backend
        </h1>
        <p style={{ margin: 0, opacity: 0.85, lineHeight: 1.55 }}>
          A aplicação foi carregada, mas as variáveis de ambiente do Supabase
          não estão presentes neste bundle. Sem elas o cliente não inicializa
          e nenhum dado pode ser lido ou salvo.
        </p>

        <div
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 10,
            background: "hsl(220 15% 16%)",
            border: "1px solid hsl(0 0% 100% / 0.06)",
            fontSize: 14,
          }}
        >
          <div style={{ opacity: 0.7, marginBottom: 6 }}>
            Variáveis faltando:
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {missing.map((name) => (
              <li key={name}>
                <code style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
                  {name}
                </code>
              </li>
            ))}
          </ul>
          <div style={{ opacity: 0.6, marginTop: 10, fontSize: 12 }}>
            Modo do bundle: <code>{mode}</code>
          </div>
        </div>

        <h2 style={{ fontSize: 15, margin: "22px 0 8px" }}>Como resolver</h2>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 14 }}>
          <li>
            Confirme que a conexão do Lovable Cloud / Supabase está ativa — é
            ela que popula o arquivo <code>.env</code> antes do build.
          </li>
          <li>
            Em hospedagens externas (Vercel, Netlify, VPS), defina{" "}
            <code>VITE_SUPABASE_URL</code> e{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> nas variáveis do
            provedor e faça um novo deploy.
          </li>
          <li>
            Após corrigir, faça um novo build/publish — variáveis do Vite são
            embutidas em <em>build time</em>, não podem ser injetadas em runtime.
          </li>
        </ol>

        <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid hsl(0 0% 100% / 0.15)",
              background: "hsl(0 0% 100% / 0.08)",
              color: "inherit",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Recarregar
          </button>
          <a
            href="/status"
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid hsl(0 0% 100% / 0.15)",
              color: "inherit",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Ver página de status
          </a>
        </div>

        <p style={{ marginTop: 18, fontSize: 12, opacity: 0.55 }}>
          Nenhuma chave é exibida nesta tela por segurança — apenas a lista de
          nomes de variáveis ausentes.
        </p>
      </div>
    </div>
  );
}
