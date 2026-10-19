# Plano semanal, calendário e descansos

## Estado desta entrega

A reformulação de Treinos depende da migração incremental [029 — planos flexíveis](../supabase/migrations/202610190029_flexible_training_plans.sql), sobre a 028. **A 029 está preparada, mas não foi aplicada em produção.** Esta solicitação exige autorização antes de alterar o banco real; a autorização geral de tarefas anteriores não substitui essa condição.

A interface e a migração devem ser publicadas juntas, aplicando primeiro a 029. O deploy automático de `main` não executa SQL; não publicar esse frontend antes da migração. Não há novo serviço, segredo ou dependência.

## Auditoria e compatibilidade

A tabela `training_plans` já aceitava de um a sete dias. As restrições de cinco estavam no formulário e na versão vigente de `save_training_plan`; `RescheduleTraining` ainda mostrava um aviso desatualizado sobre cinco dias. As definições antigas permanecem nas migrações históricas, sem serem reescritas.

| Sistema | Tratamento |
| --- | --- |
| Plano | Quantidade de 1 a 7; os demais dias são descanso |
| Versões e vigência | Primeiro plano imediato; substituições amanhã; revisões anteriores preservadas |
| Progresso semanal | Conta cada data obrigatória segundo a versão vigente, inclusive semanas de transição |
| Ofensiva | Soma apenas treinos obrigatórios concluídos; descansos/proteções preservam, sem pontos |
| Missões | Novos ciclos adaptados às obrigações efetivas; alvos emitidos permanecem congelados |
| Conquistas e relatórios | Reutilizam os tipos efetivos e snapshots existentes |
| Arena | Descansos e cronogramas individuais continuam válidos; resultados consolidados não mudam |
| Desafios aceitos | Bloqueio de substituições que alterem obrigações dentro do período em aberto |
| Notificações | Mantêm horário, preferências e guardas baseadas no tipo efetivo do dia |
| Confirmações e moedas | Mesmos métodos, duração mínima, recompensa única e validação no servidor |

Contas com cinco treinos mantêm exatamente seus dias. Também são preservados planos legados de outras quantidades. A 029 não atualiza linhas de planos, treinos, missões, moedas, kits, perfis ou grupos durante sua aplicação. Reutiliza as tabelas e a assinatura autenticada de salvamento.

## Personalizar o plano

Treinos mostra, nesta ordem, **Meu plano semanal**, **Calendário da ofensiva** e **Histórico de treinos**. O plano fica visível, sem exigir expansão.

1. Escolher quantos dias treinar, de **1 a 7**. A quantidade de descansos é `7 − treinos`.
2. Escolher exatamente essa quantidade entre segunda-feira e domingo. A seleção pode ser revisada; salvar fica indisponível enquanto a quantidade não corresponder.
3. Revisar a confirmação com os dias de treino, os descansos e a data real de vigência, baseada no dia retornado pelo servidor.
4. Tocar em **Confirmar e salvar**. Nenhuma escrita acontece antes disso, e não há sucesso antecipado.

Ao reduzir a quantidade, o editor mantém os primeiros dias já selecionados na ordem da semana. Ao aumentar, mantém os dias existentes e pede a escolha dos dias adicionais. A confirmação mostra o resultado antes de qualquer escrita. Escolher sete dias não é apresentado como recomendação de treinar diariamente.

Sem plano, o usuário pode navegar, mas os métodos manual e cronometrado continuam bloqueados pelo app e pelo servidor. O primeiro plano vale hoje. Se hoje for descanso, um treino voluntário permanece válido no histórico e recebe o tratamento existente, sem acrescentar ofensiva.

Um plano ativo permanece bloqueado. **Substituir plano** abre um editor temporário; alterações posteriores só começam amanhã. Uma substituição pendente pode ser substituída por outra revisão para a mesma data, sem excluir a anterior. Erros ou cancelamentos não deixam a conta sem plano nem alteram o dia atual.

## Regras por data e proteções

A ofensiva representa treinos obrigatórios consecutivos, atravessando descansos válidos:

