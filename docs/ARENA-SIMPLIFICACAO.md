# Arena: amigos, provocações diárias e histórico

Implementação incremental sobre o redesign existente. **Migração 039 autorizada e aplicada em produção em 20/10/2026, às 22:29 UTC. O frontend da PR #40 ainda aguarda publicação.** Nenhuma mudança em treinos, ofensivas, planos, kits, conquistas, economia ou critérios de vitória.

## Auditoria e contratos preservados

A Arena continua nas três abas e no roteamento hash existente (`aba`, `grupo`, `amigo`). `SocialPanel` controla a aba e os fluxos sociais; `ChallengesPanel` mantém a consulta e a criação de desafios. Não há hooks/RPCs paralelos.

A ficha já tinha apresentação modal, mas a Arena estava usando o painel. Os desafios usavam `details/summary` para ativos, convites e histórico. As provocações eram escolhidas no navegador e compartilhavam a cota de três envios com os revides (034/037).

Reutilizados: `Modal`, `FriendProfile`, `FriendOptions`, `ArenaAvatar`/`Avatar`, `ProfileCover`, `AchievementMedal`, `ArenaChallengePreview`, `ChallengeResult`, catálogo visual oficial e sincronização existente. Grupos, convites, gerenciamento e metas não foram modificados.

## Amigos e ficha

- Lista sem “Ver ficha”, menu de três pontos ou contador de amigos. Avatar e nickname são um único botão; provocação é um botão separado, sem botões aninhados.
- Ficha em modal fixa, fechada pelo X, mantendo a lista montada. Abrir a ficha dentro da Arena preserva a rolagem; fechar restaura foco ao amigo quando ele continua disponível.
- Ações explícitas: Desafiar, Remover amizade e Criar grupo. A remoção troca o conteúdo da mesma modal por uma confirmação; não há segunda modal sobreposta. X bloqueado durante a operação.
- O RPC `remove_friend` e seus efeitos transacionais permanecem inalterados. Desafios 1 contra 1 em aberto são cancelados sem vencedor; grupos e resultados antigos permanecem.
- Desafiar e Criar grupo transitam para os fluxos existentes, fechando a ficha. Fotos, molduras, banners e medalhas continuam provenientes do perfil compartilhado autorizado.

## Provocações: servidor como fonte de verdade

A 039 mantém `send_arena_taunt(uuid,text,uuid)` por compatibilidade. O cliente envia `p_message=null`; qualquer valor recebido por clientes antigos é ignorado na escolha. O servidor sorteia, via `order by random()`, somente os cinco IDs novos com `original_eligible=true`, nunca os IDs antigos ou `reply-back`.

| ID estável | Expressão existente |
| --- | --- |
| gossip-defense | suspicious |
| gossip-photo | judging |
| gossip-streak | impatient |
| gossip-fork | suspicious |
| gossip-water | judging |

Os textos exatos ficam em `src/arenaTauntCatalog.json` e na migração; um teste compara os dois catálogos e fixa as cinco redações aprovadas. As expressões acima usam os aliases oficiais já existentes da arte `julgando.webp`; nenhuma imagem foi inventada.

O envio só acontece após confirmar na modal, que não revela nem permite escolher a mensagem. Há guarda de envio simultâneo e UUID estável ao tentar novamente após falha. A confirmação visual só aparece após resposta positiva do servidor.

### Cota e virada do dia

- Reutiliza `arena_taunt_limits` e sua chave única `(sender,recipient,day)`. Uma inserção por par/dia; conflito bloqueia o segundo original.
- A data vem de `training_accounts.time_zone`, com o fallback UTC já existente para conta sem configuração. Não recebe data do navegador.
- O advisory lock transacional existente serializa cotas, recibos e revides. Repetir o mesmo recibo não sorteia novamente nem consome outro dia.
- `get_social_state()` acrescenta `tauntAllowance`: dia, instante consultado, próxima meia-noite e destinatários já provocados. Não são necessárias consultas por amigo.
- O botão usa esse snapshot: ícone de confirmação e label acessível “Já provocou hoje”. O controlador renova o snapshot no prazo informado pelo servidor, compensando diferença do relógio local. Retomada, sincronização entre dispositivos e troca de conta continuam na infraestrutura existente.
- **Transição conservadora:** cotas já gastas antes da 039 não são zeradas. Como o contador antigo incluía revides, quem já usou essa cota pode permanecer bloqueado para um novo original até a próxima meia-noite. Depois da migração, revides nunca escrevem nesse contador. Não há reconstrução arriscada do fuso histórico nem reposição de cotas durante a implantação.

### Recebimento e compatibilidade

Mensagens e recibos anteriores não são alterados. Os IDs antigos continuam no catálogo para mensagens pendentes/históricas. A caixa de entrada **v3** inclui o novo catálogo; v1/v2 continuam filtrando os novos IDs para não quebrar PWAs antigas. O texto é lido pelo ID gravado, sem novo sorteio na leitura.

Cada original continua aceitando um único revide, protegido pelo índice único existente. Revides não consomem a cota original, inclusive quando ela já foi usada. Não se pode revidar um revide. Amizade aceita, silenciamento, expiração, autorização e recibos continuam sendo verificados no servidor.

Originais continuam como avisos nas telas da Arena. Revides continuam na modal global, inclusive no Início. **Não foi criada apresentação adicional de originais no Início**, nem novo sistema de notificações. Push opcional continua restrito aos revides segundo a infraestrutura atual, preferências, horário de silêncio e limite existente. Nenhuma flag, Edge Function, Cron ou horário de push foi alterado/ativado.

## Desafios

