# Arena — evolução incremental (não implantada)

## Auditoria e contratos preservados

- `social.ts/useSocial` e `SocialPanel.tsx`: amizades por nickname/código, solicitações, grupos até 8 pessoas (criador + 7), 20 grupos abertos por criador. RPCs: `get_social_state`, `create_streak_group`, `reply_group_invite`, `close_streak_group`, `send_friend_request*`, `reply_friend_request`.
- Tabelas: `friendships`, `streak_groups` (criador/owner_id confiável), `group_members`, `group_days`. O fechamento atual por qualquer membro arquiva todo o grupo: será substituído por saída individual e encerramento administrativo distintos.
- Ofensiva: `social_refresh_day`, `social_streak`, `training_day_kind`, revisões de `training_plans`, `training_reschedules`, `training_extra_rests`, `medical_kits`. `group_days` consolidados não serão reescritos. `gf_badge_memberships` (032) já rastreia aceites e saídas sem inventar datas antigas.
- Desafios: `gf_challenges`, `gf_challenge_members`, `gf_challenge_metric/board/settle`, `create_friend_challenge`, `create_recording_challenge`, `reply_challenge_invite`, `get_friend_challenges`. Até 8 participantes; 3 abertos por criador e 10 por participante. Legados: 7/30 dias, frequência limitada ao planejamento, recompensas congeladas em `rewards`; `recording_policy=any/timed`. Permanecem legados, inclusive resultados e critérios de conquista coletiva.
- `gf_days/gf_weeks`, moedas e conquistas não são redefinidos. A confirmação continua única por conta/data, servidor, mínimo 35 minutos manual/cronometrado e expiração 4 horas.
- Notificações existentes: lembretes de treino/peso (`push_devices`, `push_jobs`, recibos locais) e avisos opcionais de treino para o grupo (`group_workout_events`, `group_push_jobs`). Edge Functions `push-dispatch` e `group-notify`. Não há push próprio de convites de amizade/grupo/desafio. Nenhum novo push, Edge Function ou cron será ativado nesta entrega.
- Frontend: `ChallengesPanel`, `ArenaGroupBanner`, `ArenaAvatar`, `GroupReactions`, `Mascot`, hooks de recursos sincronizados e invalidação seletiva serão reutilizados.

## Fase 1 — decisões

Administrador inicial: `streak_groups.owner_id`, sempre presente e referenciado ao perfil; não se inventa criador. Uma transferência muda o administrador atual, mantendo `original_owner_id` e auditoria. Só administrador renomeia/remove/transfere/encerra; qualquer integrante aceito convida amigos aceitos, respeitando 8 vagas incluindo convites. Saída não encerra grupo com outros membros; administrador transfere antes. Dados consolidados permanecem.

Meta: segunda a domingo no fuso fixo do grupo. 80% arredondado para cima da soma das obrigações efetivas congeladas; zero obrigações = sem meta, nunca sucesso automático. Grupos já ativos iniciam acompanhamento na ativação, sem reconstruir resultados anteriores. Grupo ativado no meio da semana usa apenas os dias restantes, incluindo o dia de ativação. Novos aceites depois da abertura entram no próximo ciclo. Planos/reagendamentos conhecidos na abertura determinam a meta; alterações posteriores não reduzem o denominador. A seleção das versões usa o instante de abertura, não o relógio do cliente. Sem plano nesse instante: zero obrigações. Participantes e fusos ficam no snapshot. Treinos confirmados no intervalo do grupo contam uma vez por conta/data, inclusive voluntários; descanso/kit não contam. Saída não muda o snapshot em andamento. Histórico encerra de forma preguiçosa na próxima consulta, sem cron e sem aceitar treinos confirmados depois do fim. Se uma conta estiver com confirmação em andamento, a consolidação é adiada com `SKIP LOCKED` até uma nova consulta, evitando perder um treino válido ou inverter a ordem de locks.

Remover amizade altera o vínculo para `declined` preservando o registro. Cancela transacionalmente desafios não consolidados 1x1, inclusive convites, sem vencedor/pagamento. Em disputas com 3+ pessoas, encerra a participação de quem remove (sem transferir pontos), mantém os demais e cancela se restarem menos de dois. Resultados consolidados permanecem. Grupos compartilhados não são removidos.

