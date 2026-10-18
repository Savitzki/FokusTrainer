# Registro de treinos

A migração incremental **023**, `202610180023_workout_recording.sql`, amplia o registro existente. Foi autorizada e aplicada à produção em **18/10/2026** no projeto `qfzoeshhogoilsmvxlif`. A auditoria da transação confirmou preservação dos registros existentes em 35 tabelas, das funções não relacionadas e dos saldos; não foram criadas sessões ou atividades de usuários para testar. As migrações 001–022 são pré-requisitos.

A migração **024**, `202610180024_manual_workout_confirmation.sql`, substitui apenas a avaliação obrigatória do método manual por três confirmações Sim/Não. Foi **autorizada e aplicada em produção em 18/10/2026**. A auditoria na mesma transação verificou a preservação dos registros nas 37 tabelas existentes (incluindo `auth.users`), das avaliações anteriores, dos saldos e das funções não relacionadas. Nenhuma atividade real foi criada para testar. Depende da 023; as funções de início, recuperação, finalização, cancelamento e avaliação opcional do cronômetro permanecem intactas.

## Métodos

Em **Registrar treino**, escolha:

- **Iniciar treino:** selecione a atividade e inicie uma sessão online. O Supabase registra o início. A finalização fica disponível depois de 35 minutos; o servidor valida o tempo antes de confirmar. Depois da confirmação, há uma avaliação opcional com **Agora não**.
- **Registrar manualmente:** informe atividade e duração inteira, de 35 a 1440 minutos, e toque em **Continuar**. Responda duas perguntas provocativas e a confirmação final, uma por vez. As três respostas precisam ser **Sim**. Não há avaliação de intensidade, sensação ou conclusão nesse método.

Ambos precisam de conexão para confirmar definitivamente. O manual pode ser preenchido offline: atividade, duração e declaração positiva ficam na fila da própria conta, com indicador de pendência, sem acender a chama ou gerar recompensas. A fila é retomada ao recarregar/reconectar; deve sincronizar ainda no dia aceito pelo servidor. Registros pendentes podem ser revisados antes da confirmação, reabrindo Registrar treino. Uma falha de confirmação online mantém o formulário aberto para tentar novamente. O mesmo identificador de solicitação é reutilizado enquanto o formulário estiver aberto. Após fechar e reabrir, o servidor ainda impede dois registros no mesmo dia.

**35 minutos é uma regra configurável do produto, não uma recomendação universal de exercício.** O cronômetro valida o tempo decorrido de uma sessão e não comprova fisicamente que a pessoa realizou exercício. Não há GPS, localização, sensores, fotos ou acompanhamento de exercícios individuais.

## Interrogatório manual

O mesmo modal apresenta duas perguntas diferentes, sorteadas de uma coleção de dez. **Sim sempre confirma que houve treino real**. O par permanece estável ao avançar, voltar, corrigir os campos ou escolher novamente o método dentro do modal. Os IDs do último par concluído ficam apenas no aparelho, separados por conta, para evitar repetição consecutiva quando possível; essa variedade não sincroniza entre dispositivos e é opcional se o armazenamento estiver indisponível.

A última pergunta é sempre **“Você confirma que realmente treinou por pelo menos 35 minutos?”**, com **“Sim, eu confirmo.”** e **“Não”**. O progresso é `1 de 3`; as transições duram 140 ms e são removidas com `prefers-reduced-motion`. Não há espera obrigatória nem nova página.

Qualquer **Não** interrompe o fluxo com **“Pelo menos você foi sincero. A chama prefere a verdade.”**, oferecendo voltar ao formulário ou cancelar. Atividade e duração são mantidas ao voltar. Nenhuma resposta negativa é enviada ou persistida; não há treino, moeda, ponto, proteção consumida ou falta registrada nessa etapa. As regras normais de encerramento do dia continuam valendo.

O servidor exige duração mínima, versão válida da declaração, IDs de duas perguntas conhecidas e distintas e exatamente três booleanos positivos. O cliente envia `{version:1, questionIds:[...], answers:[true,true,true]}` em `p_confirmation`. Ignorar as telas não dispensa esse contrato. **Uma autodeclaração pode ser falsificada por quem controla a própria requisição; ela não comprova exercício nem detecta mentiras.** As mensagens são provocações bem-humoradas, sem alegação de monitoramento.