- Sem contador de ativos sob o título. Convites continuam com contagem no filtro, sem repetição no conteúdo.
- Ativos/programados são artigos sem expansão, “Detalhes”, seta ou cursor de ação. VS, avatares/molduras, pontuações, estado e prazo ficam visíveis; coletivos mantêm missão/progresso. Classificação com vários competidores continua visível. Regras e aceite/recusa dos convites permanecem acessíveis diretamente.
- Histórico usa botões compactos sem avatares/classificação, com nome, modalidade/tipo e estado real (concluído, empate, cancelado, participação encerrada ou resultado cooperativo).
- O botão abre uma modal X com regras, início, encerramento previsto e encerramento efetivo quando informado. O contrato atual não fornece data de criação: ela não é inventada nem inferida do prazo de convite.
- Vencedor único consolidado (`board.place=1`) de duelo recebe avatar de 60 px, demais de 48 px, nome e troféu. Não compara pontuações no cliente para escolher vencedor. Empates mantêm tamanhos iguais; cancelamentos não celebram; cooperativos mostram resultado coletivo.
- Revanche fecha a modal e abre o formulário existente para revisão. Regras de elegibilidade, UUID, durações e convites continuam iguais. Compartilhar continua exigindo ação do usuário, sem dados de peso/e-mail.

## Arquivos

Apresentação: `ArenaFriends.tsx`, `ArenaTauntButton.tsx` (novo), `FriendOptions.tsx`, `FriendProfile.tsx`, `SocialPanel.tsx`, `ChallengesPanel.tsx`, `ArenaChallengeDetails.tsx` (novo), `ArenaChallengePreview.tsx`, `ChallengeResult.tsx`, `ArenaAvatar.tsx`, `arena.css`.

Catálogo/sincronização/navegação: `arenaTauntCatalog.json`, `arenaTaunts.ts`, `social.ts`, `sync.ts`, `useArenaNotices.ts`, `navigation.ts`.

Testes: `ArenaTauntButton.test.tsx` (novo), `ArenaInbox.test.tsx`, `arenaInteractions.test.tsx`, `SocialPanel.test.tsx`, `ChallengesPanel.test.tsx`, `ArenaChallengePreview.test.tsx`, `ArenaGroupTools.test.tsx`, `social.test.tsx`, `navigation-history.test.tsx`; fixtures SQL `arena-daily-taunts-legacy.sql` e `arena-daily-taunts.sql`; `test-daily-taunt-concurrency.sh` e integração nos runners de Arena e gamificação.

## Implantação e limites

1. Migração incremental `supabase/migrations/202610200039_random_daily_taunts.sql` aplicada após autorização explícita, sobre a versão 038. Não reaplicar.
2. Ledger e contratos conferidos por leitura após o commit; arquivo registrado corresponde exatamente ao código revisado.
3. Publicação do frontend da PR #40 pendente de autorização. O backend já está pronto para a caixa de entrada v3 e o snapshot de cota; clientes antigos continuam compatíveis.
4. Não é necessário deploy de Edge Functions, Cron ou configuração de push.

A migração é transacional e mantém RLS/grants existentes; os helpers continuam privados. Falha antes de commit reverte todas as mudanças. Para rollback de frontend, mantenha o catálogo e a cota mais restrita no banco: apagar IDs novos invalidaria mensagens enviadas. Qualquer reversão de regras de servidor exige revisão separada.

## Validação executada

- `npm test`: 846 testes Vitest em 87 arquivos, mais 4 testes de assets offline, sem falhas.
- `npm run build`: TypeScript, Vite e service worker concluídos; 53 arquivos no cache offline, 2,12 MiB.
- `bash scripts/test-arena-db.sh`: regressões da Arena e migrações até 039 em PostgreSQL descartável, sem falhas.
- `bash scripts/test-gamification-db.sh`: suíte SQL completa usada no CI, incluindo as novas verificações e concorrência, sem falhas.
- Chromium: 320, 375, 390, 430, 768 e 1280 px, temas claro/escuro; abas, ficha e confirmação sem sobreposição de modais, provocação após confirmação, cota retornada pelo servidor, convites, histórico, vencedor/empate, foco e transição para revanche. Sem erros de console ou rolagem horizontal nas verificações.
- `git diff --check`: sem erros de whitespace.

Os testes SQL executam somente em PostgreSQL 17 descartável, sem portas/rede externa; incluem concorrência real. Capturas reais de Chromium usam APIs interceptadas e contas sintéticas. Não houve validação em aparelhos físicos nem envio de push real. Não há script de lint no projeto; o build inclui verificação TypeScript.

## Registro da migração autorizada

Em 20/10/2026, às 22:29:51 UTC, a 039 foi executada em uma transação e registrada em `supabase_migrations.schema_migrations`, junto ao conteúdo exato do arquivo revisado. SHA-256 do arquivo: `40312b177e38e6e21dc14c87189ab88fcc206b24e8a9d45db398b243349cb66a`.

Antes da execução, a conferência somente de leitura confirmou 038 como última versão e as três funções idênticas às definições revisadas. Na própria transação, snapshots consistentes verificaram a preservação de registros das 49 tabelas públicas existentes fora do catálogo, cotas, recibos, oito mensagens históricas, funções fora do escopo, RLS, políticas e grants. Qualquer divergência abortaria o commit. Nenhuma conta real foi usada para simular envios ou remoções.

Após o commit, uma nova consulta de leitura confirmou ledger, corpos das três funções e correspondência exata de IDs, textos, poses e elegibilidade com o catálogo do frontend: cinco originais sorteáveis e oito entradas históricas. Não houve envio de provocações/push, deploy de Edge Functions, criação de Cron, alteração financeira ou publicação do frontend nesta etapa.
