# Registro de treinos

A migração incremental **023**, `202610180023_workout_recording.sql`, amplia o registro existente. Não foi aplicada à produção nesta implementação. As migrações 001–022 devem estar instaladas antes dela.

## Métodos

Em **Registrar treino**, escolha:

- **Iniciar treino:** selecione a atividade e inicie uma sessão online. O Supabase registra o início. A finalização fica disponível depois de 35 minutos; o servidor valida o tempo antes de confirmar. Depois da confirmação, há uma avaliação opcional com **Agora não**.
- **Registrar manualmente:** informe atividade e duração inteira, de 35 a 1440 minutos, e responda intensidade (1–5), sensação (cansado, normal ou muito bem) e conclusão (completo, parcial ou adaptado). Todas as respostas são obrigatórias. Treinos parciais/adaptados continuam válidos.

Ambos precisam de conexão para confirmar definitivamente. O manual pode ser preenchido offline: atividade, duração e avaliação ficam na fila da própria conta, com indicador de pendência, sem acender a chama ou gerar recompensas. A fila é retomada ao recarregar/reconectar; deve sincronizar ainda no dia aceito pelo servidor. Registros pendentes podem ser revisados antes da confirmação, reabrindo Registrar treino. Uma falha de confirmação online mantém o formulário aberto para tentar novamente. O mesmo identificador de solicitação é reutilizado enquanto o formulário estiver aberto. Após fechar e reabrir, o servidor ainda impede dois registros no mesmo dia.

**35 minutos é uma regra configurável do produto, não uma recomendação universal de exercício.** O cronômetro valida o tempo decorrido de uma sessão e não comprova fisicamente que a pessoa realizou exercício. Não há GPS, localização, sensores, fotos ou acompanhamento de exercícios individuais.

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

`workout_days` recebe `recording_method` (`manual`, `timed`, `legacy`), avaliação JSON ou `null` e chave idempotente. Os registros antigos recebem apenas a classificação de compatibilidade **Registro anterior**: atividade, duração, data, horário, pontos, saldos e snapshots anteriores são preservados. Nenhum treino antigo é reclassificado como manual ou cronometrado; a nova duração mínima não invalida o histórico.

No calendário e histórico, os detalhes expansíveis mostram método e avaliação, além dos dados já existentes. Avaliações permanecem privadas. A avaliação opcional de um treino cronometrado é salva por uma operação separada, depois da confirmação. Uma vez preenchida, não pode ser alterada; reenviar as mesmas respostas é seguro. Ausência de avaliação é `null`, nunca intensidade zero ou resposta negativa. Fechar/pular/falhar na avaliação não desfaz o treino.

Antigos registros locais ainda não confirmados, sem método ou avaliação, não são enviados automaticamente pelo RPC antigo. Permanecem no armazenamento para recuperação, mas não acendem a chama como se fossem confirmação definitiva. O usuário deve fazer um registro válido de hoje; dias passados não são importados. O histórico confirmado retorna normalmente do servidor.

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
- `confirm_manual_workout(p_request_id,p_day,p_activity,p_minutes,p_review,p_timezone)` valida duração, avaliação e dia.
- `submit_workout_review(p_id,p_review)` grava apenas avaliação de treino cronometrado da própria conta.
- `create_recording_challenge(...,p_recording_policy)` cria desafio com política `any` ou `timed`.

As operações de sessão/registro compartilham o bloqueio de `training_accounts` já usado por descansos/reagendamentos e usam índices únicos. A confirmação, moeda e vínculo da sessão são uma transação: falha desfaz tudo; repetição concluída retorna o mesmo registro. Um dispositivo não pode encerrar ou avaliar a sessão de outra conta.

`confirm_daily_workout` na assinatura antiga passa a recusar registros e pede atualização do app, para não permitir contornar avaliação ou duração. Não remover essa proteção para manter clientes antigos registrando treinos.

Configuração administrativa em `workout_recording_rules`: `minimum_minutes=35`, `maximum_session_minutes=240`. Cada sessão fixa os limites ao iniciar, evitando mudar uma sessão já em andamento. O app lê as regras; o backend é a autoridade. Recompensas continuam em `economy_rules`.