No treino definitivo, persiste apenas `manual_confirmed=true`, além dos campos e horários existentes. IDs e respostas não são guardados no banco. Um rascunho offline guarda temporariamente a declaração positiva para reenvio idempotente, sem `confirmedAt` ou recompensa antecipada. O servidor decide o dia e a confirmação ao reconectar. Ao sair da conta, os dados locais daquela conta são limpos pelo mecanismo existente.

O questionário não atribui intensidade, sensação ou completude fictícias: novos manuais têm `review=null` e ficam fora dos denominadores de avaliação dos relatórios. Avaliações históricas continuam disponíveis. Rascunhos antigos com a avaliação anterior não são enviados automaticamente: no indicador do Início, **Revisar** abre o formulário para responder às três perguntas; dias passados não podem ser confirmados retroativamente.

## Sessão cronometrada

`#/treino-em-andamento` usa `usePageNavigation` e não acrescenta aba fixa. Mostra atividade, minutos/segundos, progresso, mínimo, estado e ações. Um indicador no Início permite voltar à sessão sem impedir a navegação.

O banco mantém `workout_sessions` com ID, conta, chave de repetição, atividade, fuso fixado, início, fim, duração validada, mínimo/máximo daquele início, estado e referência ao treino definitivo. Os estados são:

| Estado | Comportamento |
| --- | --- |
| `active` | Pode finalizar após o mínimo ou cancelar |
| `completed` | Treino confirmado; repetir finalização devolve o mesmo treino |
| `cancelled` | Não cria treino, moedas ou pontos; não pode ser concluída |
| `expired` | Limite de 4 horas atingido; não pode ser concluída |

Só existe uma sessão ativa por conta. Uma segunda tentativa de início, inclusive de outro aparelho, recupera a sessão ativa. A chave original de início também permite repetir uma solicitação sem criar outra sessão. Quem já confirmou o treino de hoje não pode iniciar outro.

A contagem visual usa `serverNow` e `startedAt`, com uma âncora monotônica de `performance.now()`. Um intervalo atualiza apenas o desenho. **Não existe início confiável no localStorage nem validação pelo relógio do celular.** Ao abrir, recarregar, reconectar, voltar à página ou retomar uma aba visível, o app consulta o estado persistido. Há atualização periódica enquanto a página está visível.

Bloquear a tela, fechar o app ou navegar para outra página não cancela nem pausa a sessão. Não é necessário deixar a tela ligada. O botão Voltar apenas navega; cancelar exige confirmação explícita. No dispositivo que está sem conexão, o tempo visível pode estar desatualizado; iniciar/finalizar/cancelar exige resposta do servidor.

Às 4 horas a sessão deixa de ser elegível. A transição persistida para expirada é feita no próximo acesso ao estado ou operação de sessão. Não há agendador adicional, confirmação automática ou execução permanente em segundo plano. Se o app estiver fechado, a recuperação aplica a expiração antes de devolver o estado.

## Datas, histórico e avaliação

O treino pertence ao **dia da finalização no fuso fixado para a conta**, mesmo quando começou antes da meia-noite. Não preenche o dia anterior nem preserva sua ofensiva por estar ativo. Repetir uma finalização já concluída em outro dia devolve o resultado original. Se uma transação aguardar um bloqueio e atravessar a virada do dia, a confirmação pede nova tentativa para manter o mesmo dia de referência da economia existente.

O horário de confirmação continua sendo determinado pelo servidor e é o horário usado na corrida diária da Arena. O início do cronômetro não dá vantagem na corrida.

`workout_days` recebe `recording_method` (`manual`, `timed`, `legacy`), avaliação JSON ou `null`, chave idempotente e, a partir da 024, o booleano `manual_confirmed` (padrão `false` para registros anteriores). Os registros antigos recebem apenas a classificação de compatibilidade **Registro anterior**: atividade, duração, data, horário, pontos, saldos e snapshots anteriores são preservados. Nenhum treino antigo é reclassificado como manual ou cronometrado; a nova duração mínima não invalida o histórico.