## Validação entre fases

A Fase 1 foi validada antes de iniciar a Fase 2: **726 testes em 76 arquivos**, build e SQL descartável passaram. As suítes foram ampliadas novamente na integração final.

## Fase 2 — regras novas e compatibilidade

`gf_challenges.rule_version=1` identifica desafios anteriores. Suas datas (inclusive 30 dias), cap de frequência, política any/timed, resultados e recompensas já congeladas continuam válidos. A migração não os encerra nem concede pagamentos. A liquidação normal de um desafio legado continua respeitando sua promessa anterior.

Desafios novos são versão 2, aceitam **7, 14 ou 28 dias** e têm `rewards={participation:0,winner:0}` com constraint no banco. Nenhuma carteira, preço ou regra geral é alterada. Os endpoints antigos de criação também encaminham para a versão 2: um cliente desatualizado não consegue criar um novo desafio remunerado ou de 30 dias.

- **Quantidade:** toda confirmação válida no período, inclusive voluntária, uma por conta/data. Sem desempate por horário. O limite é a confirmação diária já existente, não novos registros ou sessões extras.
- **Consistência:** dias planejados ficam em `gf_challenge_members.planned_days` no envio do criador e no aceite de cada convidado. Uma alteração permanente posterior não reduz essa referência. Um reagendamento válido acompanha a compensação; não conta origem e destino. Proteções autorizadas neutralizam obrigações, sem conceder treino realizado. Compensações fora da janela do desafio não pontuam nessa janela e neutralizam a origem; não prolongam a disputa ou alteram resultados encerrados. O denominador ajusta apenas essas exceções legítimas, não alterações permanentes do plano. Denominador zero retorna `null`, sem posição perfeita. A média/porcentagem exibida refere-se ao período inteiro, não só aos dias já decorridos.
- **Coletivo:** preserva a métrica anterior de treinos obrigatórios confirmados e o limite da quota aceita, sem incluir voluntários. É uma meta compartilhada, sem declarar um vencedor individual. O servidor valida a viabilidade dos planos e cancela por participação insuficiente quando o prazo dos convites termina. Não reduz silenciosamente uma meta após desistências.
- Ambos os métodos de treino são aceitos quando a política é `any`; `timed` conta somente confirmações cronometradas. Nenhum cronômetro novo foi criado.
- A data inicial comum é posterior ao dia atual de todas as contas, nos fusos fixados. Para uma conta ainda sem fuso, usa-se UTC+14 como limite conservador. O prazo de aceite é a primeira abertura dessa data entre os participantes, impedindo entrada depois de alguém já poder pontuar. Cada confirmação é avaliada no fuso fixo da respectiva conta. A consolidação espera o término do último dia de todos os participantes.
- Uma faixa serial de transação já existente, locks de linha, recibos e uma chave única de convite aberto impedem consumo simultâneo de limites, duplicações e corridas com remoção de amizade. Os limites anteriores de 3 desafios abertos por criador, 10 por pessoa e 8 integrantes permanecem.

### Desafio rápido, resultado e revanche

`Desafiar` nas opções do amigo abre o formulário existente, com o amigo selecionado. Nada é enviado antes de confirmar. A aba Desafios mostra convites, ativos/programados, encerrados e cancelados. Resultados usam exclusivamente as posições consolidadas pelo servidor; empates continuam compartilhando a posição e cancelamentos não possuem vencedor.

A revanche 1x1 exige um desafio concluído, não cancelado, dois integrantes originais aceitos e amizade atual. Reutiliza as escolhas no editor e exige novo envio e aceite. Não transfere pontos. Uma revanche de legado de 30 dias propõe 28 dias e informa a adaptação antes do envio. Participantes e regras podem ser revisados. Resultados antigos permanecem.

O compartilhamento ocorre somente pelo botão do usuário, usando Web Share ou cópia de texto. Inclui nome do desafio, período, nicknames e pontuações; não inclui peso, e-mail ou outros dados pessoais. Avatares e molduras são reutilizados do estado social/perfil já disponível. O backend fornece apenas a chave da moldura habilitada para os demais participantes, sem repetir fotos base64 em dezenas de desafios. Quando a foto não está disponível, usa as iniciais existentes.