## Offline, PWA e notificações

O cache do service worker continua armazenando apenas arquivos do app. Treinos confirmados já sincronizados e dados locais existentes podem ser consultados offline. Nenhuma chamada RPC é interceptada ou simulada pelo cache. O preenchimento manual offline mantém uma fila local por conta com avaliação e chave idempotente; o servidor valida a confirmação ao reconectar. Um dia passado não é preenchido retroativamente. Operações do cronômetro exigem internet. Nenhuma pendência gera moeda/ofensiva antes do servidor.

Nenhum sensor ou processo de background é necessário. Android/iOS podem suspender JavaScript; a sessão continua no servidor e é recalculada ao retornar. Permissões e horários de notificação existentes são preservados. Um registro manual pendente não suprime o lembrete de treino como se já tivesse sido confirmado. Não foi criado aviso garantido aos 35 minutos ou promessa de execução em segundo plano. O Web Push continua dependendo da configuração já documentada em [PUSH-E-GRUPOS.md](PUSH-E-GRUPOS.md).

## Testes e ativação

Arquivos centrais desta alteração:

- Fluxo: `src/App.tsx`, `src/WorkoutRegistration.tsx`, `src/useWorkoutSession.ts`, `src/workoutRecording.ts`, `src/navigation.ts`, `src/model.ts` e `src/social.ts`.
- Integrações: `src/WorkoutCalendar.tsx`, `src/ProgressReports.tsx`, `src/ChallengesPanel.tsx`, `src/gamification.ts`, `src/backend.ts` e `src/styles.css`.
- Banco: `supabase/migrations/202610180023_workout_recording.sql`. Testes de migração, histórico e protocolo em `supabase/tests/workout-recording*.sql`.
- Testes React: `src/workoutRecording.test.tsx`, `src/App.test.tsx`, `src/App.group-notify.test.tsx`, `src/social.test.tsx`, `src/model.test.ts` e `src/gamification.test.tsx`.
- Execução SQL: `scripts/test-gamification-db.sh` e `scripts/test-workout-concurrency.sh`. Documentação: este guia e `README.md`.

```sh
npm test
npm run build
bash scripts/test-profiles-db.sh
bash scripts/test-gamification-db.sh
```

As suítes SQL sobem PostgreSQL 17 descartável, sem portas/rede/credenciais de produção. Além da regressão existente, verificam preservação de histórico durante a migração, início, recuperação, limite mínimo/máximo, cancelamento, avaliação, confirmação única, recompensas, Arena, política de desafios, privacidade e ACLs. `test-workout-concurrency.sh` abre conexões simultâneas reais para início, finalização e repetição manual.

Validação em 18/10/2026: **308 testes em 41 arquivos** passaram em `npm test`; `npm run build` passou; ambas as suítes SQL acima passaram. A verificação adicional no Chromium com tela móvel simulada passou em oito cenários (manual, manual offline/reconexão, cronometrado e cancelamento/expiração, nos temas claro e escuro), com verificações de largura em 320/390 px. Os testes usaram somente fixtures, sem modificar dados de produção.

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
| 11. Manual completo | RPC e formulário com avaliação, inclusive treino parcial/adaptado |
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

Para produção:

1. Revisar e **autorizar expressamente** a migração 023. Preparar backup e conferir que a estrutura 001–022 já existe; não reaplicar migrações antigas para preencher o histórico do Supabase.
2. Aplicar **somente** `202610180023_workout_recording.sql` na sequência correta, registrando a nova versão no histórico de migrações pelo processo administrativo existente. Não usar `db push` indiscriminadamente.
3. Publicar o frontend desta alteração junto da atualização do servidor. Clientes antigos receberão orientação para atualizar ao tentar registrar.
4. Conectado à internet, fechar todas as janelas antigas da PWA e reabrir para ativar o novo cache. Não apagar dados nem reinstalar para atualizar.
5. Fazer um teste com conta dedicada autorizada: dois métodos em dias distintos, recuperação entre aparelhos, saldo e Arena. Não alterar horários ou registros de usuários reais para testar.

Não há nova Edge Function, serviço pago, localização ou alteração na infraestrutura de push.
