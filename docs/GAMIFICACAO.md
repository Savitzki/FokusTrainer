# Expansão de hábitos em cinco etapas

Implementação em React/TypeScript/Vite e Supabase, sem novas dependências. A navegação continua com Início, Treinos, Arena, Peso, Loja e Configurações. Não há diário, fichas, exercícios, séries, repetições ou cargas.

**As migrações 017–021 estão preparadas para revisão. Não foram aplicadas em produção.** O frontend identifica as capacidades disponíveis no servidor; preserva a interface anterior enquanto os novos RPCs não estiverem instalados. Kit Médico, carteira, saldo, registros e notificações existentes continuam usando os serviços atuais.

## 1. Missões semanais — 017

`gf_cycles` fixa a semana de segunda a domingo, datas planejadas, metas e preços das recompensas. `gf_missions` registra progresso e concessão por conta/ciclo/chave. A rotina se apoia em `training_schedule_kind` e `training_day_kind`, introduzidas pelo cronograma e reagendamentos existentes. A configuração 5/2 e os limites de reagendamento, descanso extra e kits continuam intactos.

| Missão | Meta inicial | Potes |
| --- | --- | ---: |
| Treine no seu ritmo | Menor entre três e os treinos planejados disponíveis no ciclo | 10 |
| Peso | Dois dias distintos, ou os dias restantes se houver menos | 10 |
| Cumpra sua semana | Todos os compromissos planejados, sem falta efetiva | 20 |
| Mantenha a chama viva | Nenhuma falta sem proteção durante a semana | 30 |
| Todas as missões | As quatro concluídas | 50 |

`gf_rules` centraliza os valores no servidor. Um ciclo já emitido mantém suas recompensas, mesmo após uma alteração administrativa. Não há RPC para o cliente enviar a quantidade de moedas ou declarar uma missão concluída.

Descansos programados, extras, kits e origens de reagendamento são válidos para consistência. O destino compensatório passa a ser obrigatório; não cumpri-lo impede as missões de compromisso/consistência. Treino voluntário em descanso não avança a missão de frequência. As metas de treino não diminuem ao editar o cronograma. Mudanças futuras e descansos válidos podem neutralizar compromissos, mas nunca apagam uma falta já encerrada. Missões de semana completa são apuradas após domingo; exigem pelo menos um treino obrigatório concluído. Uma semana totalmente protegida não gera essas recompensas.

O ciclo se renova na primeira sincronização da segunda-feira, e enquanto o app estiver visível há nova consulta a cada minuto. Ciclos anteriormente emitidos são finalizados no próximo acesso, uma única vez; não são inventadas missões para semanas em que a pessoa não recebeu um ciclo. O primeiro ciclo pode reconhecer atividades válidas da semana atual; não paga semanas anteriores à emissão. Pesagens importadas de dias antigos ou confirmadas depois do encerramento do dia não geram progresso retroativo nas missões. Várias pesagens no mesmo dia contam como um dia.

`economy_post` mantém o débito/crédito atômico e as chaves únicas do extrato. O resumo do Início abre as missões sem adicionar blocos ou rolagem à página principal.

## 2. Conquistas — 018

São 12 medalhas: primeiro/10/30/100/365 treinos obrigatórios; uma/quatro/dez semanas completas; novo recorde após o reconhecimento inicial; primeira amizade aceita, participação em grupo e desafio coletivo concluído. Semanas completas são contadas ao longo do histórico, sem exigir que sejam consecutivas.

As medalhas permanecem em `gf_badges` quando a ofensiva é quebrada. Históricos existentes são reconhecidos na primeira sincronização. `earned_at` indica a data de reconhecimento, `historical` distingue esse caso. **Medalhas não concedem moedas nesta versão**, inclusive para eventos antigos. O recorde anterior à entrada no sistema vira uma referência: precisa ser superado para ganhar essa medalha.

O perfil permite selecionar até três medalhas adquiridas. O compartilhamento com amigos fica desativado inicialmente e exige a escolha “Mostrar medalhas aos amigos”. `get_friend_showcase` verifica uma amizade aceita e retorna somente nick e medalhas destacadas autorizadas. Não retorna peso, e-mail ou preferências pessoais. Na Arena, a consulta é feita somente ao tocar no ícone da pessoa, evitando uma consulta para cada amizade ao abrir a tela.

## 3. Relatórios — 019

O botão de gráfico em Treinos abre períodos semanais/mensais, incluindo períodos anteriores. O RPC só consulta a conta autenticada. Mostra quantidade total e obrigatória de treinos, planejamento efetivo, cumprimento, minutos, duração média, ofensiva atual/recorde, semanas encerradas, histórico de missões e peso privado. Os gráficos usam SVG, sem biblioteca adicional.