### Provocações e push opcional

Catálogo fechado: `doubt` → **Duvido**, `watching` → **Quero só ver...**, `sure` → **Sei...**. São reações neutras, sem afirmar treino realizado, posição, atraso ou falta. O cliente envia somente o ID; o servidor valida a frase, a amizade e o silenciamento.

- Máximo de 3 envios por remetente/destinatário/dia no fuso fixado do remetente (UTC se não configurado).
- UUID estável por envio; reenvios não criam outra mensagem nem consomem novo limite.
- Caixa da Arena independente de push, últimos 20 itens por consulta. Retenção lógica de 30 dias e no máximo 100 mensagens armazenadas por destinatário; limpeza durante envios. Contadores e recibos independem da limpeza das mensagens.
- Silenciamento geral das provocações e preferência separada para push. Push desligado por padrão tanto na preferência quanto na regra de serviço.
- Inbox atualiza ao abrir/retomar a Arena e pela sincronização existente. Não há chat, polling contínuo ou garantia de entrega instantânea com a Arena permanentemente aberta.
- A extensão **preparada** de `push-dispatch` reutiliza Web Push existente. Exige aparelho autorizado/ativo, amizade ainda aceita, preferência habilitada, ausência de silenciamento, serviço habilitado, mensagem não vista e recente. Silêncio entre 22h e 8h; no máximo uma tentativa por aparelho/hora, agrupando mensagens próximas.
- A fila é exclusiva por evento/aparelho e a reserva retorna apenas os jobs criados naquela chamada. Há revalidação imediatamente antes da entrega. A política é uma tentativa por evento: timeout incerto não é reenviado automaticamente, evitando notificações duplicadas; a mensagem continua na Arena.
- Não houve deploy de Edge Function, criação de cron, disparo de teste em contas reais ou habilitação de push. Convites sociais continuam sem tipos novos de push.

## Estruturas e RPCs adicionados

**033:** `original_owner_id`, `cancel_reason`, `withdrawn_at`; `arena_group_cycles`, `arena_group_receipts`; índice de histórico de participação. `arena_group_command`, `remove_friend`, helpers privados de planejamento/metas e wrappers compatíveis dos endpoints sociais. O administrador é derivado de `owner_id`, garantindo um único papel administrativo por grupo, sem duplicação de papéis em linhas concorrentes.

**034:** `rule_version`, `rematch_of`, `invitation_key`, `planned_days` e resultado do recibo; catálogo, preferências, mensagens, contadores, regra e fila opcional de provocações. `create_arena_challenge`, `send_arena_taunt`, `get_arena_inbox`, `acknowledge_arena_taunt`, `set_arena_social_preferences`. Liquidação/métricas são privadas e versionadas. As três RPCs de entrega opcional ficam restritas a `service_role`.

Tabelas novas têm RLS e não concedem acesso direto a `anon`/`authenticated`. Operações públicas usam `social_require_profile()`/`auth.uid()`. Funções `security definer` fixam `search_path=public,pg_temp`. Não foram modificadas migrações históricas ou tabelas de treinos, moedas e conquistas.

## Arquivos

- Reutilizados e adaptados: `src/SocialPanel.tsx`, `src/ChallengesPanel.tsx`, `src/App.tsx`, `src/social.ts`, `src/gamification.ts`, `src/useGamification.ts`, `src/sync.ts`, `src/styles.css`, `public/sw.js`, `supabase/functions/push-dispatch/index.ts`.
- Novos componentes: `ArenaGroupTools`/`GroupWeeklyGoal`, `FriendOptions`, `ArenaInbox`, `ChallengeResult`; catálogo/contrato `src/arenaTaunts.ts`.
- Reutilizados sem alterar regras: `ArenaGroupBanner`, `ArenaAvatar`, `Avatar`, `GroupReactions`, `Mascot`, `Modal`, navegação e hooks de sincronização.
- Migrações: `supabase/migrations/202610200033_arena_groups.sql`, `202610200034_arena_interactions.sql`.
- Testes: `src/ArenaGroupTools.test.tsx`, `src/arenaInteractions.test.tsx`, testes existentes de SocialPanel/ChallengesPanel/service worker; `supabase/tests/arena-*`; `scripts/test-arena-db.sh`, `scripts/test-arena-concurrency.sh`. O runner completo de gamificação inclui as fases novas depois dos contratos legados. `vite.config.ts` inclui os testes do helper opcional de entrega.