No calendário e histórico, os detalhes expansíveis mostram método e avaliação, além dos dados já existentes. Avaliações permanecem privadas. A avaliação opcional de um treino cronometrado é salva por uma operação separada, depois da confirmação. Uma vez preenchida, não pode ser alterada; reenviar as mesmas respostas é seguro. Ausência de avaliação é `null`, nunca intensidade zero ou resposta negativa. Fechar/pular/falhar na avaliação não desfaz o treino.

Antigos registros locais ainda não confirmados, sem a nova declaração positiva, não são enviados automaticamente pelo RPC antigo. Permanecem no armazenamento para recuperação, mas não acendem a chama como se fossem confirmação definitiva. O usuário deve fazer um registro válido de hoje; dias passados não são importados. O histórico confirmado retorna normalmente do servidor.

## Ofensivas, moedas, metas e Arena

Há **um treino confirmado por conta/dia**. Os dois métodos inserem em `workout_days` pelo caminho definitivo que mantém o trigger de recompensa existente. A chave única de movimentação diária evita duplicação de moedas. Iniciar, cancelar e expirar não inserem nesse histórico, não geram recompensas e não contam nas missões ou conquistas.

As respostas não influenciam a recompensa padrão, atualmente 10 moedas, ou a pontuação. Descansos programados, extras, kits e reagendamentos continuam usando as funções atuais. Treinos voluntários em descanso permanecem no histórico, sem ponto extra na ofensiva. Os limites/preços dos Kits Médicos e metas existentes não mudam.

Grupos e desafios existentes aceitam ambos os métodos e os registros anteriores. A nova criação de desafio também pode selecionar **Somente treinos cronometrados**. Essa restrição afeta só o resultado desse desafio, sem tirar moedas/ofensiva individual de um treino manual válido. Descansos/proteções/reagendamentos e cotas continuam sendo respeitados. Resultados consolidados continuam congelados. Sessões, avaliações e pesos não entram na resposta compartilhada da Arena.

Nos relatórios privados, a seção de registros mostra quantidades por método, minutos, intensidade média, sensações e distribuição de completos/parciais/adaptados. A média e os percentuais de avaliação usam somente os registros avaliados. Os totais e os percentuais de frequência existentes continuam considerando o cronograma efetivo.

## Segurança e APIs

As tabelas de regras/sessões têm RLS e nenhuma permissão de escrita direta para `anon`/`authenticated`. Helpers privados não são executáveis por clientes. Os RPCs autenticados conferem perfil e conta:

- `get_workout_recording_state(p_timezone)` recupera/expira a sessão e devolve horário de referência e regras.
- `start_workout_session(p_request_id,p_activity,p_timezone)` inicia ou recupera a única sessão ativa.
- `finish_workout_session(p_id,p_timezone)` valida duração e confirma atomicamente.
- `cancel_workout_session(p_id,p_timezone)` cancela apenas sessões ativas.
- `confirm_manual_workout(p_request_id,p_day,p_activity,p_minutes,p_confirmation,p_timezone)` valida duração, declaração positiva e dia.
- `submit_workout_review(p_id,p_review)` grava apenas avaliação de treino cronometrado da própria conta.
- `create_recording_challenge(...,p_recording_policy)` cria desafio com política `any` ou `timed`.

As operações de sessão/registro compartilham o bloqueio de `training_accounts` já usado por descansos/reagendamentos e usam índices únicos. A confirmação, moeda e vínculo da sessão são uma transação: falha desfaz tudo; repetição concluída retorna o mesmo registro. Um dispositivo não pode encerrar ou avaliar a sessão de outra conta.

`confirm_daily_workout` na assinatura antiga passa a recusar registros e pede atualização do app, para não permitir contornar a confirmação ou a duração. A 024 também substitui o parâmetro nomeado `p_review` por `p_confirmation`, sem manter uma sobrecarga que aceite a avaliação anterior. Não remover essa proteção para manter clientes antigos registrando treinos.