- Treino obrigatório concluído: +1
- Descanso programado: mantém, sem somar
- Descanso por reagendamento: mantém, sem somar
- Treino compensatório: obrigatório na nova data; conclusão soma uma vez
- Falta encerrada sem proteção: interrompe
- Descanso extra autorizado ou Kit Médico: mantém, sem somar
- Treino voluntário em descanso: histórico preservado, sem ponto adicional

O dia atual pendente não é tratado como falta antes de encerrar. Uma substituição não restaura uma ofensiva já perdida. Semanas com dois planos podem ter quantidade efetiva diferente da quantidade semanal escolhida em cada versão; cada data é contada uma única vez.

Os limites atuais permanecem independentes: **2 reagendamentos por semana**, **2 descansos extras por semana** e Kits Médicos conforme estoque. Kits gratuitos mensais, preço de 250 potes, histórico e regras de consumo não mudam.

O reagendamento troca um treino não concluído por um descanso posterior na mesma semana, até domingo. Não altera o plano permanente, não gera moedas e não pode sobrepor treinos, proteções ou outra troca. Um plano de sete dias pode não ter descanso disponível para compensação. Uma substituição não pode invalidar as origens e destinos futuros: o erro indica as datas conflitantes. Como trocas confirmadas não possuem cancelamento nesta versão, preserve esses dias ou aguarde sua conclusão.

## Missões, recompensas e desafios

O ciclo semanal continua sendo emitido automaticamente, com no máximo três missões e recompensas configuradas no servidor. As metas de novos ciclos usam a programação efetiva, descansos e reagendamentos. Metas, bônus e recompensas já emitidos não são diminuídos nem sorteados novamente por alterar um plano.

A política interna `planningPolicy: 2` protege ciclos novos e o ciclo ainda aberto afetado por uma substituição confirmada. Na missão de cumprir o cronograma, uma data removida pelo novo plano não vira automaticamente uma tarefa cumprida. A missão reconhece o treino obrigatório confirmado, seu destino reagendado e proteções autorizadas. Ciclos históricos antigos mantêm a política anterior; recompensas já concedidas permanecem intactas.

Reduzir o plano durante um ciclo pode deixar uma meta anteriormente emitida sem possibilidade de conclusão naquela semana. O app não recomenda treinos extras para compensar essa meta e não concede recompensa fictícia; o próximo ciclo se adapta à nova rotina. Essa é a escolha conservadora para preservar metas congeladas e evitar manipulação da economia.

Critérios e cotas de desafios ativos não são recalculados. O servidor impede uma substituição permanente que reclassifique obrigações dentro de um desafio aceito ainda aberto. O erro lista as datas; escolhas compatíveis continuam permitidas. Reagendamentos existentes são tratados como exceções, e preservar o mesmo plano-base não causa conflito artificial. Resultados encerrados, empates, política de métodos aceitos e recompensas dos desafios permanecem como estavam.

Ofensivas dos grupos continuam usando o dia/fuso do grupo e os cortes de criação das revisões e proteções. Uma data que a Arena já consolidou, mesmo sendo futura no fuso da conta, não pode ser reclassificada pela substituição.

## Calendário confiável da ofensiva

O calendário remove ícones dentro das datas e a legenda extensa. Mostra o mês, navegação, hoje e seleção. A cor de ofensiva vem de `get_training_calendar(p_month, p_timezone)`, uma RPC autenticada que só consulta a própria conta.

A consulta reutiliza `gf_day`/`gf_days_between`, os mesmos snapshots usados por relatórios e conquistas. Usa o início real do acompanhamento para reconstruir o saldo da sequência antes do mês selecionado e então classificar as datas do mês. Consultar o calendário pode consolidar snapshots históricos ainda ausentes pelo mecanismo existente; não altera treinos ou resultados de grupos.

