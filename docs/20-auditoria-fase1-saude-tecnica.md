# Auditoria — Fase 1: Saúde técnica (2026-09-24)

## Ferramentas executadas
| Verificação | Resultado |
|---|---|
| Typecheck (`tsgo -p tsconfig.app.json`) | 0 erros |
| Lint (`eslint .`) | 0 erros; 19 → 17 avisos |
| Testes (`vitest run`) | 38 arquivos, 448 testes aprovados |
| Build de produção (`vite build`) | OK (4,3 s) |
| Navegador (Playwright): 11 rotas públicas/protegidas | sem erros de execução, sem respostas HTTP ≥ 400 |
| Links internos (`to`, `href`, `navigate`) × rotas do App | todos apontam para rotas existentes |

## Achados
| # | Prioridade | Achado | Ação |
|---|---|---|---|
| 1 | P4 | Aviso de dependência do `useEffect` em `PlansEditorTab` | Documentado como carga única intencional |
| 2 | P4 | Diretiva `eslint-disable` sem efeito em teste de acessibilidade | Removida |
| 3 | P5 | 15 avisos "fast refresh" (arquivos exportam componente + helper) | Sem impacto em produção; mantido |
| 4 | P5 | Aviso "Function components cannot be given refs" em toda árvore | Causado pelo marcador de componentes do editor, ativo só em desenvolvimento; ausente no build de produção (verificado) |
| 5 | P5 | `PlaceholderPage.tsx` sem uso | Código morto; mantido por ora |
| 6 | Info | 1 `console.log` (`useRenderLog`), só em modo dev | OK |
| 7 | Info | Listeners globais sem remoção (`unhandledrejection`, service worker) | Registrados uma vez por sessão; intencional |
| 8 | Info | `/app` sem sessão redireciona para `/auth/login`; rota inválida mostra 404 | OK |

Sem TODO/FIXME reais, sem `setInterval` sem limpeza, sem imports quebrados.

## NÃO TESTADO
- Telas autenticadas por perfil (painel, portal): o banco está zerado, sem estabelecimentos nem contas de equipe/cliente. Fica para a Fase 8.
- Web Push em aparelho real: precisa de celular físico.