Configuração administrativa em `workout_recording_rules`: `minimum_minutes=35`, `maximum_session_minutes=240`. Cada sessão fixa os limites ao iniciar, evitando mudar uma sessão já em andamento. O app lê as regras; o backend é a autoridade. Para o manual, a 024 mantém um piso de 35 minutos mesmo se uma configuração administrativa reduzir o mínimo; um mínimo configurado maior continua sendo exigido. Nenhuma regra de sessão cronometrada foi alterada. Recompensas continuam em `economy_rules`.

## Offline, PWA e notificações

O cache do service worker continua armazenando apenas arquivos do app. Treinos confirmados já sincronizados e dados locais existentes podem ser consultados offline. Nenhuma chamada RPC é interceptada ou simulada pelo cache. O preenchimento manual offline mantém uma fila local por conta com declaração positiva e chave idempotente; o servidor valida a confirmação ao reconectar. Um dia passado não é preenchido retroativamente. Operações do cronômetro exigem internet. Nenhuma pendência gera moeda/ofensiva antes do servidor.

Nenhum sensor ou processo de background é necessário. Android/iOS podem suspender JavaScript; a sessão continua no servidor e é recalculada ao retornar. Permissões e horários de notificação existentes são preservados. Um registro manual pendente não suprime o lembrete de treino como se já tivesse sido confirmado. Não foi criado aviso garantido aos 35 minutos ou promessa de execução em segundo plano. O Web Push continua dependendo da configuração já documentada em [PUSH-E-GRUPOS.md](PUSH-E-GRUPOS.md).

## Testes e ativação

Arquivos centrais desta alteração:

- Fluxo: `src/App.tsx`, `src/WorkoutRegistration.tsx`, `src/useWorkoutSession.ts`, `src/workoutRecording.ts`, `src/navigation.ts`, `src/model.ts` e `src/social.ts`.
- Integrações: `src/WorkoutCalendar.tsx`, `src/ProgressReports.tsx`, `src/ChallengesPanel.tsx`, `src/gamification.ts`, `src/backend.ts` e `src/styles.css`.
- Banco: migrações `202610180023_workout_recording.sql` e `202610180024_manual_workout_confirmation.sql`. Testes de migração, histórico e protocolo em `supabase/tests/workout-recording*.sql` e `supabase/tests/manual-*.sql`.
- Interrogatório: `src/ManualWorkoutInterrogation.tsx`, `src/manualConfirmation.ts` e `src/manualConfirmation.test.tsx`.
- Testes React: `src/workoutRecording.test.tsx`, `src/App.test.tsx`, `src/App.group-notify.test.tsx`, `src/social.test.tsx`, `src/model.test.ts` e `src/gamification.test.tsx`.
- Execução SQL: `scripts/test-gamification-db.sh` e `scripts/test-workout-concurrency.sh`. Documentação: este guia e `README.md`.

```sh
npm test
npm run build
bash scripts/test-profiles-db.sh
bash scripts/test-gamification-db.sh
```

As suítes SQL sobem PostgreSQL 17 descartável, sem portas/rede/credenciais de produção. Além da regressão existente, verificam preservação de histórico durante a migração, início, recuperação, limite mínimo/máximo, cancelamento, avaliação, confirmação única, recompensas, Arena, política de desafios, privacidade e ACLs. `test-workout-concurrency.sh` abre conexões simultâneas reais para início, finalização e repetição manual.

Validação original da 023 em 18/10/2026: **308 testes em 41 arquivos** passaram em `npm test`; `npm run build` passou; ambas as suítes SQL acima passaram. A verificação adicional no Chromium com tela móvel simulada passou em oito cenários (manual, manual offline/reconexão, cronometrado e cancelamento/expiração, nos temas claro e escuro), com verificações de largura em 320/390 px. Os testes usaram somente fixtures, sem modificar dados de produção.

Validação da **024** em 18/10/2026: **381 testes em 45 arquivos** passaram em `npm test`; `npm run build` passou. Passaram as suítes `test-profiles-db.sh` e `test-gamification-db.sh`, incluindo migração com avaliações históricas, contrato de confirmação, duração, privilégios, recompensa única e concorrência real entre conexões. O ensaio da transação administrativa também passou em banco descartável. No Chromium móvel simulado, passaram oito cenários nos temas claro/escuro: manual (incluindo Não e Voltar), manual offline/reconexão, cronômetro e cancelamento/expiração; sem estouro horizontal em 320/390 px. Android/iPhone físicos não foram testados.

