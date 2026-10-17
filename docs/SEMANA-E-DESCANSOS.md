# Semana de treinos, descansos e ofensivas

Requer as migrações anteriores, [008](../supabase/migrations/202610170008_training_schedule.sql) e [009](../supabase/migrations/202610170009_scheduled_rest_limit.sql). Não remove treinos, pesos, contas ou conquistas existentes.

Migrações 008 e 009 aplicadas no projeto atual em 17/10/2026. As novas RPCs foram verificadas em transação revertida; contagens e resumos de integridade dos registros existentes permaneceram iguais. O acesso anônimo e a execução direta de funções internas continuam bloqueados.

## Como usar

- **Treinos → Sua semana**, acima do calendário: marque os dias de treino, de segunda a domingo. Os demais são descanso. É permitido selecionar no máximo **2 dias de descanso programado** (pelo menos 5 dias de treino). Com 3 ou mais descansos, o botão de salvar fica desativado e o servidor também recusa o salvamento. Programações antigas continuam preservadas; ao editá-las, a nova versão precisa respeitar o limite. Salve para aplicar a partir de amanhã; pode alterar novamente depois.
- **Treinos**: o calendário mostra treino registrado, descanso programado, descanso extra autorizado e treino não realizado, com ícones e nomes acessíveis. Datas anteriores ao início do acompanhamento não são apresentadas como faltas.
- **Treinos → Hoje → Descansar hoje**: confirme um descanso extra antes de registrar o treino. A autorização precisa de conexão; a programação e os descansos já autorizados podem ser consultados offline.

## Contagem

| Situação | Efeito na ofensiva |
| --- | --- |
| Treino confirmado em dia programado | Soma um dia |
| Descanso programado | Mantém, sem somar |
| Descanso extra autorizado | Mantém, sem somar |
| Dia programado encerrado sem treino ou proteção | Interrompe; o próximo treino começa em um |
| Treino voluntário em descanso | Registra atividade e duração, sem pontos de ofensiva |

Hoje pode permanecer pendente até terminar. Duplicatas legadas de treino não somam mais de um ponto na mesma data. O recorde e os treinos anteriores permanecem. Lembretes automáticos de treino respeitam descansos válidos; o lembrete de peso continua independente. Essa regra não ativa o serviço de push que ainda estiver pendente de configuração.

O limite de descansos extras é **2 por semana, de segunda a domingo**. A fonte de configuração é a função SQL `training_extra_rest_limit()` na migração 008. Para alterar o limite, publique uma nova migração substituindo essa função; o cliente recebe o valor do servidor. Repetir a autorização do mesmo dia é idempotente. Dois aparelhos não consomem dois descansos, e trocar o fuso do aparelho não renova o saldo.

## Grupos

Os membros em descanso válido não precisam treinar para proteger o grupo. Todos os demais precisam confirmar online dentro do dia no fuso definido pelo grupo. Um dia coletivo concluído soma um ponto quando há pelo menos um treino obrigatório; se todos descansarem, mantém a sequência sem acrescentar pontos. Treinos voluntários em descanso não recebem posição na corrida diária.

Os dias da semana são avaliados na data do grupo. A programação considerada é a que já estava salva no início desse dia; uma edição feita depois não muda essa classificação. Descansos extras precisam estar autorizados para a mesma data antes do encerramento do dia do grupo. A semana individual e o saldo de extras seguem o fuso fixado na primeira sincronização da conta. O fuso do grupo continua visível em **Arena → Detalhes**.

O servidor atualiza os dias de descanso passados quando alguém volta a consultar o grupo, mesmo que ninguém tenha aberto o app nesses dias. Dias coletivos já salvos e dias encerrados já avaliados não são recalculados. Colunas novas preservam os pontos das conquistas anteriores.

## Persistência e proteção do histórico

`training_accounts` guarda fuso e revisão por conta; `training_plans` guarda versões imutáveis, com data de vigência; `training_extra_rests` guarda autorizações por data. RLS está ativo e o navegador só usa RPCs autenticadas. Funções internas não podem ser chamadas por visitantes ou usuários comuns.

As alterações da programação usam revisão para impedir sobrescritas entre aparelhos e só criam versões futuras. As autorizações usam o relógio do servidor e o mesmo bloqueio de conta usado na confirmação de treino. Não existe RPC para excluir descansos, editar versões antigas ou proteger retroativamente uma falta. O cache local é separado por conta e removido no logout; respostas atrasadas não o recriam após sair.

Validação: `npm test`, `npm run build` e `bash scripts/test-profiles-db.sh`. O último comando usa PostgreSQL 17 descartável, verifica reaplicação da migração, isolamento, conflitos, cotas, fusos, proteção de grupos, snapshots à meia-noite, atualização de dias sem visitas, bloqueio de push em descanso e pedidos concorrentes. Não envia notificações nem altera o projeto real.