Cumprimento = treinos obrigatórios concluídos / obrigações efetivamente devidas. Descansos extras e kits são excluídos do denominador; uma origem transferida não conta como falta e o destino conta normalmente. Hoje só entra no denominador depois de concluir; o futuro ainda não entra. A quantidade “programados” continua mostrando o período inteiro. Períodos em andamento são identificados, médias sem treinos são nulas e períodos sem obrigações mostram “—”, em vez de 100%. Semanas parciais de ingresso são excluídas do gráfico de comparação de semanas completas.

`gf_days` e `gf_weeks` são snapshots derivados e privados; a primeira consulta de dias encerrados usa o planejamento vigente no início daquele dia e autorizações anteriores ao seu encerramento. Depois disso, não reescreve o resultado. Os registros originais e os snapshots da Arena antiga não são modificados. O histórico anterior à ativação só permite inferir o que existe nos registros e revisões preservadas: horários ou planejamentos ausentes não são inventados.

## 4. Desafios — 020

Tipos: consistência, coletivo e frequência; duração de 7 ou 30 dias. Só é permitido convidar de um a sete amigos já aceitos. O criador já participa; os convidados precisam aceitar antes do início. Começa na primeira data que ainda seja futura para o criador e todos os convidados (normalmente amanhã; pode ser depois por diferença de fuso). Para uma amizade sem fuso fixado, UTC+14 é usado como limite conservador até o aceite. Cada participante mantém o fuso fixado da própria conta e a cota de pontos de frequência/coletivos é capturada ao aceitar. O aceite deve ocorrer antes da meia-noite inicial no fuso do convidado e do prazo do criador; o prazo exibido ao convidado já considera o menor desses horários. Não há alterações de regras ou participantes após o início.

- Consistência usa o cumprimento do próprio cronograma. Descansos válidos não são faltas. O denominador usa apenas as obrigações efetivas de cada data; descansos válidos e alterações futuras legítimas não são faltas. Revisões ou reagendamentos não podem reescrever dias encerrados. Sem obrigações ou sem treino concluído não há vitória nem recompensa. Empates por fração exata compartilham o primeiro lugar.
- Frequência conta no máximo um treino obrigatório por data e limita a pontuação à cota inicial. Treinos voluntários em descansos não dão vantagem. Não há incentivo para fazer treinos adicionais.
- Coletivo soma esses treinos válidos uma vez por pessoa/data. A meta precisa caber nas cotas aceitas. Sem dois aceites, ou se a meta coletiva não couber nos participantes aceitos, o desafio é cancelado sem recompensa.

O encerramento espera o fim do último dia em todos os fusos participantes. A apuração ocorre ao consultar a Arena; não exige um serviço externo ou Cron. O JSON de resultados é persistido e nunca recalculado após consolidado. Remover uma conta não muda o resultado consolidado dos sobreviventes. Pesos e minutos pessoais não entram no placar.

Recompensas padrão: participação com pelo menos um treino válido **2 potes**, vitória ou conclusão coletiva **+5**. No máximo **três desafios premiados por mês**, por pessoa, no fuso da conta. Tanto os valores quanto o limite ficam em `gf_rules`; os valores são fixados na criação de cada desafio. Há limite de três desafios abertos por criador e dez por participante. A classificação continua aparecendo mesmo após atingir o limite de moedas.

A criação e a consolidação serializam por uma trava própria, depois bloqueia as contas participantes em ordem de UUID, desafios e carteiras. Assim, aguarda registros de treino iniciados dentro do prazo e evita ciclos de bloqueio ao premiar várias contas. A primeira implementação usa uma fila global curta para operações de desafios; em escala maior, medir contenção antes de subdividi-la.

## 5. Loja cosmética — 021

Mantém o Kit Médico (250 potes e dois gratuitos mensais) e seu histórico. Acrescenta moldura comum (100), rara (250), moldura vinculada a medalha (250), estilos de compartilhamento (150) e tema Cobre (300), que preserva a identidade laranja e os modos claro/escuro.

`gf_items` guarda preços e pré-requisitos; `gf_inventory` mantém a compra permanente única por conta/item; `gf_equipped` mantém um item por categoria. Compra duplicada retorna a propriedade existente, sem novo débito. Desativar um item para novas compras não remove a propriedade anterior. Equipar/desequipar não custa moedas. Saldo, estoque e preço nunca são atualizados de forma otimista pelo cliente.

Molduras aparecem no avatar e no card exportado; estilos mudam o fundo/detalhes do compartilhamento. O tema só muda tons de destaque, preservando o fundo/safe area do PWA. A aparência equipada é sincronizada pela conta. A preferência claro/escuro permanece no aparelho, como antes. Cosméticos e novas áreas exigem conexão para consultar o estado confirmado após reabrir. Não existem dinheiro real, transferências ou compra de moedas.