Um descanso ou proteção só aparece ativo quando existe uma ofensiva a preservar. Descansos anteriores ao primeiro treino obrigatório, descansos após uma quebra e treinos voluntários sem sequência anterior não inventam ofensivas. Dias futuros ficam neutros. Um treino pendente hoje pode manter a sequência até o encerramento do dia, sem ser apresentado como concluído.

Sem resposta ou cache confiável, a interface mantém as datas neutras e oferece nova consulta; não transforma todos os descansos em ofensiva. Após falha, um mês válido já exibido permanece disponível. O cache é separado por conta/mês, limpo no logout e atualizado após treinos, substituições, reagendamentos, descansos e kits. Respostas antigas não sobrescrevem outro mês ou outra conta.

Ao selecionar uma data, aparecem os detalhes compactos. **Ações do dia** reúne as funções existentes de reagendamento, descanso e consulta de kits; não há bloco grande repetindo a ação principal da Home.

## Histórico e cronômetro

O histórico fica aberto e ordenado do mais recente para o mais antigo, com data/ano, atividade, minutos, método, confirmação e avaliação quando preenchida. Registros antigos continuam classificados como **Registro anterior**, sem inventar método ou avaliação. A lista renderiza **20 registros por vez**, com **Carregar mais treinos** até o histórico completo.

A paginação é de renderização: a consulta social existente continua fornecendo os registros que o app já usa para os cálculos. Uma futura paginação de transporte deve preservar esses cálculos e não foi introduzida nesta reformulação.

O cronômetro permanece exclusivamente um método de confirmação oficial: mínimo configurável de 35 minutos, início e duração validados no servidor, uma sessão ativa, recuperação entre aparelhos e expiração de quatro horas. Não foi criado outro cronômetro, temporizador de intervalo ou nova aba. O fluxo principal de registro permanece na Home. Uma sessão ativa apresenta **Voltar ao treino** também nas demais abas, sem reiniciar ou cancelar ao navegar. O mínimo de duração é uma regra de produto, não uma recomendação universal de exercício.

## Arquivos e validação

- Planejamento: `src/training.ts`, `src/TrainingScheduleSettings.tsx`, `src/useTrainingPlan.ts`, `src/RescheduleTraining.tsx`
- Tela e calendário: `src/App.tsx`, `src/WorkoutCalendar.tsx`, `src/useTrainingCalendar.ts`, `src/styles.css`
- Histórico: `src/WorkoutHistory.tsx`
- Invalidação seletiva: `src/sync.ts`
- Banco: migração 029 e `supabase/tests/flexible-training-plans.sql`
- Regressão: testes de componentes/hooks, `scripts/test-gamification-db.sh` e `scripts/test-plan-concurrency.sh`

Os testes SQL usam PostgreSQL descartável, nunca fixtures no Supabase real. A suíte cobre frequências 1–7, validações, revisões e vigência, confirmações, moedas, metas congeladas, desafios, reagendamento de plano com um dia, snapshots mensais, descansos, kits, fuso e permissões. A regressão mantém os testes existentes de duração mínima, expiração, Arena, conquistas, compras e notificações.

Para ativar em produção: autorizar a 029, executar somente esse incremento sobre a 028, registrar a versão, conferir permissões e preservação dos dados, então publicar o frontend correspondente. Depois, fechar e reabrir a PWA online. A validação física em Android/iPhone continua necessária; os testes de navegador simulam viewport, fontes, sessões e respostas do Supabase.

Validação executada nesta entrega: **518 testes em 61 arquivos**, `npm run build`, suíte PostgreSQL completa com concorrência de aparelhos escolhendo frequências diferentes e **16 testes Deno** dos serviços de notificações. No Chromium, passaram quatro fluxos de conta nova/existente nos dois temas e **128 combinações de layout** dos passos de planejamento, calendário e histórico em 320/360/390/430 px, com fontes 100%/200%. Também foram conferidos histórico de 153 registros renderizado progressivamente, mudança de mês, recuperação da mesma sessão em outra tela/recarga e reabertura offline com cache da PWA local. APIs, contas e sessões dessas verificações visuais foram simuladas; nenhum dado real foi modificado nem foi enviada notificação.