Os testes React verificam fila manual offline sem chama/recompensa antecipada, reconexão e conflitos com registros de outro aparelho, além de recuperação após remount/outro hook, retomada após suspensão simulada, relógio local incorreto, offline, logout, timeout/repetição, botões, avaliação e compatibilidade histórica. Testes em navegador móvel simulado usam respostas sintéticas; não substituem testes físicos.

Cobertura dos cenários solicitados:

| Cenário | Validação automatizada |
| --- | --- |
| 1. Início | RPC autenticado e ausência de recompensa inicial |
| 2. Recuperação após fechar | Remount React e recarga no navegador simulado |
| 3. Outro dispositivo | Mesmo usuário em conexões SQL/hooks distintos |
| 4. Finalização antes de 35 min | Recusa SQL e botão desabilitado |
| 5. Finalização válida | Duração do servidor, treino definitivo e moeda |
| 6. Cancelamento | Estado persistido sem recompensa e confirmação visual |
| 7. Expiração de 4 h | Intervalo simulado somente em fixture SQL; recuperação e recusa de finalização |
| 8. Sessões simultâneas | Dois processos PostgreSQL reais, uma sessão |
| 9. Finalização repetida | Duas conexões e recuperação de erro de rede no hook |
| 10. Um treino/dia | Recusa de segunda confirmação em ambos os métodos |
| 11. Manual completo | RPC e formulário com três confirmações positivas; avaliações anteriores preservadas |
| 12. Respostas faltando | Recusa SQL e botão desabilitado |
| 13. Manual abaixo do mínimo | Recusa SQL e formulário inválido |
| 14. Registros anteriores | Migração preserva dados e parser aceita durações antigas |
| 15. Ofensiva | Confirmação soma uma vez; descanso voluntário não soma; regressão de descansos/reagendamentos/kits |
| 16. Recompensa única | Trigger e extrato, também sob concorrência |
| 17. Arena | Métodos mistos no grupo, desafios abertos e política de cronômetro |
| 18. Sincronização | Estado recuperado pelo servidor com fuso fixado, replay e conexão simultânea |
| 19. Segurança Supabase | PostgreSQL descartável com RLS, papéis `authenticated`/`anon`, ACLs e tentativa de adulteração |
| 20. Suspensão da página | Retomada simulada consulta novo horário do servidor; contador não depende de ticks anteriores |

Antes da liberação, validar em **Android/PWA e iPhone/Safari reais**: bloquear a tela por mais de 35 minutos, fechar/reabrir, recuperar em outro aparelho autenticado, perder a rede na finalização e deixar expirar após 4 horas. Esses testes físicos não foram executados no ambiente de desenvolvimento.

Ativação da 024:

1. O usuário autorizou nesta conversa aplicar migrações e publicar a página sem novas confirmações. A **024 foi aplicada** por transação auditada e registrada no histórico administrativo; a 023 já estava ativa. Não reaplicar migrações anteriores nem preencher o histórico automaticamente com `db push`.
2. A transação verificou os dados existentes antes e depois, ignorando somente o novo campo com padrão `false`. Qualquer divergência ou alteração de função não relacionada causaria rollback. As funções do cronômetro, limites, moedas e resultados consolidados foram preservados.
3. O frontend desta alteração deve acompanhar a 024: o parâmetro nomeado mudou de `p_review` para `p_confirmation`. Clientes antigos precisam atualizar. Não usar este frontend contra um banco que ainda só tenha a 023.
4. Online, fechar as janelas antigas da PWA e reabrir para ativar o novo cache. Não apagar dados nem reinstalar. Rascunhos antigos devem passar pelas novas perguntas.
5. A validação pública deve usar consultas de versão/permissões e respostas sintéticas no navegador. Não inserir atividades ou alterar horários de usuários reais para testar. Testes físicos continuam pendentes.

Não há nova Edge Function, serviço pago, localização ou alteração na infraestrutura de push.