## Ativação e validação

1. Revisar e autorizar a aplicação em produção. Conferir primeiro a estrutura real: migrações antigas aplicadas manualmente não devem ser reaplicadas para preencher o histórico.
2. Com 001–016 instaladas, aplicar **017 → 018 → 019 → 020 → 021** em ordem, pelo mecanismo de migrações/SQL Editor. São incrementais e transacionais; executar uma vez por versão. Não rodar o bundle antigo `ATUALIZAR-BANCO.sql` em um projeto existente.
3. Publicar o frontend dessa mesma revisão após as migrações. Durante aplicação gradual, os recursos sem capacidade correspondente ficam ocultos; a interface antiga funciona.
4. Fazer uma verificação com uma conta de teste autorizada: missões, perfil, relatório, convites aceitos, compra e equipamento. Conferir extrato e permissões. Fechar e reabrir o PWA para atualizar.

As novas tabelas têm RLS habilitada e acesso direto revogado. Helpers são privados; RPCs verificam `auth.uid()`. A revisão do frontend não muda dados de produção. Os horários do navegador só servem para apresentação; o servidor decide ciclos, datas, aceite e recompensas.

Comandos: `npm test`, `npm run build`, `bash scripts/test-gamification-db.sh` (PostgreSQL 17 descartável sem rede, incluindo concorrência) e `bash scripts/test-profiles-db.sh` (regressão SQL anterior). Requerem Node, Docker e `rg`/ripgrep, utilizado pelas verificações de concorrência anteriores; o workflow instala essa dependência. As fixtures usam apenas contas fictícias em transações revertidas/contêineres removidos. Nenhum comando de teste usa credenciais ou dados do Supabase real.


## Arquivos e evidências da implementação

| Área | Arquivos principais |
| --- | --- |
| Missões e contratos | `src/gamification.ts`, `src/useGamification.ts`, `src/GamificationPanels.tsx`, migração `202610170017_weekly_missions.sql` |
| Medalhas e privacidade | `src/GamificationPanels.tsx`, `src/ProfilePanel.tsx`, `src/ChallengesPanel.tsx` (consulta de amigo), migração `202610170018_achievements.sql` |
| Relatórios | `src/ProgressReports.tsx`, `src/WorkoutCalendar.tsx`, migração `202610170019_progress_reports.sql` |
| Desafios | `src/ChallengesPanel.tsx`, `src/SocialPanel.tsx`, migração `202610170020_friend_challenges.sql` |
| Cosméticos | `src/GamificationPanels.tsx`, `src/EconomyPanel.tsx`, `src/SharePanel.tsx`, `src/sharing.ts`, migração `202610170021_cosmetic_shop.sql` |
| Integração | `src/App.tsx`, `src/backend.ts`, `src/economy.ts`, `src/styles.css`; README e guia de cronograma |
| Testes | `src/gamification.test.tsx`, fixture e cinco suítes `supabase/tests/gamification-*.sql`, `scripts/test-gamification-db.sh`, `.github/workflows/gamification-tests.yml` |

Validação local: **276 testes do app em 39 arquivos passaram**, `npm run build` passou, as cinco suítes SQL passaram e duas sessões autenticadas concorrentes compraram o mesmo item e apuraram a mesma missão com **um único débito, um item e uma recompensa**. A suíte SQL anterior completa também passou, incluindo perfis, pesos imutáveis, grupos, snapshots, reagendamentos, push e kits mensais.

Chromium em 320/390 px, nos dois temas, conferiu contratos gerados pelos RPCs do PostgreSQL, Início sem rolagem extra, quatro missões, relatórios/privacidade do peso, medalhas com consentimento, cosméticos (compra/equipamento/recarga) e desafios (aceite/criação). A API do navegador foi integralmente interceptada; nenhum teste criou contas ou modificou dados no Supabase real. O popup de medalhas dos amigos também respeita a largura da tela. Os scripts/fixtures de conferência visual são locais em `/tmp`; as regras críticas e a regressão de interface têm os testes versionados acima.

Não executado nesta entrega: aplicação/validação das migrações no Supabase de produção, envio real de Web Push ou teste num Android físico. A aprovação para migrar produção permanece necessária. Web Push conserva as dependências de configuração anteriores. A primeira sincronização de uma conta antiga pode processar mais histórico; acompanhar tempo de consulta e contenção da fila de desafios ao ampliar a base. Não há recompensas retroativas de medalhas, nem novos ciclos premiados para semanas anteriores à emissão.
