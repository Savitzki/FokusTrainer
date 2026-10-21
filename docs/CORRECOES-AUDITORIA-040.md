# Correções da auditoria — Arena, navegação e conquistas

## Auditoria e escopo

Base: `d34ae64` (main, PR #42), atualizada antes das alterações. O novo banner, `CapiboraMessage`, Não treinei hoje/tela dramática, kits, descansos, reagendamentos, Google, cadastro, critérios de treino/ofensiva, economia, conquistas e regras 039 de provocações foram preservados.

Problemas identificados:

- `ArenaInbox` consultava globalmente, mas restringia originais à Arena e priorizava revides independentemente da ordem de chegada.
- Sincronização dependia de retorno/foco e fallback compartilhado de 60 segundos, sem Realtime.
- Migração 037 autorizava Web Push apenas para revides e expunha a frase no payload.
- Preferências permaneciam em modal da Arena.
- Provocar usava apenas ícone; ficha repetia Criar grupo e colocava Desafiar antes de Remover amizade.
- Histórico de navegação aceitava `capiboraFrom` herdado por uma alteração externa do hash. `replaceState` podia conservar origem inválida; entradas diretas usavam destinos de fallback diferentes.
- Perfil mantinha editor/filtros/destaques; 28 mapeamentos de artes eram nulos, mesmo com PNGs disponíveis.

## Funcionamento corrigido

### Navegação

`navigation.ts` registra `capiboraAt` junto da origem da entrada. Voltar só usa o histórico quando a proveniência corresponde à URL atual e ao mesmo aplicativo; entrada direta ou estado inválido retorna ao Início com substituição, sem empilhar retornos. Hash/popstate, abas e parâmetros de grupos/amigos/Loja continuam existentes. Fragmentos desconhecidos de autenticação não são reescritos. Configurações, Perfil e Conquistas têm acesso explícito ao retorno. A ficha do amigo permanece sobre a lista, preservando sua rolagem e restaurando foco. Visitantes não montam Conquistas ou demais páginas privadas.

### Provocações globais

Uma única fila, ordenada por criação/ID, apresenta originais e revides em modal central. A mensagem em leitura fica fixada por ID e não é substituída por uma nova chegada. Conteúdo e expressão são os gravados no catálogo aprovado, sem novo sorteio ou edição. Fechar/X utilizam a operação existente de reconhecimento; apenas recibos são enfileirados offline. Revidar só aparece para originais elegíveis, mantém UUID de idempotência nas tentativas e aguarda confirmação real. Uma mudança de conta reinicia toda a fila.

A modal aguarda qualquer outro `dialog[open]`, o estado crítico da Home e escritas registradas na sincronização (exceto sua própria operação). Não interrompe autenticação, registro/avaliação, confirmação financeira, edição/salvamento ou ação destrutiva. Foco e rolagem usam o componente `Modal` existente.

`useArenaRealtime` mantém um canal por conta, removido no logout/troca. A tabela nova `arena_inbox_signals` transmite somente `user_id` e um contador. RLS permite apenas leitura da própria conta. Triggers sinalizam alterações de provocações, preferências e vínculos; as mensagens são consultadas novamente pela RPC autorizada. Rajadas são agrupadas por 100 ms. Reinscrição após reconexão força atualização; a sincronização compartilhada de retomada/60 segundos continua como fallback. Nenhuma tabela de mensagens foi aberta para leitura direta.

### Web Push

O dispatcher existente continua responsável pela entrega, sem novo Cron ou VAPID. Originais e revides elegíveis passam pelos mesmos opt-ins, silenciamento, amizade, validade de 15 minutos, horários 08:00–21:59:59 do dispositivo, limite de uma hora e recibos por evento/dispositivo existentes.

Título: **Capibora**. Corpo: **Psiu, alguém mandou uma provocação**. O dispatcher e o Service Worker impõem texto genérico; o sistema não recebe o conteúdo privado. O Service Worker usa `mascot/web/julgando.webp`, sem botões ou imagem grande. O toque abre o aplicativo; a fila global consulta e apresenta a mensagem após autenticação, sem exigir Arena.

Quando encontra uma janela visível do aplicativo, o Service Worker envia um sinal de sincronização e evita o aviso do sistema. Essa verificação é uma aproximação do estado do navegador, não uma garantia do backend; clientes visíveis sem sessão válida podem não apresentar a modal até autenticar. Falha ao consultar janelas mantém o push genérico. Dispositivos independentes preservam suas entregas.

### Configurações e amigos

Configurações → Provocações reutiliza a mesma RPC e componente de preferências, com carregamento, erro e confirmação. A Arena deixa de oferecer o acesso redundante. A privacidade das medalhas também fica em Configurações; salvar preserva integralmente os IDs destacados existentes.

Na lista, avatar/moldura e nickname ficam agrupados à esquerda; Provocar fica à direita, com texto. Já provocou é desabilitado e respaldado pelo servidor. O limite de uma provocação original por amigo/dia, o sorteio das cinco mensagens e o único revide separado da cota não mudaram. A ficha mantém dados compartilhados e mostra **Remover amizade | Desafiar**, com confirmação da remoção no mesmo modal. Criar grupo permanece na aba Grupos. Cadeados decorativos foram removidos do próprio Perfil, Dados da conta e ficha do amigo; bloqueios funcionais continuam.

### Conquistas

Perfil abre `#/conquistas`. A página reúne as sete categorias e as 28 conquistas, sem filtros. A grade mostra somente imagem e nome completo; bloqueadas ficam em cinza e continuam consultáveis. A modal apresenta apenas arte, nome, requisito, data real quando existente e X. Nada recalcula desbloqueios ou altera datas. O editor de destaques foi retirado; dados antigos e a privacidade do showcase continuam no servidor.

Foram encontrados **19 PNGs**, com **15 correspondências identificáveis**. Originais intactos; cópias WebP de entrega, aproximadamente 324 KiB no total. Há **9 artes ausentes** (seis de Consistência e três de Peso) e **4 associações sociais pendentes de confirmação**. A tabela completa por ID está em [CONQUISTAS.md](CONQUISTAS.md). Sem associação segura, permanece o fallback vetorial.

## Arquivos principais

- Navegação/integração: `src/navigation.ts`, `src/App.tsx`.
- Fila/transporte: `ArenaInbox.tsx`, `useArenaNotices.ts`, novo `useArenaRealtime.ts`, `sync.ts`.
- Preferências/amigos: `ArenaTauntPreferences.tsx`, `ArenaTauntButton.tsx`, `SocialPanel.tsx`, `FriendOptions.tsx`, `FriendProfile.tsx`, `ProfilePanel.tsx`, `arena.css`, `styles.css`.
- Coleção: novo `AchievementsPage.tsx`, `achievements.css`, `achievementArt.json`; `achievements.ts`, `GamificationPanels.tsx`; `public/images/achievements/web/`; `scripts/prepare-web-images.mjs`.
- Push: `public/sw.js`, `supabase/functions/_shared/taunt-delivery.ts`.
- Backend incremental: `supabase/migrations/202610210040_global_arena_notices.sql`.
- Testes: suítes de navegação, Inbox, Realtime, conquistas, gamificação, perfil, SocialPanel e Service Worker; `supabase/tests/global-arena-notices.sql`, `scripts/test-global-taunt-concurrency.sh`, integração nas suítes SQL existentes.

## Validação

- `npm test`: **911 testes Vitest e 5 verificações offline aprovados**, 91 arquivos; nenhuma falha final.
- `npm run build`: aprovado, TypeScript e produção; cache público de 72 arquivos / aproximadamente 2,46 MiB.
- `bash scripts/test-arena-db.sh`: aprovado em PostgreSQL 17 descartável, sem rede; incluindo migração 040, RLS, originais/revides, opt-in, silenciamento, idempotência e ausência de ganhos financeiros.
- `bash scripts/test-gamification-db.sh`: aprovado, incluindo regressão anterior, conquistas, treinos/kits/economia e concorrência da nova tabela de sinais.
- `bash scripts/test-profiles-db.sh`: aprovado; migrações antigas e configurações administrativas preservadas.
- Chromium real, contas sintéticas, RPC e WebSocket Supabase simulados: 320, 375, 390, 430, 768 e 1280 px, temas claro/escuro; coleção, modais, dados/datas, amigos, molduras, botões, recebimento por sinal Realtime, todas as páginas principais e adiamento durante outro formulário. Sem erro de console ou rolagem horizontal nesses cenários.
- Testes existentes de autenticação Google/e-mail, guest, treinos, kits, planos e desafios passaram. `git diff --check` aprovado. O projeto não possui comando de lint.

Falhas intermediárias eram expectativas antigas de “Criar grupo” na ficha, retorno direto a Treinos e payload privado do push, além de tipos de fixtures; foram atualizadas conforme os comportamentos novos. Não ficaram testes ignorados ou falhas essenciais abertas.

Capturas em [correcoes-auditoria](correcoes-auditoria/) são renderizações reais do Chromium com dados sintéticos. Não são testes em aparelhos físicos. Web Push real com Android/iPhone, múltiplos aparelhos e entrega por provedores não foi executado; o transporte foi validado por SQL descartável, testes do dispatcher e Service Worker. Realtime do navegador foi verificado com WebSocket simulado, sem criar contas de teste em produção.

## Implantação

Aplicar somente a migração **040** após a **039**, publicar a revisão do `push-dispatch` existente e o frontend/PWA. Não reaplicar migrações antigas, criar Cron, modificar segredos, ativar preferências ou distribuir recompensas. A publicação `supabase_realtime` deve existir e conter somente a nova tabela de sinais para este recurso; o script não publica conteúdo privado. Conferir ledger, RLS/grants, publicação e versão do dispatcher após a operação. O novo frontend mantém fallback de sincronização caso Realtime esteja indisponível.

A implantação segue a autorização permanente anteriormente dada para migrar/publicar. Testes funcionais destrutivos continuam restritos aos ambientes descartáveis. Estado efetivo de implantação e eventuais limitações são registrados abaixo após a verificação.
