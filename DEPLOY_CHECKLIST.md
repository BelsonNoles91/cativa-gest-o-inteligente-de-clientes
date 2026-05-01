# Checklist de Deploy Beta - Cativa

## 1. Supabase (Database & Auth)
- [ ] Aplicar todas as migrations pendentes no ambiente de produção.
- [ ] Configurar Google/Apple Social Auth via Lovable Cloud Managed Social Login.
- [ ] Verificar se as políticas de RLS estão habilitadas em todas as tabelas (especialmente `audit_logs`, `system_status`, `system_incidents`).
- [ ] Inserir os dados iniciais de planos e recursos (Feature Flags globais).

## 2. Variáveis de Ambiente (.env)
- `VITE_SUPABASE_URL`: Endpoint do projeto Supabase.
- `VITE_SUPABASE_ANON_KEY`: Chave anon para o cliente frontend.
- `SUPABASE_SERVICE_ROLE_KEY`: Chave de serviço para operações administrativas (apenas backend/edge functions).

## 3. GitHub & Sync
- [ ] Realizar o sync do repositório no Lovable.
- [ ] Verificar se o deploy automático foi concluído com sucesso.
- [ ] Validar se as Edge Functions foram deployadas.

## 4. Monitoramento & Suporte
- [ ] Validar a página pública de `/status`.
- [ ] Testar a criação de incidentes no Super Admin.
- [ ] Verificar se os logs de auditoria estão registrando ações de onboarding e billing.

## 5. Comunicação
- [ ] Preparar a mensagem de boas-vindas para os primeiros testers.
- [ ] Definir o canal oficial de feedback (ex: widget interno ou email).
