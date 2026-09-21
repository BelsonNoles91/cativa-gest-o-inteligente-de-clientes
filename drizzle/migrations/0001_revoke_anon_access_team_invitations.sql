-- O papel anônimo ainda possuía SELECT (incluindo token/token_hash) em
-- team_invitations. Nenhuma policy permite anon nessa tabela, mas o GRANT
-- não deve existir.
REVOKE ALL ON TABLE public.team_invitations FROM anon;