## Implantação — pendente de autorização

1. Revisar as duas migrações e esta documentação; testar primeiro em staging com dados descartáveis. A dependência anterior é a **032**, que já fornece a auditoria de participação.
2. Após autorização explícita, aplicar a **033** uma única vez e registrar a versão. Conferir criadores/admins, conservação de `group_days`, desafios, amizades e saldos; testar a Fase 1 em staging.
3. Aplicar a **034** após a 033 e registrar a versão. Conferir RLS/ACLs, contratos, `rule_version=1` dos legados, recompensas zero nos novos e serviço de provocações desligado.
4. Publicar o frontend correspondente. `arenaVersion` protege os recursos novos durante a transição. Não publicar somente o frontend antes das migrações.
5. Push é opcional: exige autorização separada para atualizar a Edge Function existente `push-dispatch` e habilitar `arena_delivery_rules.taunt_push_enabled`. Mantém VAPID, permissões e agendador existentes; não é necessário outro cron. Sem essa etapa, provocações continuam entregues dentro da Arena.
6. Validar com contas de teste autorizadas os fluxos mobile/PWA e monitorar erros/latência. Não simular remoções, cancelamentos ou pontuação usando usuários reais.

Rollback: cada migração é transacional; uma falha durante a aplicação reverte a etapa. Depois de tráfego novo, preferir correção incremental e desabilitar o push opcional. Não derrubar tabelas de snapshots, recibos ou mensagens para reverter interface, nem converter desafios versão 2 em versão 1. Não reaplicar migrações já executadas.

## Validação concluída e limites

- `npm test`: **738 testes em 78 arquivos**, sem falhas, incluindo o helper opcional de push. Há cobertura de navegação/abas, solicitações, confirmação de remoção, transferência, metas zero, convites/revanche, catálogo social alinhado ao servidor, resultados e uso do estado do servidor no aceite.
- `npm run build`: passou. Permanece o aviso de bundle principal acima de 500 kB (aproximadamente 533 kB, 163 kB gzip), sem adicionar bibliotecas ao aplicativo.
- `bash scripts/test-arena-db.sh phase1`: passou antes da Fase 2. `bash scripts/test-arena-db.sh` passou na integração: criadores legados, snapshots de 80%, planos posteriores, entrada/saída, papéis, recusa, fusos, meta zero, desafios 1x1/múltiplos, durações, ambas as políticas de registro, proteções, compensações, pontuação cooperativa e empates.
- `bash scripts/test-gamification-db.sh`: regressão completa em PostgreSQL 17 descartável, incluindo contratos anteriores e os testes novos após aplicar 033/034.
- Concorrência real em conexões separadas: convite único, três de quatro provocações aceitas, remoção versus criação de desafio, transferência única, snapshot único e fechamento semanal adiado enquanto um treino está pendente de commit.
- Conservação dos registros foi verificada por hashes antes/depois das migrações, excluindo apenas colunas novas. Uma liquidação **sintética** de desafio versão 1 manteve a recompensa histórica; desafios versão 2 não geraram movimentos financeiros. Não foram alterados nem premiados usuários reais.
- Chromium com APIs interceptadas e dados sintéticos: **8 cenários**, 320/375/430/1024 px, claro/escuro e movimento reduzido. Abas, meta, confirmação administrativa/cancelar, escolher/enviar provocação, atalho de desafio e resultado empatado passaram sem overflow horizontal ou erros de console. Ilustrações oficiais existentes foram reutilizadas e verificadas visualmente.
- Não foram executados envios reais de push, integração com provedores, testes em aparelhos Android/iPhone físicos ou as suítes antigas específicas do runtime Deno (indisponível neste ambiente). O helper novo foi testado pelo Vitest; a publicação da Edge Function requer validação em staging.
- Nenhuma migração, Edge Function, cron ou frontend desta entrega foi ativado em produção. Os dados novos permanecem dependentes da implantação autorizada.
